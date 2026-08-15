"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createDay3Assets, updateDay3Assets } from "@/app/actions/day3";
import { initialFormState } from "@/lib/form-state";
import type { Day3Assets } from "@/lib/day-tables";

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
          htmlFor="script"
          className="block text-sm font-medium text-gray-700"
        >
          Script
        </label>
        <textarea
          id="script"
          name="script"
          rows={10}
          required
          defaultValue={state.values?.script ?? record?.script ?? ""}
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="hook_variants"
          className="block text-sm font-medium text-gray-700"
        >
          Hook variants (JSON)
        </label>
        <textarea
          id="hook_variants"
          name="hook_variants"
          rows={8}
          defaultValue={
            state.values?.hook_variants ??
            JSON.stringify(record?.hook_variants ?? [], null, 2)
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="thumbnail_url"
          className="block text-sm font-medium text-gray-700"
        >
          Thumbnail URL
        </label>
        <input
          id="thumbnail_url"
          name="thumbnail_url"
          type="text"
          defaultValue={
            state.values?.thumbnail_url ?? record?.thumbnail_url ?? ""
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
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
