"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createDay2Plan, updateDay2Plan } from "@/app/actions/day2";
import { initialFormState } from "@/lib/form-state";
import type { Day2Plan } from "@/lib/day-tables";

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
          htmlFor="hook_formats"
          className="block text-sm font-medium text-gray-700"
        >
          Hook formats (JSON)
        </label>
        <textarea
          id="hook_formats"
          name="hook_formats"
          rows={10}
          defaultValue={
            state.values?.hook_formats ??
            JSON.stringify(record?.hook_formats ?? [], null, 2)
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="approved_by"
          className="block text-sm font-medium text-gray-700"
        >
          Approved by
        </label>
        <input
          id="approved_by"
          name="approved_by"
          type="text"
          defaultValue={state.values?.approved_by ?? record?.approved_by ?? ""}
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            name="approved"
            defaultChecked={
              state.values ? state.values.approved === "on" : (record?.approved ?? false)
            }
            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500/40"
          />
          Approved
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            name="fallback_used"
            defaultChecked={
              state.values
                ? state.values.fallback_used === "on"
                : (record?.fallback_used ?? false)
            }
            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500/40"
          />
          Fallback used
        </label>
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
