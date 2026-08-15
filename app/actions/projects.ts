"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase";
import { PLATFORMS, STATUSES, type Platform, type Status } from "@/lib/projects";

function parsePlatform(value: FormDataEntryValue | null): Platform {
  if (typeof value === "string" && (PLATFORMS as readonly string[]).includes(value)) {
    return value as Platform;
  }
  throw new Error(`Invalid platform: ${String(value)}`);
}

function parseStatus(value: FormDataEntryValue | null): Status {
  if (typeof value === "string" && (STATUSES as readonly string[]).includes(value)) {
    return value as Status;
  }
  throw new Error(`Invalid status: ${String(value)}`);
}

function parseNiche(value: FormDataEntryValue | null): string {
  const niche = typeof value === "string" ? value.trim() : "";
  if (!niche) {
    throw new Error("Niche is required");
  }
  return niche;
}

export async function createProject(formData: FormData) {
  const niche = parseNiche(formData.get("niche"));
  const platform = parsePlatform(formData.get("platform"));
  const status = parseStatus(formData.get("status"));

  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .insert({ niche, platform, status });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  redirect("/");
}

export async function updateProject(id: string, formData: FormData) {
  const niche = parseNiche(formData.get("niche"));
  const platform = parsePlatform(formData.get("platform"));
  const status = parseStatus(formData.get("status"));

  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({ niche, platform, status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  redirect("/");
}

export async function deleteProject(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}
