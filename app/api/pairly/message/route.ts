import { NextResponse } from "next/server";

import {
  askPairly,
  pairlyConfig,
  pairlyDiagnostics,
  PAIRLY_MAX_QUERY,
} from "@/lib/pairly";
import {
  clientIp,
  envFailure,
  envProblems,
  isUserId,
  isUuid,
  jsonError,
  rateLimited,
  readJsonBody,
} from "../_http";
import {
  createConversation,
  insertBotTurn,
  insertUserTurn,
  loadConversation,
  loadMessages,
  markEscalated,
  tagUserTurn,
  touchConversation,
} from "../_db";

/**
 * Хід користувача: у базу, у chatflow, і знову в базу.
 *
 * ПОРЯДОК ЗАПИСУ ТУТ — НЕ ДЕТАЛЬ РЕАЛІЗАЦІЇ. Хід користувача пишеться ПЕРШИМ,
 * до виклику Dify, і його `id` їде в граф як `turn_id`. Дві причини:
 *
 *  1. Прогін триває 8-15 секунд. Якщо Dify не відповість або людина закриє
 *     вкладку, хід мусить лишитися в базі — інакше тех. сапорт побачить
 *     розмову без того повідомлення, на яке вона й скаржиться.
 *  2. Нода історії в графі виключає саме цей рядок (`id=neq.<turn_id>`). Без
 *     цього хід порахував би повтором сам себе, і КОЖНЕ друге повідомлення в
 *     розмові їхало б у ескалацію.
 *
 * `nodejs`, бо лічильник ліміту живе в пам'яті процесу; `force-dynamic`, бо
 * відповідь залежить від стану бази й кешувати її не можна ніколи.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Діагностика конфігурації: наявність ключів, не значення. */
export async function GET() {
  const cfg = pairlyConfig();
  const problems = envProblems(
    cfg.chatKey ? [] : ["DIFY_PAIRLY_API_KEY не заданий — агент не відповідатиме"],
  );

  return NextResponse.json({
    endpoint: "pairly message",
    runtime: "nodejs",
    dify: pairlyDiagnostics(),
    ok: problems.length === 0,
    problems,
  });
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return jsonError("занадто багато запитів — спробуйте за хвилину", 429);
  }

  const cfg = pairlyConfig();
  const problems = envProblems(
    cfg.chatKey ? [] : ["DIFY_PAIRLY_API_KEY не заданий"],
  );
  if (problems.length > 0) return envFailure(problems);

  const body = await readJsonBody(request);
  if (!body) return jsonError("не зрозумів запит", 400);

  if (!isUserId(body.userId)) {
    return jsonError("потрібен userId у форматі U001", 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return jsonError("напишіть питання", 400);
  if (text.length > PAIRLY_MAX_QUERY) {
    return jsonError(`задовге питання — до ${PAIRLY_MAX_QUERY} символів`, 400);
  }

  const requested =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  // Не-uuid відсікаємо тут: PostgREST відповів би `22P02`, і в логах це
  // виглядало б як зламана таблиця, а не як зламаний вхід.
  if (requested && !isUuid(requested)) {
    return jsonError("conversationId має бути uuid", 400);
  }

  try {
    let conversation = requested ? await loadConversation(requested) : null;

    if (requested && !conversation) {
      return jsonError("розмову не знайдено", 404);
    }
    if (conversation && conversation.status === "closed") {
      return jsonError("розмову закрито — почніть нову", 409);
    }
    if (conversation && conversation.userId !== body.userId) {
      // Розмова прив'язана до акаунта, і підмінити акаунт у наявній розмові
      // означало б передати чужий транскрипт разом із фактами акаунта.
      return jsonError("розмова належить іншому акаунту", 409);
    }
    if (!conversation) conversation = await createConversation(body.userId);

    const userTurn = await insertUserTurn(conversation.id, text);

    const answer = await askPairly({
      query: text,
      userId: body.userId,
      conversationId: conversation.id,
      turnId: userTurn.id,
    });

    if ("error" in answer) {
      // Хід користувача вже в базі — віддаємо його разом із причиною, щоб чат
      // не виглядав так, ніби повідомлення не надіслалося.
      await touchConversation(conversation.id);
      return NextResponse.json(
        {
          conversationId: conversation.id,
          error: answer.error,
          messages: await loadMessages(conversation.id),
        },
        { status: 502 },
      );
    }

    const envelope = answer.envelope;

    await insertBotTurn({
      conversationId: conversation.id,
      text: answer.reply,
      envelope,
      difyMessageId: answer.difyMessageId,
      latencyMs: answer.latencyMs,
    });

    // Intents ідуть і в хід КОРИСТУВАЧА: правило повтору читає їх саме з
    // `role='user'`, і без цього другий хід ніколи не побачив би повтору.
    if (envelope) await tagUserTurn(userTurn.id, envelope.intents);

    if (envelope?.escalate) {
      // Швидкий шлях для інтерфейсу. Надійний — вебхук `/api/pairly/escalate`,
      // який граф смикає ДО ноди `answer`; фільтр `escalated_at is null`
      // усередині робить обидва шляхи ідемпотентними.
      await markEscalated(conversation.id, envelope.escalation_reason);
    }

    await touchConversation(conversation.id);

    return NextResponse.json({
      conversationId: conversation.id,
      reply: answer.reply,
      envelope,
      messages: await loadMessages(conversation.id),
    });
  } catch (error) {
    console.error("[pairly] message", error);
    return jsonError("не вдалося записати повідомлення", 500);
  }
}
