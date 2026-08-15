import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { deleteDay1Trends } from "@/app/actions/day1";
import { approvePlan, deleteDay2Plan } from "@/app/actions/day2";
import { deleteDay3Assets } from "@/app/actions/day3";
import { deleteDay4Video } from "@/app/actions/day4";
import { STATUS_STYLES, type Project } from "@/lib/projects";
import type {
  Day1Trends,
  Day2Plan,
  Day3Assets,
  Day4Video,
} from "@/lib/day-tables";

function formatJsonList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      return Object.entries(item as Record<string, unknown>)
        .map(([key, val]) => `${key}: ${val}`)
        .join(", ");
    }
    return String(item);
  });
}

function SectionHeader({
  title,
  editHref,
  addHref,
  onDelete,
}: {
  title: string;
  editHref?: string;
  addHref?: string;
  onDelete?: () => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="flex items-center gap-3 text-sm">
        {editHref && (
          <Link
            href={editHref}
            className="text-violet-600 hover:text-violet-700"
          >
            Редагувати
          </Link>
        )}
        {onDelete && (
          <form action={onDelete}>
            <button
              type="submit"
              className="text-red-500 hover:text-red-600"
            >
              Видалити
            </button>
          </form>
        )}
        {addHref && (
          <Link
            href={addHref}
            className="text-violet-600 hover:text-violet-700"
          >
            Додати
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();

  const [projectResult, day1Result, day2Result, day3Result, day4Result] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", id).returns<Project[]>().maybeSingle(),
      supabase
        .from("day1_trends")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<Day1Trends[]>()
        .maybeSingle(),
      supabase
        .from("day2_plan")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<Day2Plan[]>()
        .maybeSingle(),
      supabase
        .from("day3_assets")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<Day3Assets[]>()
        .maybeSingle(),
      supabase
        .from("day4_video")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<Day4Video[]>()
        .maybeSingle(),
    ]);

  if (projectResult.error) throw new Error(projectResult.error.message);
  if (day1Result.error) throw new Error(day1Result.error.message);
  if (day2Result.error) throw new Error(day2Result.error.message);
  if (day3Result.error) throw new Error(day3Result.error.message);
  if (day4Result.error) throw new Error(day4Result.error.message);

  const project = projectResult.data;
  if (!project) {
    notFound();
  }

  const day1 = day1Result.data;
  const day2 = day2Result.data;
  const day3 = day3Result.data;
  const day4 = day4Result.data;

  const hookFormats = formatJsonList(day2?.hook_formats);

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        ← Back to projects
      </Link>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Project</p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">
              {project.niche}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-600">
              {project.platform}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[project.status]}`}
            >
              {project.status}
            </span>
            <Link
              href={`/projects/${project.id}/edit`}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              Edit project
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionHeader
            title="Day 1 · Trends"
            editHref={day1 ? `/projects/${id}/day1/${day1.id}/edit` : undefined}
            addHref={day1 ? undefined : `/projects/${id}/day1/new`}
            onDelete={
              day1 ? deleteDay1Trends.bind(null, id, day1.id) : undefined
            }
          />
          <div className="mt-4 space-y-3">
            {!day1 || !day1.trends || day1.trends.length === 0 ? (
              <p className="text-sm text-gray-500">No trends yet</p>
            ) : (
              day1.trends.map((trend, index) => {
                const headline =
                  trend.title ?? trend.format_name ?? `Trend ${index + 1}`;
                const body = trend.description ?? trend.why_it_works;
                const hashtags = Array.isArray(trend.hashtags)
                  ? trend.hashtags
                  : [];
                const hasMetaRow =
                  Boolean(trend.example_topic) ||
                  typeof trend.avg_length_sec === "number" ||
                  Boolean(trend.source_url);

                return (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <p className="font-medium text-gray-900">{headline}</p>

                    {body && (
                      <p className="mt-1 text-sm text-gray-600">{body}</p>
                    )}

                    {trend.hook_idea && (
                      <p className="mt-2 text-sm italic text-violet-700">
                        “{trend.hook_idea}”
                      </p>
                    )}

                    {trend.format && (
                      <p className="mt-1 text-xs text-gray-500">
                        Format: {trend.format}
                      </p>
                    )}

                    {hashtags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {hashtags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {hasMetaRow && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {trend.example_topic && (
                          <span>Topic: {trend.example_topic}</span>
                        )}
                        {typeof trend.avg_length_sec === "number" && (
                          <span>{trend.avg_length_sec}s</span>
                        )}
                        {trend.source_url && (
                          <a
                            href={trend.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-violet-600 hover:text-violet-700"
                          >
                            Source ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionHeader
            title="Day 2 · Plan"
            editHref={day2 ? `/projects/${id}/day2/${day2.id}/edit` : undefined}
            addHref={day2 ? undefined : `/projects/${id}/day2/new`}
            onDelete={
              day2 ? deleteDay2Plan.bind(null, id, day2.id) : undefined
            }
          />
          <div className="mt-4 space-y-4">
            {!day2 ? (
              <p className="text-sm text-gray-500">No plan yet</p>
            ) : (
              <>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    day2.approved
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {day2.approved ? "Затверджено" : "На розгляді"}
                </span>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Hook formats
                  </p>
                  {hookFormats.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">
                      No hook formats yet
                    </p>
                  ) : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
                      {hookFormats.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {!day2.approved && (
                  <form action={approvePlan.bind(null, id)}>
                    <button
                      type="submit"
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                    >
                      Затвердити
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionHeader
            title="Day 3 · Assets"
            editHref={day3 ? `/projects/${id}/day3/${day3.id}/edit` : undefined}
            addHref={day3 ? undefined : `/projects/${id}/day3/new`}
            onDelete={
              day3 ? deleteDay3Assets.bind(null, id, day3.id) : undefined
            }
          />
          <div className="mt-4 space-y-4">
            {!day3 ? (
              <p className="text-sm text-gray-500">No assets yet</p>
            ) : (
              <>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Script
                  </p>
                  <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                    {day3.script?.trim() ? day3.script : "No script yet"}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Thumbnail
                  </p>
                  {day3.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={day3.thumbnail_url}
                      alt="Thumbnail"
                      className="mt-2 h-40 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="mt-2 flex h-40 w-full items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400">
                      No thumbnail
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionHeader
            title="Day 4 · Video"
            editHref={day4 ? `/projects/${id}/day4/${day4.id}/edit` : undefined}
            addHref={day4 ? undefined : `/projects/${id}/day4/new`}
            onDelete={
              day4 ? deleteDay4Video.bind(null, id, day4.id) : undefined
            }
          />
          <div className="mt-4 space-y-3">
            {!day4 ? (
              <p className="text-sm text-gray-500">No video yet</p>
            ) : (
              <>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-600">
                  {day4.status ?? "unknown"}
                </span>
                {day4.video_url ? (
                  <a
                    href={day4.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm font-medium text-violet-600 hover:text-violet-700"
                  >
                    Watch video ↗
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">No video link yet</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
