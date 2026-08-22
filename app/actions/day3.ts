"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase";
import {
  parseJsonField,
  parseOptionalUuid,
  parseRequiredJsonField,
} from "@/lib/json-field";
import type { FormState } from "@/lib/form-state";

type BuildResult =
  | { ok: true; values: Record<string, string>; data: Record<string, unknown> }
  | { ok: false; values: Record<string, string>; error: string };

/** Значення колонки `pipeline` — той самий словник, що в CHECK бази. */
const PIPELINES = ["baseline", "optimized"] as const;

function buildPayload(formData: FormData): BuildResult {
  const values = {
    run_id: String(formData.get("run_id") ?? ""),
    day2_plan_id: String(formData.get("day2_plan_id") ?? ""),
    pipeline: String(formData.get("pipeline") ?? "baseline"),
    variant: String(formData.get("variant") ?? ""),
    title: String(formData.get("title") ?? ""),
    thumbnail_url: String(formData.get("thumbnail_url") ?? ""),
    intro: String(formData.get("intro") ?? ""),
    sections: String(formData.get("sections") ?? ""),
    conclusion_h2: String(formData.get("conclusion_h2") ?? ""),
    conclusion: String(formData.get("conclusion") ?? ""),
    cta: String(formData.get("cta") ?? ""),
    seo: String(formData.get("seo") ?? ""),
    metrics: String(formData.get("metrics") ?? ""),
    tokens_total: String(formData.get("tokens_total") ?? ""),
  };

  const runId = values.run_id.trim();
  if (!runId) return { ok: false, values, error: "Run ID обовʼязковий" };

  const title = values.title.trim();
  if (!title) return { ok: false, values, error: "Заголовок H1 обовʼязковий" };

  if (!values.intro.trim()) {
    return { ok: false, values, error: "Текст вступу обовʼязковий" };
  }

  const conclusionH2 = values.conclusion_h2.trim();
  if (!conclusionH2) {
    return { ok: false, values, error: "Заголовок висновку обовʼязковий" };
  }
  if (!values.conclusion.trim()) {
    return { ok: false, values, error: "Текст висновку обовʼязковий" };
  }

  // CHECK у базі відхилив би чуже значення сирою помилкою драйвера
  if (!(PIPELINES as readonly string[]).includes(values.pipeline)) {
    return {
      ok: false,
      values,
      error: `Пайплайн має бути ${PIPELINES.join(" або ")}`,
    };
  }

  // NOT NULL у базі — порожнє поле має стати [], а не null
  const sections = parseRequiredJsonField(
    formData.get("sections"),
    "Розділи",
  );
  if (sections.error) return { ok: false, values, error: sections.error };

  const seo = parseJsonField(formData.get("seo"), "SEO");
  if (seo.error) return { ok: false, values, error: seo.error };

  const metrics = parseJsonField(formData.get("metrics"), "Метрики");
  if (metrics.error) return { ok: false, values, error: metrics.error };

  const planId = parseOptionalUuid(
    formData.get("day2_plan_id"),
    "ID плану Дня 2",
  );
  if (planId.error) return { ok: false, values, error: planId.error };

  // Токени — єдина цифра, яку вводить людина: воркфлоу не бачить власного
  // споживання токенів, тому вона переноситься з Dify Logs. Вливаємо її в
  // metrics, а не в окрему колонку, щоб уся телеметрія лишалася в одному місці.
  const rawTokens = values.tokens_total.trim();
  let tokensTotal: number | null = null;
  if (rawTokens) {
    const parsed = Number(rawTokens);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return {
        ok: false,
        values,
        error: "Токени мають бути цілим числом ≥ 0",
      };
    }
    tokensTotal = parsed;
  }

  const metricsValue =
    metrics.value && typeof metrics.value === "object"
      ? { ...(metrics.value as Record<string, unknown>) }
      : rawTokens
        ? {}
        : null;
  if (metricsValue && rawTokens) {
    metricsValue.tokens_total = tokensTotal;
  }

  return {
    ok: true,
    values,
    data: {
      run_id: runId,
      day2_plan_id: planId.value,
      pipeline: values.pipeline,
      variant: values.variant.trim() || null,
      title,
      thumbnail_url: values.thumbnail_url.trim() || null,
      intro: values.intro,
      sections: sections.value,
      conclusion_h2: conclusionH2,
      conclusion: values.conclusion,
      cta: values.cta.trim() || null,
      seo: seo.value,
      metrics: metricsValue,
    },
  };
}

export async function createDay3Article(
  projectId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day3_article")
    .insert({ project_id: projectId, ...built.data });

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateDay3Article(
  projectId: string,
  recordId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const built = buildPayload(formData);
  if (!built.ok) return { error: built.error, values: built.values };

  const supabase = createClient();
  const { error } = await supabase
    .from("day3_article")
    .update(built.data)
    .eq("id", recordId)
    .eq("project_id", projectId);

  if (error) return { error: error.message, values: built.values };

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function deleteDay3Article(projectId: string, recordId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("day3_article")
    .delete()
    .eq("id", recordId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

/**
 * Затвердження статті. Фільтр по `id`, а не по `project_id`: статей у проєкту
 * багато (baseline, optimized, ітерації), і затверджується рівно та, на яку
 * натиснули.
 *
 * `.is("decided_at", null)` — той самий атомарний guard, що у воркфлоу: між
 * читанням і записом лишалося б вікно, у фільтрі його немає. Порожня відповідь
 * означає, що рішення вже ухвалене — кнопкою в Discord або в іншій вкладці.
 */
export async function approveArticle(projectId: string, recordId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("day3_article")
    // Затвердження людиною знімає `needs_review`: питання закрите.
    // `fallback_used` лишається — це факт про прогін, а не невирішена задача.
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

  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error(
      "Рішення по цій статті вже ухвалене — онови сторінку, щоб побачити його",
    );
  }

  // Просуваємо статус, але ніколи не назад: якщо проєкт уже 'rendered',
  // затвердження статті не має його відкочувати.
  const { error: statusError } = await supabase
    .from("projects")
    .update({ status: "produced", updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .in("status", ["created", "researched", "planned"]);

  if (statusError) throw new Error(statusError.message);

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Відхилення. Стаття не видаляється: лишається чернеткою з `needs_review`,
 * бо кейс вимагає позначати проблемне, а не викидати. Статус проєкту не
 * рухається — відхилена стаття нічого не спродюсувала.
 */
export async function rejectArticle(projectId: string, recordId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("day3_article")
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
      "Рішення по цій статті вже ухвалене — онови сторінку, щоб побачити його",
    );
  }

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
}
