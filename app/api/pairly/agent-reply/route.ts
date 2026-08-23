import { NextResponse } from "next/server";

import { PAIRLY_MAX_QUERY } from "@/lib/pairly";
import {
  clientIp,
  envFailure,
  envProblems,
  isAgentId,
  isUuid,
  jsonError,
  rateLimited,
  readJsonBody,
} from "../_http";
import { assignAgent, insertAgentTurn, loadConversation, loadMessages } from "../_db";

/**
 * Хід тех. сапорта.
 *
 * **Dify тут не викликається взагалі** — і це головне про цей файл. Це та межа,
 * яку кейс вимагає розмежувати чітко: відповідає бот АБО людина, і перехід між
 * ними — це стан рядка в базі (`pairly_conversations.mode`), а не гілка в
 * графі. Тому й ендпоінт окремий від `/api/pairly/message`: спільний означав би
 * прапорець «а тепер не клич модель», який колись прийшов би зі значенням не
 * тим.
 *
 * `mode` стає `human`, а `escalated_at` НЕ чіпається: факт ескалації —
 * назавжди факт про розмову, а не незакрите питання, яке знімається відповіддю.
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
  if (!isAgentId(body.agentId)) return jsonError("потрібен agentId", 400);

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return jsonError("напишіть відповідь", 400);
  if (text.length > PAIRLY_MAX_QUERY) {
    return jsonError(`задовга відповідь — до ${PAIRLY_MAX_QUERY} символів`, 400);
  }

  try {
    const conversation = await loadConversation(conversationId);
    if (!conversation) return jsonError("розмову не знайдено", 404);
    if (conversation.status === "closed") {
      return jsonError("розмову закрито — писати в неї вже не можна", 409);
    }

    await insertAgentTurn({ conversationId, agentId: body.agentId, text });
    await assignAgent(conversationId, body.agentId);

    return NextResponse.json({
      conversationId,
      messages: await loadMessages(conversationId),
    });
  } catch (error) {
    console.error("[pairly] agent-reply", error);
    return jsonError("не вдалося записати відповідь", 500);
  }
}
