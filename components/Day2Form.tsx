"use client";

import { useActionState } from "react";
import { createDay2Plan, updateDay2Plan } from "@/app/actions/day2";
import { initialFormState } from "@/lib/form-state";
import {
  toJsonText,
  toJsonTextOrEmpty,
  type Day2Plan,
} from "@/lib/day-tables";
import { Checkbox, Field, Textarea, TextField } from "./ui/Field";
import { JsonTextarea } from "./ui/JsonTextarea";
import { FormFooter } from "./ui/FormFooter";

export default function Day2Form({
  projectId,
  record,
}: {
  projectId: string;
  record?: Day2Plan | null;
}) {
  const action = record
    ? updateDay2Plan.bind(null, projectId, record.id)
    : createDay2Plan.bind(null, projectId);

  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      <TextField
        label="Run ID"
        name="run_id"
        required
        defaultValue={state.values?.run_id ?? record?.run_id ?? ""}
        hint="Формат: day2-blog-YYYYMMDD-HHMMSS-slug"
        className="field-mono"
      />

      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <TextField
          label="ID запису Дня 1"
          name="day1_trends_id"
          defaultValue={
            state.values?.day1_trends_id ?? record?.day1_trends_id ?? ""
          }
          hint="UUID рядка day1_trends, звідки взято тему"
          className="field-mono"
        />
        <TextField
          label="Індекс теми"
          name="trend_index"
          inputMode="numeric"
          defaultValue={
            state.values?.trend_index ??
            (record?.trend_index != null ? String(record.trend_index) : "")
          }
          hint="позиція в trends[]"
          className="field-mono"
        />
      </div>

      <JsonTextarea
        name="selected_trend"
        label="Обрана тема (JSON)"
        rows={10}
        defaultValue={
          state.values?.selected_trend ??
          toJsonTextOrEmpty(record?.selected_trend)
        }
        hint="Знімок теми з Дня 1 — саме його читає День 3"
      />

      <JsonTextarea
        name="outline"
        label="Структура статті (JSON)"
        rows={16}
        defaultValue={
          state.values?.outline ?? toJsonTextOrEmpty(record?.outline)
        }
        hint="working_title, primary_keyword, sections[] з key_points і target_words"
      />

      <JsonTextarea
        name="hook_formats"
        label="Гачки (JSON)"
        rows={10}
        defaultValue={
          state.values?.hook_formats ?? toJsonText(record?.hook_formats)
        }
        hint="Масив із 3 обʼєктів: type, text, rationale"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Хто ухвалив рішення"
          name="approved_by"
          defaultValue={state.values?.approved_by ?? record?.approved_by ?? ""}
          hint="При «відхилено» — той, хто відхилив"
        />
        <TextField
          label="ID повідомлення в Discord"
          name="discord_message_id"
          defaultValue={
            state.values?.discord_message_id ??
            record?.discord_message_id ??
            ""
          }
          hint="Заповнює воркфлоу; потрібне, щоб перемалювати картку"
          className="field-mono"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Checkbox
          name="approved"
          label="Затверджено"
          defaultChecked={
            state.values
              ? state.values.approved === "on"
              : (record?.approved ?? false)
          }
        />
        <Checkbox
          name="needs_review"
          label="Потребує перевірки"
          defaultChecked={
            state.values
              ? state.values.needs_review === "on"
              : (record?.needs_review ?? false)
          }
        />
        <Checkbox
          name="fallback_used"
          label="Використано fallback"
          defaultChecked={
            state.values
              ? state.values.fallback_used === "on"
              : (record?.fallback_used ?? false)
          }
        />
      </div>

      <Field
        label="Що перевірити"
        htmlFor="review_reason"
        hint="Заповнює День 2, коли план не пройшов перевірок або людина відправила його на доопрацювання"
      >
        <Textarea
          id="review_reason"
          name="review_reason"
          rows={3}
          defaultValue={
            state.values?.review_reason ?? record?.review_reason ?? ""
          }
        />
      </Field>

      <Field
        label="Причина fallback"
        htmlFor="fallback_reason"
        hint="Яка саме умова спрацювала: немає джерел, тема неперевірена, більшість розділів без джерел"
      >
        <Textarea
          id="fallback_reason"
          name="fallback_reason"
          rows={2}
          defaultValue={
            state.values?.fallback_reason ?? record?.fallback_reason ?? ""
          }
        />
      </Field>

      <FormFooter
        error={state?.error}
        pending={pending}
        submitLabel={record ? "Зберегти зміни" : "Створити запис"}
        cancelHref={`/projects/${projectId}`}
      />
    </form>
  );
}
