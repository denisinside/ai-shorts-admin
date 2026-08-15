import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { deleteProject } from "@/app/actions/projects";
import { STATUS_STYLES, type Project } from "@/lib/projects";

export default async function Home() {
  const supabase = createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Project[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/projects/new"
          className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
        >
          + New project
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-6 py-4">Niche</th>
              <th className="px-6 py-4">Platform</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Created</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-10 text-center text-sm text-gray-500"
                >
                  No projects yet
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {project.niche}
                  </td>
                  <td className="px-6 py-4 capitalize text-gray-600">
                    {project.platform}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[project.status]}`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(project.created_at).toLocaleDateString("uk-UA")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-gray-500 hover:text-violet-600"
                      >
                        Переглянути
                      </Link>
                      <Link
                        href={`/projects/${project.id}/edit`}
                        className="text-violet-600 hover:text-violet-700"
                      >
                        Редагувати
                      </Link>
                      <form action={deleteProject.bind(null, project.id)}>
                        <button
                          type="submit"
                          className="text-red-500 hover:text-red-600"
                        >
                          Видалити
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
