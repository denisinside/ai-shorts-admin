import Link from "next/link";
import { createProject } from "@/app/actions/projects";
import { PLATFORMS, STATUSES } from "@/lib/projects";

export default function NewProjectPage() {
  return (
    <div className="max-w-xl rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">New project</h2>

      <form action={createProject} className="mt-6 space-y-5">
        <div>
          <label
            htmlFor="niche"
            className="block text-sm font-medium text-gray-700"
          >
            Niche
          </label>
          <input
            id="niche"
            name="niche"
            type="text"
            required
            placeholder="e.g. Personal finance tips"
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>

        <div>
          <label
            htmlFor="platform"
            className="block text-sm font-medium text-gray-700"
          >
            Platform
          </label>
          <select
            id="platform"
            name="platform"
            defaultValue={PLATFORMS[0]}
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            {PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={STATUSES[0]}
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            Create project
          </button>
          <Link
            href="/"
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
