"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase";
import {
  parseJsonField,
  parseOptionalIndex,
  parseOptionalUuid,
  parseRequiredJsonField,
} from "@/lib/json-field";
import type { FormState } from "@/lib/form-state";

type BuildResult =
  | { ok: true; values: Record<string, string>; data: Record<string, unknown> }
  | { ok: false; values: Record<string, string>; error: string };

function buildPayload(formData: FormData): BuildResult {
  const values = {
    run_id: String(formData.get("run_id") ?? ""),
    hook_formats: String(formData.get("hook_formats") ?? ""),
    approved_by: String(formData.get("approved_by") ?? ""),
    approved: formData.get("approved") === "on" ? "on" : "",
    fallback_used: formData.get("fallback_used") === "on" ? "on" : "",
    fallback_reason: String(formData.get("fallback_reason") ?? ""),
    needs_review: formData.get("needs_review") === "on" ? "on" : "",
    review_reason: String(formData.get("review_reason") ?? ""),
    discord_message_id: String(formData.get("discord_message_id") ?? ""),
    day1_trends_id: String(formData.get("day1_trends_id") ?? ""),
    trend_index: String(formData.get("trend_index") ?? ""),
    selected_trend: String(formData.get("selected_trend") ?? ""),
    outline: String(formData.get("outline") ?? ""),
  };

  const runId = values.run_id.trim();
  if (!runId) return { ok: false, values, error: "Run ID обовʼязковий" };

  // NOT NULL у базі — порожнє поле має стати [], а не null
  const hookFormats = parseRequiredJsonField(
    formData.get("hook_formats"),
    "Гачки",
  );
  if (hookFormats.error) return { ok: false, values, error: hookFormats.error };

  const selectedTrend = parseJsonField(
    formData.get("selected_trend"),
    "Обрана тема",
  );
  if (selectedTrend.error) {
    return { ok: false, values, error: selectedTrend.error };
  }

  const outline = parseJsonField(formData.get("outline"), "Структура статті");
  if (outline.error) return { ok: false, values, error: outline.error };

  const day1Id = parseOptionalUuid(
    formData.get("day1_trends_id"),
    "ID запису Дня 1",
  );
  if (day1Id.error) return { ok: false, values, error: day1Id.error };

  const trendIndex = parseOptionalIndex(
    formData.get("trend_index"),
    "Індекс теми",
  );
  if (trendIndex.error) return { ok: false, values, error: trendIndex.error };

  const approvedBy = values.approved_by.trim();

  return {
    ok: true,
    values,
    data: {
      run_id: runId,
      hook_formats: hookFormats.value,
      approved: values.approved === "on",
      approved_by: approvedBy || null,
      fallback_used: values.fallback_used === "on",
      // Порожнє поле — це null, а не "": інакше в базі осідають пусті рядки,
      // і `review_reason is not null` перестає означати «є що перевірити».
      fallback_reason: values.fallback_reason.trim() || null,
      needs_review: values.needs_review === "on",
      review_reason: values.review_reason.trim() || null,
      discord_message_id: values.discord_message_id.trim() || null,
      day1_trends_id: day1Id.value,
      trend_index: trendIndex.value,
      selected_trend: selectedTrend.value,
      outline: outline.value,
    },
  };
}

export async function createDay2Plan(
  projectId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day2_plan")
    .insert({ project_id: projectId, ...built.data });

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateDay2Plan(
  projectId: string,
  recordId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day2_plan")
    .update(built.data)
    .eq("id", recordId);

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function deleteDay2Plan(projectId: string, recordId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("day2_plan")
    .delete()
    .eq("id", recordId);

  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

/**
 * HITL-гейт другого дня, панельна половина. Друга половина — кнопки в Discord
 * (`app/api/discord/interactions`), і обидві пишуть у ті самі колонки.
 *
 * `.is("decided_at", null)` — той самий атомарний guard, що й у воркфлоу: умова
 * стоїть у фільтрі запиту, тож рішення ухвалює той, хто натиснув першим, а
 * другий клік (хоч у панелі, хоч у Discord) не оновлює нічого.
 */
export async function approvePlan(projectId: string, recordId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("day2_plan")
    // Затвердження людиною знімає `needs_review`: питання закрите.
    // `fallback_used` і `fallback_reason` лишаються — це факт про те, на чому
    // будувався план, а не невирішена задача.
    .update({
      approved: true,
      approved_by: "admin",
      needs_review: false,
      decided_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .eq("project_id", projectId)
    .is("decided_at", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.length) {
    throw new Error(
      "Рішення по цьому плану вже ухвалене — онови сторінку, щоб побачити його",
    );
  }

  // Просуваємо статус проєкту, але ніколи не назад: якщо він уже 'produced'
  // чи 'rendered', затвердження плану не має його відкочувати.
  const { error: statusError } = await supabase
    .from("projects")
    .update({ status: "planned", updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .in("status", ["created", "researched"]);

  if (statusError) {
    throw new Error(statusError.message);
  }

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Відхилення плану. Робота не видаляється: рядок лишається чернеткою з
 * `needs_review`, бо кейс вимагає позначати проблемне, а не викидати його.
 * `approved_by` тут читається як «хто ухвалив рішення» — дивись `approved`.
 * Статус проєкту не рухається: відхилений план нічого не спланував.
 */
export async function rejectPlan(projectId: string, recordId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("day2_plan")
    .update({
      approved: false,
      approved_by: "admin",
      needs_review: true,
      decided_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .eq("project_id", projectId)
    .is("decided_at", null)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error(
      "Рішення по цьому плану вже ухвалене — онови сторінку, щоб побачити його",
    );
  }

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
}
