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
 * HITL-гейт другого дня. Затверджує РІВНО один план: раніше фільтр стояв на
 * project_id, тож один клік позначав схваленими всі запуски проєкту.
 */
export async function approvePlan(projectId: string, recordId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("day2_plan")
    .update({ approved: true, approved_by: "admin" })
    .eq("id", recordId)
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
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
