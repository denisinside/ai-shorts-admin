"use client";

import { useActionState } from "react";
import { createDay2Plan, updateDay2Plan } from "@/app/actions/day2";
import { initialFormState } from "@/lib/form-state";
import { toJsonText, type Day2Plan } from "@/lib/day-tables";
import { Checkbox, TextField } from "./ui/Field";
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
        hint="Ідентифікатор запуску пайплайну"
        className="field-mono"
      />

      <JsonTextarea
        name="hook_formats"
        label="Формати гачків (JSON)"
        rows={10}
        defaultValue={
          state.values?.hook_formats ?? toJsonText(record?.hook_formats)
        }
      />

      <TextField
        label="Хто затвердив"
        name="approved_by"
        defaultValue={state.values?.approved_by ?? record?.approved_by ?? ""}
      />

      <div className="grid gap-2 sm:grid-cols-2">
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
          name="fallback_used"
          label="Використано fallback"
          defaultChecked={
            state.values
              ? state.values.fallback_used === "on"
              : (record?.fallback_used ?? false)
          }
        />
      </div>

      <FormFooter
        error={state?.error}
        pending={pending}
        submitLabel={record ? "Зберегти зміни" : "Створити запис"}
        cancelHref={`/projects/${projectId}`}
      />
    </form>
  );
}
