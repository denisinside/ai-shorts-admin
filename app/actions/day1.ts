"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase";
import { parseJsonField } from "@/lib/json-field";
import type { FormState } from "@/lib/form-state";

type BuildResult =
  | { ok: true; values: Record<string, string>; data: Record<string, unknown> }
  | { ok: false; values: Record<string, string>; error: string };

function buildPayload(formData: FormData): BuildResult {
  const values = {
    run_id: String(formData.get("run_id") ?? ""),
    trends: String(formData.get("trends") ?? ""),
    sources: String(formData.get("sources") ?? ""),
  };

  const runId = values.run_id.trim();
  if (!runId) return { ok: false, values, error: "Run ID is required" };

  const trends = parseJsonField(formData.get("trends"), "trends");
  if (trends.error) return { ok: false, values, error: trends.error };

  const sources = parseJsonField(formData.get("sources"), "sources");
  if (sources.error) return { ok: false, values, error: sources.error };

  return {
    ok: true,
    values,
    data: { run_id: runId, trends: trends.value, sources: sources.value },
  };
}

export async function createDay1Trends(
  projectId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day1_trends")
    .insert({ project_id: projectId, ...built.data });

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateDay1Trends(
  projectId: string,
  recordId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day1_trends")
    .update(built.data)
    .eq("id", recordId);

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function deleteDay1Trends(projectId: string, recordId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("day1_trends")
    .delete()
    .eq("id", recordId);

  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
