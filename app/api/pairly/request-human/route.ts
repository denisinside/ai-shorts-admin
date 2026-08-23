import { NextResponse } from "next/server";

import { envFailure, envProblems, isUuid, jsonError, readJsonBody } from "../_http";
import {
  insertSystemTurn,
  loadConversation,
  loadMessages,
  markEscalated,
  touchConversation,
} from "../_db";

/**
 * Кнопка «Покликати людину» з макета — постійна, доступна в будь-який момент.
 *
 * ЧОМУ ЦЕ ОКРЕМИЙ РОУТ, А НЕ ПОВІДОМЛЕННЯ В DIFY. Явне прохання покликати
 * людину — не судження, а факт: вирішувати тут нічого. Якби кнопка надсилала
 * канонічний текст у чатфлоу, ескалація залежала б від того, як модель цей
 * текст розпізнає, — а в таксономії `pairly/decide.py` для «покличте менеджера»
 * взагалі немає intent, тож вона поїхала б в `other` і спрацювала б випадково.
 * Випадковий правильний результат гірший за детермінований: він ламається
 * молча, коли промпт трохи змінюється.
 *
 * Це той самий інваріант, що тримає весь кейс: детерміноване ухвалює код.
 *
 * Ідемпотентність — фільтр `escalated_at is null` усередині `markEscalated`.
 * Другий клік не переписує ні час, ні причину: перша передача і є та, за якою
 * розмова стоїть у черзі.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const problems = envProblems();
  if (problems.length > 0) return envFailure(problems);

  const body = await readJsonBody(request);
  if (!body) return jsonError("не зрозумів запит", 400);

  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  if (!isUuid(conversationId)) return jsonError("conversationId має бути uuid", 400);

  try {
    const conversation = await loadConversation(conversationId);
    if (!conversation) return jsonError("розмову не знайдено", 404);
    if (conversation.status === "closed") {
      return jsonError("розмова вже закрита", 409);
    }

    const claimed = await markEscalated(conversationId, "user_requested_human");
    // Службовий хід пишемо лише разом із першою передачею. Інакше на кожен
    // повторний клік у транскрипті з'являлася б ще одна позначка, і вижимка
    // рахувала б ходи, яких у розмові не було.
    if (claimed) {
      await insertSystemTurn({
        conversationId,
        text: "Користувач попросив передати розмову людині.",
        escalationReason: "user_requested_human",
      });
    }
    await touchConversation(conversationId);

    return NextResponse.json({
      conversationId,
      claimed,
      conversation: await loadConversation(conversationId),
      messages: await loadMessages(conversationId),
    });
  } catch (error) {
    console.error("[pairly] request-human", error);
    return jsonError("не вдалося передати розмову", 500);
  }
}
