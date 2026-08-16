"use client";

import { useActionState } from "react";
import { createDay3Assets, updateDay3Assets } from "@/app/actions/day3";
import { initialFormState } from "@/lib/form-state";
import {
  toJsonText,
  toJsonTextOrEmpty,
  type Day3Assets,
} from "@/lib/day-tables";
import { Field, TextField, Textarea } from "./ui/Field";
import { JsonTextarea } from "./ui/JsonTextarea";
import { FormFooter } from "./ui/FormFooter";

export default function Day3Form({
  projectId,
  record,
}: {
  projectId: string;
  record?: Day3Assets | null;
}) {
  const action = record
    ? updateDay3Assets.bind(null, projectId, record.id)
    : createDay3Assets.bind(null, projectId);

  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      <TextField
        label="Run ID"
        name="run_id"
        required
        defaultValue={state.values?.run_id ?? record?.run_id ?? ""}
        hint="Ідентифікатор запуску пайплайну"
        className="field-mono"
      />

      <Field
        label="Текст статті"
        htmlFor="script"
        hint="Markdown; пишеться по розділах outline із Дня 2"
      >
        <Textarea
          id="script"
          name="script"
          rows={14}
          required
          defaultValue={state.values?.script ?? record?.script ?? ""}
        />
      </Field>

      <JsonTextarea
        name="hook_variants"
        label="Варіанти вступу (JSON)"
        rows={8}
        defaultValue={
          state.values?.hook_variants ?? toJsonText(record?.hook_variants)
        }
        hint="Обрані з гачків Дня 2 і дописані до повного абзацу"
      />

      <JsonTextarea
        name="shot_hints"
        label="Підказки ілюстрацій (JSON)"
        rows={8}
        defaultValue={
          state.values?.shot_hints ?? toJsonTextOrEmpty(record?.shot_hints)
        }
        hint="По одній на розділ outline — промпт або опис зображення"
      />

      <TextField
        label="URL обкладинки"
        name="thumbnail_url"
        type="url"
        inputMode="url"
        placeholder="https://…"
        defaultValue={
          state.values?.thumbnail_url ?? record?.thumbnail_url ?? ""
        }
      />

      <FormFooter
        error={state?.error}
        pending={pending}
        submitLabel={record ? "Зберегти зміни" : "Створити запис"}
        cancelHref={`/projects/${projectId}`}
      />
    </form>
  );
}
