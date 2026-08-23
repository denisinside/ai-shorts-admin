import { NextResponse } from "next/server";

import {
  askWaitbot,
  WAITBOT_DEFAULTS,
  WAITBOT_MAX_QUERY,
  waitbotConfig,
  type WaitbotLang,
  type WaitbotSettings,
} from "@/lib/waitbot";

/**
 * Публічний ендпоінт вікна WaitBot на `/blog`.
 *
 * ЧОМУ ВІН ПУБЛІЧНИЙ І ЩО З ЦИМ РОБИТИ. Читалка відкрита всім, авторизації в
 * ній немає, тож будь-який захист тут — це обмеження зловживання, а не
 * автентифікація. Обмежуємо трьома дешевими речами: довжина питання, м'який
 * ліміт на IP і `runtime: nodejs` (щоб лічильник узагалі мав де жити).
 *
 * Лічильник у пам'яті процесу — свідомий компроміс. На Vercel інстансів
 * кілька, і кожен рахує окремо, тому реальна стеля вища за задекларовану.
 * Це все одно на порядок краще за нічого й не тягне за собою Redis заради
 * вікна з ботом. Якщо ліміт почне мати значення — його місце в KV, не тут.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, { count: number; until: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const seen = hits.get(ip);
  if (!seen || seen.until < now) {
    hits.set(ip, { count: 1, until: now + WINDOW_MS });
    // Мапа не має рости вічно: підчищаємо протухле раз на запит, поки її
    // видно. Це дешевше за таймер, який на serverless усе одно не переживе
    // заморозку інстансу.
    if (hits.size > 500) {
      for (const [key, value] of hits) if (value.until < now) hits.delete(key);
    }
    return false;
  }
  seen.count += 1;
  return seen.count > MAX_PER_WINDOW;
}

/** Стан конфігурації — перше, що варто відкрити, коли «бот не відповідає».
 *  Значень не показує, тільки наявність: сторінка публічна. */
export async function GET() {
  const cfg = waitbotConfig();
  return NextResponse.json({
    ok: Boolean(cfg.key),
    difyBase: cfg.base,
    difyKey: cfg.key ? `задано (${cfg.key.length} символів)` : "НЕ ЗАДАНО",
  });
}

const LANGS: WaitbotLang[] = ["auto", "uk", "en"];

/**
 * Налаштування з вікна чату. Клієнту тут довіри нуль — не через зловмисника,
 * а тому що поламане значення поїхало б у воркфлоу вхідною змінною й тихо
 * зіпсувало б промпт. Невідома мова = `auto`, невідомий прапорець = дефолт.
 */
function readSettings(raw: unknown): WaitbotSettings {
  if (!raw || typeof raw !== "object") return WAITBOT_DEFAULTS;
  const value = raw as { lang?: unknown; memesAfterTranslate?: unknown };
  const lang = LANGS.includes(value.lang as WaitbotLang)
    ? (value.lang as WaitbotLang)
    : WAITBOT_DEFAULTS.lang;
  const memes =
    typeof value.memesAfterTranslate === "boolean"
      ? value.memesAfterTranslate
      : WAITBOT_DEFAULTS.memesAfterTranslate;
  return { lang, memesAfterTranslate: memes };
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "занадто швидко 😵 дай мені хвилинку" },
      { status: 429 },
    );
  }

  let payload: {
    query?: unknown;
    conversationId?: unknown;
    user?: unknown;
    settings?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "не зрозумів запит" }, { status: 400 });
  }

  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "напиши щось 🙂" }, { status: 400 });
  }
  if (query.length > WAITBOT_MAX_QUERY) {
    return NextResponse.json(
      { error: `задовге питання — до ${WAITBOT_MAX_QUERY} символів` },
      { status: 400 },
    );
  }

  // `user` приходить від клієнта, тому довіри йому нуль: він лише розводить
  // розмови між вкладками. Префікс не дає змішати їх із розмовами /aislop,
  // які живуть на тому самому акаунті Dify під ключем `discord:<channel>`.
  const raw = typeof payload.user === "string" ? payload.user : "";
  const user = "blog:" + (raw.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "anon");
  const conversationId =
    typeof payload.conversationId === "string"
      ? payload.conversationId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64)
      : "";

  const result = await askWaitbot({ query, user, conversationId, settings: readSettings(payload.settings) });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result);
}
