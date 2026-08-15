import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase";
import { deleteDay1Trends } from "@/app/actions/day1";
import { approvePlan, deleteDay2Plan } from "@/app/actions/day2";
import { deleteDay3Assets } from "@/app/actions/day3";
import { deleteDay4Video } from "@/app/actions/day4";
import {
  PLATFORM_LABELS,
  STATUS_TINTS,
  type Project,
} from "@/lib/projects";
import {
  parseMaybeJson,
  toArray,
  toTrends,
  type Day1Trends,
  type Day2Plan,
  type Day3Assets,
  type Day4Video,
} from "@/lib/day-tables";
import Pipeline, { type PipelineStep } from "@/components/Pipeline";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  AssetIcon,
  CheckIcon,
  ExternalIcon,
  PencilIcon,
  PlanIcon,
  PlusIcon,
  TrashIcon,
  TrendIcon,
  VideoIcon,
} from "@/components/ui/icons";

function formatJsonList(value: unknown): string[] {
  return toArray(value).map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      return Object.entries(item as Record<string, unknown>)
        .map(([key, val]) => `${key}: ${val}`)
        .join(", ");
    }
    return String(item);
  });
}

function countItems(value: unknown): number {
  return toArray(value).length;
}

/**
 * Масив і одиночний обʼєкт ми вміємо показати нормально (див. toTrends).
 * Усе інше — скаляр чи текст замість JSON — виводимо сирим, щоб адмін бачив,
 * що саме лежить у базі, замість мовчазного «немає даних».
 */
function unexpectedShape(value: unknown): string | null {
  const parsed = parseMaybeJson(value);
  if (parsed == null || typeof parsed === "object") return null;
  return String(parsed);
}

async function loadProject(id: string) {
  const supabase = createClient();

  const [projectResult, day1Result, day2Result, day3Result, day4Result] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .returns<Project[]>()
        .maybeSingle(),
      supabase
        .from("day1_trends")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        // Один запуск пише всі рядки з однаковим created_at, тож без
        // вторинного ключа «найновіший» вибирався недетерміновано
        .order("id", { ascending: false })
        .limit(1)
        .returns<Day1Trends[]>()
        .maybeSingle(),
      supabase
        .from("day2_plan")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        // Один запуск пише всі рядки з однаковим created_at, тож без
        // вторинного ключа «найновіший» вибирався недетерміновано
        .order("id", { ascending: false })
        .limit(1)
        .returns<Day2Plan[]>()
        .maybeSingle(),
      supabase
        .from("day3_assets")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        // Один запуск пише всі рядки з однаковим created_at, тож без
        // вторинного ключа «найновіший» вибирався недетерміновано
        .order("id", { ascending: false })
        .limit(1)
        .returns<Day3Assets[]>()
        .maybeSingle(),
      supabase
        .from("day4_video")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        // Один запуск пише всі рядки з однаковим created_at, тож без
        // вторинного ключа «найновіший» вибирався недетерміновано
        .order("id", { ascending: false })
        .limit(1)
        .returns<Day4Video[]>()
        .maybeSingle(),
    ]);

  for (const result of [
    projectResult,
    day1Result,
    day2Result,
    day3Result,
    day4Result,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    project: projectResult.data,
    day1: day1Result.data,
    day2: day2Result.data,
    day3: day3Result.data,
    day4: day4Result.data,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("niche")
    .eq("id", id)
    .returns<{ niche: string }[]>()
    .maybeSingle();

  return { title: data?.niche ?? "Проєкт" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, day1, day2, day3, day4 } = await loadProject(id);

  if (!project) notFound();

  const trends = toTrends(day1?.trends);
  const rawTrends = day1 ? unexpectedShape(day1.trends) : null;
  const hookFormats = formatJsonList(day2?.hook_formats);
  const shotlistCount = countItems(day4?.shotlist);

  const steps: PipelineStep[] = [
    {
      id: "day-1",
      day: 1,
      title: "Тренди",
      summary: trends.length
        ? `${trends.length} трендів`
        : rawTrends
          ? "Несподіваний формат"
          : "Немає даних",
      done: trends.length > 0,
      icon: TrendIcon,
    },
    {
      id: "day-2",
      day: 2,
      title: "План",
      summary: day2
        ? day2.approved
          ? "Затверджено"
          : "На розгляді"
        : "Немає даних",
      done: Boolean(day2),
      icon: PlanIcon,
    },
    {
      id: "day-3",
      day: 3,
      title: "Матеріали",
      summary: day3
        ? day3.script?.trim()
          ? "Сценарій готовий"
          : "Без сценарію"
        : "Немає даних",
      done: Boolean(day3),
      icon: AssetIcon,
    },
    {
      id: "day-4",
      day: 4,
      title: "Відео",
      summary: day4
        ? day4.video_url
          ? "Відео завантажено"
          : "Без посилання"
        : "Немає даних",
      done: Boolean(day4),
      icon: VideoIcon,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Фон сторінки підфарбовується під статус проєкту — амбієнт несе
          інформацію, а не просто прикрашає */}
      <style>{`:root{--ambient-1:${STATUS_TINTS[project.status]}}`}</style>

      <PageHeader
        backHref="/"
        backLabel="Усі проєкти"
        eyebrow="Проєкт"
        title={project.niche}
        actions={
          <>
            <Badge className="text-ink-muted ring-white/12">
              {PLATFORM_LABELS[project.platform] ?? project.platform}
            </Badge>
            <StatusBadge status={project.status} />
            <LinkButton href={`/projects/${id}/edit`} size="sm">
              <PencilIcon className="h-4 w-4" />
              Редагувати
            </LinkButton>
          </>
        }
      />

      <Pipeline steps={steps} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------------- День 1 */}
        <Card id="day-1" className="scroll-mt-6">
          <CardHeader
            eyebrow="День 1"
            title="Тренди"
            actions={
              <DayActions
                editHref={day1 ? `/projects/${id}/day1/${day1.id}/edit` : undefined}
                addHref={day1 ? undefined : `/projects/${id}/day1/new`}
                deleteAction={
                  day1 ? deleteDay1Trends.bind(null, id, day1.id) : undefined
                }
                deleteTitle="Видалити тренди?"
              />
            }
          />
          <CardBody className="space-y-3">
            {trends.length === 0 ? (
              rawTrends ? (
                <RawJson label="Поле trends не є масивом — показано сирий вміст">
                  {rawTrends}
                </RawJson>
              ) : (
                <Placeholder>Тренди ще не додані</Placeholder>
              )
            ) : (
              trends.map((trend, index) => {
                const headline =
                  trend.title ?? trend.format_name ?? `Тренд ${index + 1}`;
                const body = trend.description ?? trend.why_it_works;
                const hashtags = Array.isArray(trend.hashtags)
                  ? trend.hashtags
                  : [];
                const hasMeta =
                  Boolean(trend.example_topic) ||
                  typeof trend.avg_length_sec === "number" ||
                  Boolean(trend.source_url) ||
                  Boolean(trend.broader_category);

                return (
                  <article
                    key={index}
                    className="rounded-xl bg-white/4 p-3.5 ring-1 ring-inset ring-white/8"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-ink">{headline}</p>
                      {trend.needs_verification && (
                        <Badge className="shrink-0 bg-warn/14 text-warn ring-warn/30">
                          потребує перевірки
                        </Badge>
                      )}
                    </div>

                    {body && (
                      <p className="mt-1 text-sm text-ink-muted">{body}</p>
                    )}

                    {/* Механізм чесності зі скіла: тема без підтверджених
                        джерел має виглядати інакше, ніж підтверджена */}
                    {trend.needs_verification && trend.verification_note && (
                      <p className="mt-2 rounded-lg bg-warn/8 px-3 py-2 text-xs leading-relaxed text-warn ring-1 ring-inset ring-warn/20">
                        {trend.verification_note}
                      </p>
                    )}

                    {trend.hook_idea && (
                      <p className="mt-2 border-l-2 border-arc/40 pl-3 text-sm italic text-arc">
                        {trend.hook_idea}
                      </p>
                    )}

                    {Array.isArray(trend.format) ? (
                      trend.format.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
                            Формат
                          </p>
                          <ol className="mt-1.5 space-y-1">
                            {trend.format.map((line, lineIndex) => (
                              <li
                                key={lineIndex}
                                className="flex gap-2.5 text-sm text-ink-muted"
                              >
                                <span className="tabular shrink-0 text-ink-faint">
                                  {lineIndex + 1}.
                                </span>
                                {line}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )
                    ) : trend.format ? (
                      <p className="mt-2 text-xs text-ink-faint">
                        Формат: {trend.format}
                      </p>
                    ) : null}

                    {hashtags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {hashtags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-arc/12 px-2 py-0.5 text-xs font-medium text-arc"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {trend.audience && (
                      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                        <span className="text-ink-muted">Аудиторія:</span>{" "}
                        {trend.audience}
                      </p>
                    )}

                    {hasMeta && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
                        {trend.broader_category && (
                          <span>Ширша категорія: {trend.broader_category}</span>
                        )}
                        {trend.example_topic && (
                          <span>Тема: {trend.example_topic}</span>
                        )}
                        {typeof trend.avg_length_sec === "number" && (
                          <span className="tabular">
                            {trend.avg_length_sec} с
                          </span>
                        )}
                        {trend.source_url && (
                          <a
                            href={trend.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-arc transition-colors hover:text-ink"
                          >
                            Джерело
                            <ExternalIcon className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </CardBody>
        </Card>

        {/* ------------------------------------------------------- День 2 */}
        <Card id="day-2" className="scroll-mt-6">
          <CardHeader
            eyebrow="День 2"
            title="План"
            actions={
              <DayActions
                editHref={day2 ? `/projects/${id}/day2/${day2.id}/edit` : undefined}
                addHref={day2 ? undefined : `/projects/${id}/day2/new`}
                deleteAction={
                  day2 ? deleteDay2Plan.bind(null, id, day2.id) : undefined
                }
                deleteTitle="Видалити план?"
              />
            }
          />
          <CardBody className="space-y-4">
            {!day2 ? (
              <Placeholder>План ще не створений</Placeholder>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      day2.approved
                        ? "bg-ok/14 text-ok ring-ok/30"
                        : "bg-warn/14 text-warn ring-warn/30"
                    }
                  >
                    {day2.approved ? "Затверджено" : "На розгляді"}
                  </Badge>
                  {day2.approved && day2.approved_by && (
                    <span className="text-xs text-ink-faint">
                      ким: {day2.approved_by}
                    </span>
                  )}
                  {day2.fallback_used && (
                    <Badge className="text-ink-muted ring-white/12">
                      Fallback
                    </Badge>
                  )}
                </div>

                <div>
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
                    Формати гачків
                  </p>
                  {hookFormats.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-faint">
                      Формати ще не задані
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {hookFormats.map((item, index) => (
                        <li
                          key={index}
                          className="flex gap-2.5 text-sm text-ink-muted"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-2 h-1 w-1 shrink-0 rounded-full bg-arc/60"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {!day2.approved && (
                  <form action={approvePlan.bind(null, id)}>
                    <SubmitButton pendingLabel="Затверджуємо…" size="sm">
                      <CheckIcon className="h-4 w-4" />
                      Затвердити план
                    </SubmitButton>
                  </form>
                )}
              </>
            )}
          </CardBody>
        </Card>

        {/* ------------------------------------------------------- День 3 */}
        <Card id="day-3" className="scroll-mt-6">
          <CardHeader
            eyebrow="День 3"
            title="Матеріали"
            actions={
              <DayActions
                editHref={day3 ? `/projects/${id}/day3/${day3.id}/edit` : undefined}
                addHref={day3 ? undefined : `/projects/${id}/day3/new`}
                deleteAction={
                  day3 ? deleteDay3Assets.bind(null, id, day3.id) : undefined
                }
                deleteTitle="Видалити матеріали?"
              />
            }
          />
          <CardBody className="space-y-4">
            {!day3 ? (
              <Placeholder>Матеріали ще не додані</Placeholder>
            ) : (
              <>
                <div>
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
                    Сценарій
                  </p>
                  <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-white/4 p-3.5 text-sm leading-relaxed text-ink-muted ring-1 ring-inset ring-white/8">
                    {day3.script?.trim() || "Сценарію ще немає"}
                  </div>
                </div>

                <div>
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
                    Обкладинка
                  </p>
                  {day3.thumbnail_url ? (
                    // Довільні зовнішні URL із пайплайну — next/image тут
                    // вимагав би вносити кожен хост у remotePatterns
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={day3.thumbnail_url}
                      alt="Обкладинка"
                      className="mt-2 h-44 w-full rounded-xl object-cover ring-1 ring-inset ring-white/10"
                    />
                  ) : (
                    <div className="mt-2 flex h-44 w-full items-center justify-center rounded-xl bg-white/4 text-sm text-ink-faint ring-1 ring-inset ring-white/8">
                      Обкладинки немає
                    </div>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        {/* ------------------------------------------------------- День 4 */}
        <Card id="day-4" className="scroll-mt-6">
          <CardHeader
            eyebrow="День 4"
            title="Відео"
            actions={
              <DayActions
                editHref={day4 ? `/projects/${id}/day4/${day4.id}/edit` : undefined}
                addHref={day4 ? undefined : `/projects/${id}/day4/new`}
                deleteAction={
                  day4 ? deleteDay4Video.bind(null, id, day4.id) : undefined
                }
                deleteTitle="Видалити відео?"
              />
            }
          />
          <CardBody className="space-y-4">
            {!day4 ? (
              <Placeholder>Відео ще не додане</Placeholder>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="text-ink-muted ring-white/12">
                    {day4.status ?? "невідомо"}
                  </Badge>
                  {shotlistCount > 0 && (
                    <Badge className="text-ink-muted ring-white/12">
                      {shotlistCount} кадрів
                    </Badge>
                  )}
                </div>

                <dl className="space-y-2 text-sm">
                  <MediaLink label="Відео" href={day4.video_url} />
                  <MediaLink label="Озвучка" href={day4.voiceover_url} />
                </dl>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function RawJson({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <div className="rounded-xl bg-warn/8 p-3.5 ring-1 ring-inset ring-warn/25">
      <p className="text-xs font-medium text-warn">{label}</p>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink-muted">
        {children}
      </pre>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 px-3.5 py-6 text-center text-sm text-ink-faint">
      {children}
    </p>
  );
}

function MediaLink({ label, href }: { label: string; href: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/4 px-3.5 py-2.5 ring-1 ring-inset ring-white/8">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="min-w-0">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-arc transition-colors hover:text-ink"
          >
            Відкрити
            <ExternalIcon className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-ink-faint">немає</span>
        )}
      </dd>
    </div>
  );
}

function DayActions({
  editHref,
  addHref,
  deleteAction,
  deleteTitle,
}: {
  editHref?: string;
  addHref?: string;
  deleteAction?: () => Promise<void>;
  deleteTitle: string;
}) {
  return (
    <>
      {addHref && (
        <LinkButton href={addHref} size="sm">
          <PlusIcon className="h-4 w-4" />
          Додати
        </LinkButton>
      )}
      {editHref && (
        <LinkButton
          href={editHref}
          variant="ghost"
          size="icon"
          aria-label="Редагувати запис"
        >
          <PencilIcon className="h-4 w-4" />
        </LinkButton>
      )}
      {deleteAction && (
        <ConfirmAction
          action={deleteAction}
          title={deleteTitle}
          description="Запис буде видалено назавжди. Дію не можна скасувати."
          trigger={<TrashIcon className="h-4 w-4" />}
          triggerLabel="Видалити запис"
          triggerVariant="ghost"
          triggerSize="icon"
        />
      )}
    </>
  );
}
