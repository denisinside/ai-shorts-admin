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
    script: String(formData.get("script") ?? ""),
    hook_variants: String(formData.get("hook_variants") ?? ""),
    thumbnail_url: String(formData.get("thumbnail_url") ?? ""),
  };

  const runId = values.run_id.trim();
  if (!runId) return { ok: false, values, error: "Run ID is required" };

  if (!values.script.trim()) {
    return { ok: false, values, error: "Script is required" };
  }

  const hookVariants = parseJsonField(
    formData.get("hook_variants"),
    "hook_variants",
  );
  if (hookVariants.error) {
    return { ok: false, values, error: hookVariants.error };
  }

  const thumbnailUrl = values.thumbnail_url.trim();

  return {
    ok: true,
    values,
    data: {
      run_id: runId,
      script: values.script,
      hook_variants: hookVariants.value,
      thumbnail_url: thumbnailUrl || null,
    },
  };
}

export async function createDay3Assets(
  projectId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day3_assets")
    .insert({ project_id: projectId, ...built.data });

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateDay3Assets(
  projectId: string,
  recordId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day3_assets")
    .update(built.data)
    .eq("id", recordId);

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function deleteDay3Assets(projectId: string, recordId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("day3_assets")
    .delete()
    .eq("id", recordId);

  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
