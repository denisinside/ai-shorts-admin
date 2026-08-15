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
    shotlist: String(formData.get("shotlist") ?? ""),
    video_url: String(formData.get("video_url") ?? ""),
    voiceover_url: String(formData.get("voiceover_url") ?? ""),
    status: String(formData.get("status") ?? ""),
    knowledge_refs: String(formData.get("knowledge_refs") ?? ""),
  };

  const runId = values.run_id.trim();
  if (!runId) return { ok: false, values, error: "Run ID is required" };

  const shotlist = parseJsonField(formData.get("shotlist"), "shotlist");
  if (shotlist.error) return { ok: false, values, error: shotlist.error };

  const knowledgeRefs = parseJsonField(
    formData.get("knowledge_refs"),
    "knowledge_refs",
  );
  if (knowledgeRefs.error) {
    return { ok: false, values, error: knowledgeRefs.error };
  }

  const status = values.status.trim();
  if (!status) return { ok: false, values, error: "Status is required" };

  return {
    ok: true,
    values,
    data: {
      run_id: runId,
      shotlist: shotlist.value,
      video_url: values.video_url.trim() || null,
      voiceover_url: values.voiceover_url.trim() || null,
      status,
      knowledge_refs: knowledgeRefs.value,
    },
  };
}

export async function createDay4Video(
  projectId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day4_video")
    .insert({ project_id: projectId, ...built.data });

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateDay4Video(
  projectId: string,
  recordId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day4_video")
    .update(built.data)
    .eq("id", recordId);

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function deleteDay4Video(projectId: string, recordId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("day4_video")
    .delete()
    .eq("id", recordId);

  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
