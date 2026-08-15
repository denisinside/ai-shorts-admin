"use client";

import { useActionState } from "react";
import { createDay1Trends, updateDay1Trends } from "@/app/actions/day1";
import { initialFormState } from "@/lib/form-state";
import { toJsonText, type Day1Trends } from "@/lib/day-tables";
import { TextField } from "./ui/Field";
import { JsonTextarea } from "./ui/JsonTextarea";
import { FormFooter } from "./ui/FormFooter";

export default function Day1Form({
  projectId,
  record,
}: {
  projectId: string;
  record?: Day1Trends | null;
}) {
  const action = record
    ? updateDay1Trends.bind(null, projectId, record.id)
    : createDay1Trends.bind(null, projectId);

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
        name="trends"
        label="Тренди (JSON)"
        rows={12}
        defaultValue={state.values?.trends ?? toJsonText(record?.trends)}
        hint="Масив обʼєктів: title, format, hashtags, hook_idea, description"
      />

      <JsonTextarea
        name="sources"
        label="Джерела (JSON)"
        rows={6}
        defaultValue={state.values?.sources ?? toJsonText(record?.sources)}
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
