"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createDay4Video, updateDay4Video } from "@/app/actions/day4";
import { initialFormState } from "@/lib/form-state";
import type { Day4Video } from "@/lib/day-tables";

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

  const [state, formAction, pending] = useActionState(
    action,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label
          htmlFor="run_id"
          className="block text-sm font-medium text-gray-700"
        >
          Run ID
        </label>
        <input
          id="run_id"
          name="run_id"
          type="text"
          required
          defaultValue={state.values?.run_id ?? record?.run_id ?? ""}
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="shotlist"
          className="block text-sm font-medium text-gray-700"
        >
          Shotlist (JSON)
        </label>
        <textarea
          id="shotlist"
          name="shotlist"
          rows={10}
          defaultValue={
            state.values?.shotlist ??
            JSON.stringify(record?.shotlist ?? [], null, 2)
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="video_url"
          className="block text-sm font-medium text-gray-700"
        >
          Video URL
        </label>
        <input
          id="video_url"
          name="video_url"
          type="text"
          defaultValue={state.values?.video_url ?? record?.video_url ?? ""}
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="voiceover_url"
          className="block text-sm font-medium text-gray-700"
        >
          Voiceover URL
        </label>
        <input
          id="voiceover_url"
          name="voiceover_url"
          type="text"
          defaultValue={
            state.values?.voiceover_url ?? record?.voiceover_url ?? ""
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium text-gray-700"
        >
          Status
        </label>
        <input
          id="status"
          name="status"
          type="text"
          required
          defaultValue={
            state.values?.status ?? record?.status ?? "rendered"
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="knowledge_refs"
          className="block text-sm font-medium text-gray-700"
        >
          Knowledge refs (JSON)
        </label>
        <textarea
          id="knowledge_refs"
          name="knowledge_refs"
          rows={6}
          defaultValue={
            state.values?.knowledge_refs ??
            JSON.stringify(record?.knowledge_refs ?? [], null, 2)
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      {state?.error && (
        <p className="text-sm font-medium text-red-600">{state.error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
        >
          {record ? "Save changes" : "Create record"}
        </button>
        <Link
          href={`/projects/${projectId}`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
