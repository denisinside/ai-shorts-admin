import "server-only";

import { NextResponse } from "next/server";

import { adminProblems } from "@/lib/supabase-admin";
import { isUuid } from "@/lib/reader";

/**
 * Спільна обв'язка ендпоінтів `/api/pairly/*`: валідація вхідного, м'який
 * ліміт зловживання і однакова форма помилки.
 *
 * Форма відповіді всюди одна — `{ error: "…" }` з осмисленим кодом, і ніде
 * `throw`: сторінки `/support` публічні й без авторизації, тож необроблена
 * помилка віддала б стектрейс у браузер, а людина в чаті побачила б порожній
 * екран замість причини.
 */

/** `U001`. Формат із датасету, і саме його чекає граф (`^U\d{3}$`). */
const USER_ID_RE = /^U\d{3}$/;

/** `agent-1`. Дозволяємо рівно те, що йде в URL і в колонку. */
const AGENT_ID_RE = /^[a-z0-9][a-z0-9-]{0,30}$/i;

export { isUuid };

export function isUserId(value: unknown): value is string {
  return typeof value === "string" && USER_ID_RE.test(value);
}

export function isAgentId(value: unknown): value is string {
  return typeof value === "string" && AGENT_ID_RE.test(value);
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Тіло запиту як об'єкт. Битий JSON — це 400, а не 500: клієнт помилився, не
 * сервер, і різні коди тут потрібні саме для того, щоб «не працює» можна було
 * локалізувати за одним номером.
 */
export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Чого не вистачає в оточенні, щоб ендпоінт узагалі міг працювати. Список
 * повертаємо, а не булев: «не працює» без назви змінної коштує години.
 */
export function envProblems(extra: string[] = []): string[] {
  return [...adminProblems(), ...extra];
}

export function envFailure(problems: string[]): NextResponse {
  console.error("[pairly] конфігурація", problems.join("; "));
  return NextResponse.json(
    { error: "підтримка не налаштована на сервері", problems },
    { status: 500 },
  );
}

// --- М'який ліміт зловживання ------------------------------------------------

/**
 * Лічильник у пам'яті процесу — той самий свідомий компроміс, що в
 * `/api/waitbot`. На Vercel інстансів кілька, і кожен рахує окремо, тому
 * реальна стеля вища за задекларовану. Це все одно на порядок краще за нічого
 * й не тягне Redis заради демо-чату. Коли ліміт почне мати значення — його
 * місце в KV, не тут.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { count: number; until: number }>();

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const seen = hits.get(ip);
  if (!seen || seen.until < now) {
    hits.set(ip, { count: 1, until: now + WINDOW_MS });
    // Мапа не має рости вічно: підчищаємо протухле раз на запит, поки її
    // видно. Дешевше за таймер, який на serverless не переживе заморозку.
    if (hits.size > 500) {
      for (const [key, value] of hits) if (value.until < now) hits.delete(key);
    }
    return false;
  }
  seen.count += 1;
  return seen.count > MAX_PER_WINDOW;
}
