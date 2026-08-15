"use client";

import { useActionState } from "react";
import { createDay4Video, updateDay4Video } from "@/app/actions/day4";
import { initialFormState } from "@/lib/form-state";
import { toJsonText, type Day4Video } from "@/lib/day-tables";
import { TextField } from "./ui/Field";
import { JsonTextarea } from "./ui/JsonTextarea";
import { FormFooter } from "./ui/FormFooter";

export default function Day4Form({
  projectId,
  record,
}: {
  projectId: string;
  record?: Day4Video | null;
}) {
  const action = record
    ? updateDay4Video.bind(null, projectId, record.id)
    : createDay4Video.bind(null, projectId);

  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Run ID"
          name="run_id"
          required
          defaultValue={state.values?.run_id ?? record?.run_id ?? ""}
          hint="Ідентифікатор запуску пайплайну"
          className="field-mono"
        />
        <TextField
          label="Статус"
          name="status"
          required
          defaultValue={state.values?.status ?? record?.status ?? "rendered"}
        />
      </div>

      <JsonTextarea
        name="shotlist"
        label="Шотліст (JSON)"
        rows={10}
        defaultValue={state.values?.shotlist ?? toJsonText(record?.shotlist)}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="URL відео"
          name="video_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          defaultValue={state.values?.video_url ?? record?.video_url ?? ""}
        />
        <TextField
          label="URL озвучки"
          name="voiceover_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          defaultValue={
            state.values?.voiceover_url ?? record?.voiceover_url ?? ""
          }
        />
      </div>

      <JsonTextarea
        name="knowledge_refs"
        label="Посилання на знання (JSON)"
        rows={6}
        defaultValue={
          state.values?.knowledge_refs ?? toJsonText(record?.knowledge_refs)
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
