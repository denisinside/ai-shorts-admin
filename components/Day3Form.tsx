"use client";

import { useActionState } from "react";
import { createDay3Article, updateDay3Article } from "@/app/actions/day3";
import { initialFormState } from "@/lib/form-state";
import {
  toJsonText,
  toJsonTextOrEmpty,
  toMetrics,
  type Day3Article,
} from "@/lib/day-tables";
import { Field, TextField, Textarea } from "./ui/Field";
import { JsonTextarea } from "./ui/JsonTextarea";
import { FormFooter } from "./ui/FormFooter";

export default function Day3Form({
  projectId,
  record,
}: {
  projectId: string;
  record?: Day3Article | null;
}) {
  const action = record
    ? updateDay3Article.bind(null, projectId, record.id)
    : createDay3Article.bind(null, projectId);

  const [state, formAction, pending] = useActionState(action, initialFormState);

  const metrics = toMetrics(record?.metrics);
  // Токени показуємо окремим полем, а решту metrics — як JSON: усе інше
  // пише воркфлоу, а це єдина цифра, яку доводиться переносити руками.
  const tokensDefault =
    typeof metrics?.tokens_total === "number" ? String(metrics.tokens_total) : "";

  return (
    <form action={formAction} className="space-y-5">
      <TextField
        label="Run ID"
        name="run_id"
        required
        defaultValue={state.values?.run_id ?? record?.run_id ?? ""}
        hint="Формат — у контракті §9"
        className="field-mono"
      />

      <TextField
        label="ID плану Дня 2"
        name="day2_plan_id"
        defaultValue={
          state.values?.day2_plan_id ?? record?.day2_plan_id ?? ""
        }
        hint="За яким планом писали — без нього стаття ні з чим не звіряється"
        className="field-mono"
      />

      {/* ---------------------------------------------- блок вступу */}
      <TextField
        label="Заголовок H1"
        name="title"
        required
        defaultValue={state.values?.title ?? record?.title ?? ""}
        hint="Заголовок сторінки для читача — не seo_title і не робоча назва плану"
      />

      <TextField
        label="URL обкладинки"
        name="thumbnail_url"
        type="url"
        inputMode="url"
        placeholder="https://…/storage/v1/object/public/article-images/…"
        defaultValue={
          state.values?.thumbnail_url ?? record?.thumbnail_url ?? ""
        }
      />

      <Field
        label="Текст вступу"
        htmlFor="intro"
        hint="Markdown, БЕЗ власного заголовка — H1 уже є окремим полем"
      >
        <Textarea
          id="intro"
          name="intro"
          rows={6}
          required
          defaultValue={state.values?.intro ?? record?.intro ?? ""}
        />
      </Field>

      {/* ---------------------------------------------- тіло */}
      <JsonTextarea
        name="sections"
        label="Розділи (JSON)"
        rows={16}
        defaultValue={state.values?.sections ?? toJsonText(record?.sections)}
        hint="[{h2, body_md, image_url, image_prompt, image_alt, words, source_urls, plan_index}] — по одному на розділ outline"
      />

      {/* ---------------------------------------------- висновок */}
      <TextField
        label="Заголовок висновку"
        name="conclusion_h2"
        required
        defaultValue={
          state.values?.conclusion_h2 ?? record?.conclusion_h2 ?? ""
        }
      />

      <Field
        label="Текст висновку"
        htmlFor="conclusion"
        hint="Без підрозділів і без картинки — така його форма"
      >
        <Textarea
          id="conclusion"
          name="conclusion"
          rows={6}
          required
          defaultValue={state.values?.conclusion ?? record?.conclusion ?? ""}
        />
      </Field>

      <TextField
        label="CTA"
        name="cta"
        defaultValue={state.values?.cta ?? record?.cta ?? ""}
        hint="З outline.cta Дня 2"
      />

      {/* ---------------------------------------------- мета й метрики */}
      <JsonTextarea
        name="seo"
        label="SEO (JSON)"
        rows={8}
        defaultValue={state.values?.seo ?? toJsonTextOrEmpty(record?.seo)}
        hint="{seo_title, meta_description, slug, og_title, og_description, keywords[]}"
      />

      <TextField
        label="Токени прогону"
        name="tokens_total"
        inputMode="numeric"
        defaultValue={state.values?.tokens_total ?? tokensDefault}
        hint="З Dify Logs (шукай ран за run_id): воркфлоу не бачить власного споживання токенів. Вливається в metrics.tokens_total"
        className="field-mono"
      />

      <JsonTextarea
        name="metrics"
        label="Метрики (JSON)"
        rows={10}
        defaultValue={state.values?.metrics ?? toJsonTextOrEmpty(record?.metrics)}
        hint="Пише воркфлоу: elapsed_ms, llm_calls, models, rewrites, quality. Правити руками зазвичай не треба"
      />

      <FormFooter
        error={state?.error}
        pending={pending}
        submitLabel={record ? "Зберегти зміни" : "Створити статтю"}
        cancelHref={`/projects/${projectId}`}
      />
    </form>
  );
}
