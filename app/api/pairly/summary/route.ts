import { NextResponse } from "next/server";

import { askPairlySummary, pairlyConfig, pairlyDiagnostics } from "@/lib/pairly";
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
import { insertHandoff, loadConversation } from "../_db";

/**
 * Кнопка «Самарайз» у тех. сапорта: воркфлоу `pairly-handoff-summary`.
 *
 * Окрема апка й окремий ключ, бо вижимка — не розмова: публікувати в Service
 * API і перевикористовувати як інструмент можна лише User-Input-воркфлоу.
 * Звідси й інший ендпоінт Dify (`/workflows/run`) та результат у
 * `data.outputs`, а не в `answer`.
 *
 * Результат пишеться в `pairly_handoffs` — БАГАТО рядків на розмову, кожен клік
 * свій. Причина та сама, що в Дні 3: людина ухвалює рішення по конкретній
 * вижимці, і перезапис зробив би попередню недосяжною разом із рішенням.
 *
 * Запис у базу не блокує відповідь: вижимку віддаємо навіть якщо `insert`
 * упав — на екрані вона потрібніша, ніж в архіві.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = pairlyConfig();
  const problems = envProblems(
    cfg.summaryKey ? [] : ["DIFY_PAIRLY_SUMMARY_API_KEY не заданий — «Самарайз» не працюватиме"],
  );
  return NextResponse.json({
    endpoint: "pairly summary",
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
    cfg.summaryKey ? [] : ["DIFY_PAIRLY_SUMMARY_API_KEY не заданий"],
  );
  if (problems.length > 0) return envFailure(problems);

  const body = await readJsonBody(request);
  if (!body) return jsonError("не зрозумів запит", 400);

  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  if (!isUuid(conversationId)) return jsonError("conversationId має бути uuid", 400);

  // Хто натиснув. Не обов'язково: вижимку можна замовити й до того, як розмову
  // взяли, — тоді автора фіксуємо як стіл, а не як конкретну людину.
  const generatedBy = isAgentId(body.agentId) ? body.agentId : "desk";

  try {
    const conversation = await loadConversation(conversationId);
    if (!conversation) return jsonError("розмову не знайдено", 404);

    const summary = await askPairlySummary(conversationId);
    if ("error" in summary) return jsonError(summary.error, 502);

    try {
      await insertHandoff({
        conversationId,
        summaryMd: summary.summaryMd,
        payload: summary.handoff,
        generatedBy,
      });
    } catch (error) {
      console.error("[pairly] summary insert", error);
    }

    return NextResponse.json({
      conversationId,
      summaryMd: summary.summaryMd,
      handoff: summary.handoff,
    });
  } catch (error) {
    console.error("[pairly] summary", error);
    return jsonError("не вдалося скласти вижимку", 500);
  }
}
