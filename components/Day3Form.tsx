"use client";

import { useActionState } from "react";
import { createDay3Assets, updateDay3Assets } from "@/app/actions/day3";
import { initialFormState } from "@/lib/form-state";
import { toJsonText, type Day3Assets } from "@/lib/day-tables";
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

      <Field label="Сценарій" htmlFor="script">
        <Textarea
          id="script"
          name="script"
          rows={10}
          required
          defaultValue={state.values?.script ?? record?.script ?? ""}
        />
      </Field>

      <JsonTextarea
        name="hook_variants"
        label="Варіанти гачків (JSON)"
        rows={8}
        defaultValue={
          state.values?.hook_variants ?? toJsonText(record?.hook_variants)
        }
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
