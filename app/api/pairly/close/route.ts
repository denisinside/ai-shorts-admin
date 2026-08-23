import { NextResponse } from "next/server";

import {
  clientIp,
  envFailure,
  envProblems,
  isUuid,
  jsonError,
  rateLimited,
  readJsonBody,
} from "../_http";
import {
  closeConversation,
  insertSystemTurn,
  loadConversation,
  loadMessages,
} from "../_db";

/**
 * «Завершити чат». Доступно ОБОМ ролям — і користувачу, і тех. сапорту.
 *
 * Не «затвердження» і не гейт: словника HITL (`approved`, `decided_at`,
 * `needs_review`) у розмові підтримки немає навмисно. Її стан — це `mode` (хто
 * говорить) і `status` (чи відкрита), і закриття рухає рівно другий.
 *
 * `closed_by` — рядок, а не роль: це може бути `U012` або `agent-1`, і різні
 * колонки під двох акторів означали б, що «хто закрив» доводиться склеювати з
 * двох полів у кожному запиті.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return jsonError("занадто багато запитів — спробуйте за хвилину", 429);
  }

  const problems = envProblems();
  if (problems.length > 0) return envFailure(problems);

  const body = await readJsonBody(request);
  if (!body) return jsonError("не зрозумів запит", 400);

  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  if (!isUuid(conversationId)) return jsonError("conversationId має бути uuid", 400);

  const closedBy = typeof body.closedBy === "string" ? body.closedBy.trim().slice(0, 40) : "";
  if (!closedBy) return jsonError("потрібен closedBy", 400);

  try {
    const before = await loadConversation(conversationId);
    if (!before) return jsonError("розмову не знайдено", 404);

    // `closed` при повторному кліку — не помилка: фільтр `status=eq.open`
    // усередині пропускає лише перший, і саме він фіксує автора.
    const closed = await closeConversation(conversationId, closedBy);

    // Позначка в транскрипті, і лише разом із ПЕРШИМ закриттям. Кнопка
    // «Завершити діалог» є в обох ролей, тож без цього рядка вижимка не могла б
    // сказати, хто саме закрив звернення — а це різні речі: користувач пішов
    // сам чи агент вирішив, що питання закрите.
    if (closed) {
      await insertSystemTurn({
        conversationId,
        text: `Звернення закрито (${closedBy}).`,
      });
    }

    return NextResponse.json({
      conversationId,
      closed,
      conversation: await loadConversation(conversationId),
      messages: await loadMessages(conversationId),
    });
  } catch (error) {
    console.error("[pairly] close", error);
    return jsonError("не вдалося закрити розмову", 500);
  }
}
