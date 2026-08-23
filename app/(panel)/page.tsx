import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { deleteProject } from "@/app/actions/projects";
import {
  PLATFORM_LABELS,
  STATUSES,
  STATUS_LABELS,
  isStatus,
  type Project,
  type Status,
} from "@/lib/projects";
import { cn } from "@/lib/ui";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { EmptyState, PageHeader } from "@/components/ui/PageHeader";
import {
  LayersIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/ui/icons";

const dateFormat = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// Кома й дужки — службові символи у фільтрах PostgREST, а % і _ — джокери
// LIKE. Прибираємо їх, щоб запит не розсипався на випадковому вводі.
function sanitizeTerm(term: string) {
  return term.replace(/[%_,()]/g, " ").trim();
}

function buildHref(params: { q?: string; status?: string }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return query ? `/?${query}` : "/";
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status: statusParam } = await searchParams;
  const term = sanitizeTerm(q);
  const status = isStatus(statusParam) ? statusParam : undefined;

  const supabase = createClient();

  let listQuery = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (term) listQuery = listQuery.ilike("niche", `%${term}%`);
  if (status) listQuery = listQuery.eq("status", status);

  const [listResult, countsResult] = await Promise.all([
    listQuery.returns<Project[]>(),
    supabase.from("projects").select("status").returns<{ status: Status }[]>(),
  ]);

  if (listResult.error) throw new Error(listResult.error.message);
  if (countsResult.error) throw new Error(countsResult.error.message);

  const projects = listResult.data ?? [];
  const total = countsResult.data?.length ?? 0;
  const counts = new Map<Status, number>();
  for (const row of countsResult.data ?? []) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const filtered = Boolean(term || status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${total} ${total === 1 ? "проєкт" : "проєктів"} у базі`}
        title="Проєкти"
        actions={
          <LinkButton href="/projects/new" variant="primary">
            <PlusIcon className="h-4 w-4" />
            Новий проєкт
          </LinkButton>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form action="/" method="get" className="relative w-full lg:max-w-sm">
            {status && <input type="hidden" name="status" value={status} />}
            <label htmlFor="q" className="sr-only">
              Пошук за нішею
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Пошук за нішею…"
              className="field pr-10"
            />
            <button
              type="submit"
              aria-label="Шукати"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-faint transition-colors hover:text-ink"
            >
              <SearchIcon className="h-4 w-4" />
            </button>
          </form>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <FilterChip
              href={buildHref({ q })}
              active={!status}
              label="Усі"
              count={total}
            />
            {STATUSES.map((value) => (
              <FilterChip
                key={value}
                href={buildHref({ q, status: value })}
                active={status === value}
                label={STATUS_LABELS[value]}
                count={counts.get(value) ?? 0}
              />
            ))}
          </div>
        </div>
      </PageHeader>

      <Card className="overflow-hidden">
        {projects.length === 0 ? (
          <EmptyState
            icon={<LayersIcon className="h-5 w-5" />}
            title={filtered ? "Нічого не знайдено" : "Ще немає проєктів"}
            description={
              filtered
                ? "Спробуйте змінити пошуковий запит або скинути фільтр статусу."
                : "Створіть перший проєкт — далі пайплайн наповнить його даними по днях."
            }
            action={
              filtered ? (
                <LinkButton href="/">Скинути фільтри</LinkButton>
              ) : (
                <LinkButton href="/projects/new" variant="primary">
                  <PlusIcon className="h-4 w-4" />
                  Новий проєкт
                </LinkButton>
              )
            }
          />
        ) : (
          <>
            {/* Десктоп — таблиця */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/6 text-xs font-medium uppercase tracking-[0.06em] text-ink-faint">
                    <th scope="col" className="px-5 py-3.5 font-medium">
                      Ніша
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-medium">
                      Платформа
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-medium">
                      Статус
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-medium">
                      Створено
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-right font-medium">
                      <span className="sr-only">Дії</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/4"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-medium text-ink transition-colors hover:text-arc"
                        >
                          {project.niche}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        {PLATFORM_LABELS[project.platform] ?? project.platform}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-5 py-3.5 text-ink-faint">
                        {dateFormat.format(new Date(project.created_at))}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <RowActions project={project} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Мобільний — картки замість горизонтального скролу таблиці */}
            <ul className="divide-y divide-white/5 md:hidden">
              {projects.map((project) => (
                <li key={project.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/projects/${project.id}`}
                      className="min-w-0 font-medium text-ink"
                    >
                      {project.niche}
                    </Link>
                    <StatusBadge status={project.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-ink-faint">
                      {PLATFORM_LABELS[project.platform] ?? project.platform} ·{" "}
                      {dateFormat.format(new Date(project.created_at))}
                    </p>
                    <div className="flex items-center gap-1">
                      <RowActions project={project} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function RowActions({ project }: { project: Project }) {
  return (
    <>
      <LinkButton
        href={`/projects/${project.id}/edit`}
        variant="ghost"
        size="icon"
        aria-label={`Редагувати «${project.niche}»`}
      >
        <PencilIcon className="h-4 w-4" />
      </LinkButton>
      <ConfirmAction
        action={deleteProject.bind(null, project.id)}
        title="Видалити проєкт?"
        description={
          <>
            Проєкт «{project.niche}» і всі пов&apos;язані записи днів буде
            видалено назавжди. Дію не можна скасувати.
          </>
        }
        trigger={<TrashIcon className="h-4 w-4" />}
        triggerLabel={`Видалити «${project.niche}»`}
        triggerVariant="ghost"
        triggerSize="icon"
      />
    </>
  );
}

function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "pressable flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
        active
          ? "bg-arc/16 text-ink ring-arc/30"
          : "text-ink-muted ring-white/10 hover:bg-white/6 hover:text-ink",
      )}
    >
      {label}
      <span
        className={cn(
          "tabular rounded-full px-1.5 py-0.5 text-[0.6875rem]",
          active ? "bg-arc/20 text-arc" : "bg-white/8 text-ink-faint",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
