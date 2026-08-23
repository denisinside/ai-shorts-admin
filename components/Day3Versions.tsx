import Link from "next/link";
import { cn } from "@/lib/ui";
import {
  formatElapsed,
  qualityCriteria,
  qualityScore,
  toMetrics,
  type Day3Article,
} from "@/lib/day-tables";
import { PassMark } from "./ArticleSeoPanel";
import { Badge } from "./ui/Badge";
import { WarningIcon } from "./ui/icons";

/**
 * Перемикач версій статті. У Днів 1 і 2 рядок один і перемикати нічого; у
 * Дня 3 їх багато: кожен прогін пише свою статтю, і без перемикача панель
 * показувала б лише найновішу, а попередні лишалися б недосяжними.
 *
 * Версії підписані ЧАСОМ, а не пайплайном: чим саме зроблено рядок — це
 * історія розробки, а людині тут треба вибрати статтю.
 *
 * Вибір живе в query-параметрі, а не в стані компонента: посилання на
 * конкретну версію має бути можливо кинути в чат.
 */
export function Day3Versions({
  projectId,
  articles,
  activeId,
}: {
  projectId: string;
  articles: Day3Article[];
  activeId: string;
}) {
  if (articles.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {articles.map((article) => {
        const active = article.id === activeId;
        const created = new Date(article.created_at).toLocaleString("uk-UA", {
          dateStyle: "short",
          timeStyle: "short",
        });

        return (
          <Link
            key={article.id}
            href={`/projects/${projectId}?article=${article.id}#day-3`}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              "pressable rounded-xl px-3 py-2 text-xs ring-1 ring-inset transition-colors",
              active
                ? "bg-arc/14 text-arc ring-arc/30"
                : "bg-white/4 text-ink-muted ring-white/10 hover:text-ink",
            )}
          >
            <span className="tabular font-medium">{created}</span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Телеметрія прогону одним рядком: якість за рубрикою, час, токени, доробки.
 * Це не порівняння версій, а відповідь на «чи можна це затверджувати».
 */
export function ArticleMetricsRow({ article }: { article: Day3Article }) {
  const metrics = toMetrics(article.metrics);
  const score = qualityScore(metrics);
  const criteria = qualityCriteria(metrics);
  const elapsed = formatElapsed(metrics?.elapsed_ms);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {score && (
          <Badge
            className={
              score.passed === score.total
                ? "bg-ok/14 text-ok ring-ok/30"
                : "bg-warn/14 text-warn ring-warn/30"
            }
          >
            Якість {score.passed}/{score.total}
          </Badge>
        )}
        {elapsed && (
          <span className="tabular text-xs text-ink-faint">{elapsed}</span>
        )}
        {typeof metrics?.tokens_total === "number" ? (
          <span className="tabular text-xs text-ink-faint">
            {metrics.tokens_total.toLocaleString("uk-UA")} токенів
          </span>
        ) : (
          <span className="text-xs text-ink-faint">токени з Logs не внесені</span>
        )}
        {typeof metrics?.rewrites === "number" && metrics.rewrites > 0 && (
          <span className="text-xs text-ink-faint">
            доробок: {metrics.rewrites}
          </span>
        )}
      </div>

      {/* Агрегат «N/M» каже, скільки критеріїв упало, але не який саме — а
          рішення ухвалюється саме по цьому: провалений «Ланцюг джерел» і
          провалена «Глибина SEO» означають різні дії */}
      {criteria.length > 0 && (
        <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {criteria.map((criterion) => (
            <li
              key={criterion.key}
              className="flex flex-wrap items-baseline gap-x-2 text-xs"
            >
              <span className="flex items-center self-center">
                <PassMark pass={criterion.pass} />
              </span>
              <span
                className={
                  criterion.pass === false ? "text-warn" : "text-ink-muted"
                }
              >
                {criterion.label}
              </span>
              {criterion.detail && (
                <span className="tabular text-ink-faint">
                  {criterion.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Стаття вийшла без частини ілюстрацій — це видно в самому тексті,
          тому сказати треба тут, а не лише в review_reason */}
      {typeof metrics?.images_lost === "number" && metrics.images_lost > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warn/8 px-3 py-2 text-xs leading-relaxed text-warn ring-1 ring-inset ring-warn/20">
          <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Ілюстрацій не вийшло: {metrics.images_lost} — ці блоки лишилися без
          картинки
        </p>
      )}
    </div>
  );
}
