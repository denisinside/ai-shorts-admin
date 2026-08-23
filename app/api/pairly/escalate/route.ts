import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { pairlyConfig } from "@/lib/pairly";
import { envFailure, envProblems, isUuid, jsonError } from "../_http";
import { markEscalated } from "../_db";

/**
 * Приймач вебхука ескалації ВІД Dify.
 *
 * Чому він узагалі є, якщо факт ескалації вже їде конвертом у відповіді. Прогін
 * триває 8-15 секунд, і якщо користувач закриє вкладку посередині, відповідь не
 * доїде нікуди — а ескалація вже сталася, і тех. сапорт про неї не дізнається.
 * Тому гілка ескалації в графі стукає сюди ДО ноди `answer`. Конверт — швидкий
 * шлях для інтерфейсу, вебхук — надійний шлях для черги. Це не дублювання: у
 * них різні режими відмови.
 *
 * ЧОМУ СЕКРЕТ У ТІЛІ, А НЕ В ЗАГОЛОВКУ. Той самий патерн `gate_key`, що в
 * Дні 1: HTTP-ноди Dify можуть надіслати заголовок, але поле тіла — це те, що
 * гарантовано переживає перегенерацію DSL і не залежить від того, чи проксі
 * дорогою заголовок не зріже. Це не автентифікація, а спільний секрет: дорога
 * частина за ним — не запис, а видимість розмови в черзі.
 *
 * Секрет звіряється над СИРИМ тілом, до `JSON.parse` — так само, як підпис
 * Discord: битий JSON від невідомого клієнта не має доходити до парсера, і
 * різні коди на різні збої (401 на секрет, 400 на JSON) — це те, за чим потім
 * і локалізують «не працює».
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Витягує значення `escalate_key` із сирого тіла без повного розбору JSON. */
const KEY_RE = /"escalate_key"\s*:\s*"([^"]*)"/;

/**
 * Порівняння за фіксований час. Довжини різні — `timingSafeEqual` кинув би,
 * тому спершу зводимо обидва до однакової довжини хешем.
 */
function sameSecret(given: string, expected: string): boolean {
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET() {
  const cfg = pairlyConfig();
  const problems = envProblems(
    cfg.escalateKey ? [] : ["PAIRLY_ESCALATE_KEY не заданий — вебхук відповідатиме 500"],
  );
  return NextResponse.json({
    endpoint: "pairly escalate",
    runtime: "nodejs",
    escalate_key: {
      present: Boolean(cfg.escalateKey),
      length: cfg.escalateKey?.length ?? 0,
    },
    ok: problems.length === 0,
    problems,
  });
}

export async function POST(request: Request) {
  const cfg = pairlyConfig();
  const problems = envProblems(
    cfg.escalateKey ? [] : ["PAIRLY_ESCALATE_KEY не заданий"],
  );
  if (problems.length > 0) return envFailure(problems);

  const raw = await request.text();
  const given = KEY_RE.exec(raw)?.[1] ?? "";
  if (!given || !sameSecret(given, cfg.escalateKey!)) {
    console.error("[pairly] escalate: секрет не збігається");
    return jsonError("не авторизовано", 401);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("не об'єкт");
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("не зрозумів тіло запиту", 400);
  }

  const conversationId =
    typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
  if (!isUuid(conversationId)) {
    return jsonError("conversation_id має бути uuid", 400);
  }
  const reason =
    typeof body.escalation_reason === "string" && body.escalation_reason
      ? body.escalation_reason
      : null;

  try {
    const claimed = await markEscalated(conversationId, reason);
    // Порожній результат — це НЕ помилка: конверт уже встиг записати те саме,
    // і другий прихід нічого не змінює за визначенням. 200 тут навмисно, бо
    // не-2xx у графі з `default-value` виглядав би як зламаний вебхук і привів
    // би до зайвого діагностування живої системи.
    return NextResponse.json({ ok: true, claimed });
  } catch (error) {
    console.error("[pairly] escalate", error);
    return jsonError("не вдалося позначити ескалацію", 500);
  }
}
