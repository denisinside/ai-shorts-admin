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
    hook_formats: String(formData.get("hook_formats") ?? ""),
    approved_by: String(formData.get("approved_by") ?? ""),
    approved: formData.get("approved") === "on" ? "on" : "",
    fallback_used: formData.get("fallback_used") === "on" ? "on" : "",
  };

  const runId = values.run_id.trim();
  if (!runId) return { ok: false, values, error: "Run ID is required" };

  const hookFormats = parseJsonField(
    formData.get("hook_formats"),
    "hook_formats",
  );
  if (hookFormats.error) return { ok: false, values, error: hookFormats.error };

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

export async function approvePlan(projectId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("day2_plan")
    .update({ approved: true, approved_by: "admin" })
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
}
