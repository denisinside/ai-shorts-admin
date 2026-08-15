"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createDay1Trends, updateDay1Trends } from "@/app/actions/day1";
import { initialFormState } from "@/lib/form-state";
import type { Day1Trends } from "@/lib/day-tables";

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
          htmlFor="trends"
          className="block text-sm font-medium text-gray-700"
        >
          Trends (JSON)
        </label>
        <textarea
          id="trends"
          name="trends"
          rows={12}
          defaultValue={
            state.values?.trends ??
            JSON.stringify(record?.trends ?? [], null, 2)
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="sources"
          className="block text-sm font-medium text-gray-700"
        >
          Sources (JSON)
        </label>
        <textarea
          id="sources"
          name="sources"
          rows={6}
          defaultValue={
            state.values?.sources ??
            JSON.stringify(record?.sources ?? [], null, 2)
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
