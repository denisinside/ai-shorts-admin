import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase";
import {
  articleWords,
  formatElapsed,
  toMetrics,
  toSections,
  PIPELINE_LABELS,
  PIPELINE_STYLES,
  type ArticleMetrics,
  type Day3Article,
  type QualityCriterion,
} from "@/lib/day-tables";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Порівняння прогонів · День 3" };

/**
 * Таблиця «до/після» — артефакт здачі Дня 3, згенерований із бази, а не
 * набраний руками. Рядок = прогін пайплайну, колонка = вісь оптимізації.
 *
 * Порівнювати має сенс лише прогони ОДНОГО проєкту: інакше різниця в цифрах
 * пояснюється темою, а не пайплайном. Тому сторінка живе всередині проєкту.
 */

/** Критерії рубрики в порядку контракту (§10) — щоб колонки не стрибали. */
const CRITERIA: { key: string; label: string }[] = [
  { key: "plan_coverage", label: "План" },
  { key: "source_integrity", label: "Джерела" },
  { key: "text_budget", label: "Бюджет" },
  { key: "seo_hygiene", label: "SEO" },
  { key: "coherence", label: "Зв'язність" },
];

function criterion(
  metrics: ArticleMetrics | null,
  key: string,
): QualityCriterion | null {
  const value = metrics?.quality?.[key];
  return value && typeof value === "object" ? (value as QualityCriterion) : null;
}

/**
 * Різниця з baseline у відсотках. Показуємо лише там, де база є і не нуль:
 * «+∞%» замість цифри не пояснює нічого.
 */
function delta(value: number | undefined, base: number | undefined) {
  if (typeof value !== "number" || typeof base !== "number" || base === 0) {
    return null;
  }
  const percent = Math.round(((value - base) / base) * 100);
  if (percent === 0) return { text: "=", tone: "text-ink-faint" };
  // Менше — краще для обох осей, які тут порівнюються (час і токени)
  return {
    text: `${percent > 0 ? "+" : ""}${percent}%`,
    tone: percent < 0 ? "text-ok" : "text-warn",
  };
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-ink-muted">
      {children}
    </td>
  );
}

export default async function CompareDay3Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();

  const [projectResult, articlesResult] = await Promise.all([
    supabase
      .from("projects")
      .select("niche")
      .eq("id", id)
      .returns<{ niche: string }[]>()
      .maybeSingle(),
    supabase
      .from("day3_article")
      .select("*")
      .eq("project_id", id)
      // Найстаріший перший: baseline має бути зверху, бо він точка відліку
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(50)
      .returns<Day3Article[]>(),
  ]);

  if (projectResult.error) throw new Error(projectResult.error.message);
  if (articlesResult.error) throw new Error(articlesResult.error.message);
  if (!projectResult.data) notFound();

  const articles = articlesResult.data ?? [];
  // База порівняння — перший baseline. Якщо його немає, дельти не рахуємо:
  // порівнювати оптимізації між собою без точки відліку безглуздо.
  const baseline = articles.find((row) => row.pipeline === "baseline") ?? null;
  const baseMetrics = toMetrics(baseline?.metrics);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/projects/${id}`}
        backLabel="До проєкту"
        eyebrow="День 3 · Порівняння"
        title={projectResult.data.niche}
      />

      <Card>
        <CardHeader
          eyebrow="Оптимізація"
          title="До / після"
          actions={
            <span className="text-xs text-ink-faint">
              {articles.length} прогонів
            </span>
          }
        />
        <CardBody className="px-0 py-0">
          {articles.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-faint">
              Прогонів ще немає
            </p>
          ) : (
            // Широка таблиця скролиться всередині себе, а не тягне сторінку
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/8">
                    {[
                      "Прогін",
                      "Час",
                      "Δ час",
                      "Токени",
                      "Δ токени",
                      "LLM",
                      "Доробки",
                      "Слів",
                      "Розділів",
                      ...CRITERIA.map((item) => item.label),
                    ].map((label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap px-3 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {articles.map((article) => {
                    const metrics = toMetrics(article.metrics);
                    const isBase = article.id === baseline?.id;
                    const timeDelta = isBase
                      ? null
                      : delta(metrics?.elapsed_ms, baseMetrics?.elapsed_ms);
                    const tokenDelta = isBase
                      ? null
                      : delta(
                          metrics?.tokens_total ?? undefined,
                          baseMetrics?.tokens_total ?? undefined,
                        );

                    return (
                      <tr
                        key={article.id}
                        className="border-b border-white/5 last:border-0"
                      >
                        <Cell>
                          <span className="inline-flex items-center gap-2">
                            <Link
                              href={`/projects/${id}?article=${article.id}#day-3`}
                              className="inline-flex items-center gap-2 transition-colors hover:text-arc"
                            >
                              <Badge
                                className={PIPELINE_STYLES[article.pipeline]}
                              >
                                {article.variant ??
                                  PIPELINE_LABELS[article.pipeline]}
                              </Badge>
                            </Link>
                            {/* Порівнювати цифри й читати текст — різні задачі:
                                кожен прогін відкривається в читалці окремо */}
                            <Link
                              href={`/blog?article=${article.id}`}
                              target="_blank"
                              rel="noopener"
                              className="text-xs text-ink-faint transition-colors hover:text-arc"
                            >
                              почитати
                            </Link>
                          </span>
                        </Cell>
                        <Cell>
                          <span className="tabular">
                            {formatElapsed(metrics?.elapsed_ms) ?? "—"}
                          </span>
                        </Cell>
                        <Cell>
                          {timeDelta ? (
                            <span className={`tabular ${timeDelta.tone}`}>
                              {timeDelta.text}
                            </span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </Cell>
                        <Cell>
                          <span className="tabular">
                            {typeof metrics?.tokens_total === "number"
                              ? metrics.tokens_total.toLocaleString("uk-UA")
                              : "—"}
                          </span>
                        </Cell>
                        <Cell>
                          {tokenDelta ? (
                            <span className={`tabular ${tokenDelta.tone}`}>
                              {tokenDelta.text}
                            </span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </Cell>
                        <Cell>
                          <span className="tabular">
                            {metrics?.llm_calls ?? "—"}
                          </span>
                        </Cell>
                        <Cell>
                          <span className="tabular">
                            {metrics?.rewrites ?? "—"}
                          </span>
                        </Cell>
                        <Cell>
                          <span className="tabular">
                            {articleWords(article)}
                          </span>
                        </Cell>
                        <Cell>
                          <span className="tabular">
                            {toSections(article.sections).length}
                          </span>
                        </Cell>
                        {CRITERIA.map((item) => {
                          const value = criterion(metrics, item.key);
                          return (
                            <Cell key={item.key}>
                              {value?.pass === true ? (
                                <span className="text-ok">так</span>
                              ) : value?.pass === false ? (
                                <span className="text-danger">ні</span>
                              ) : (
                                <span className="text-ink-faint">—</span>
                              )}
                            </Cell>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader eyebrow="Як читати" title="Звідки беруться цифри" />
        <CardBody className="space-y-2.5 text-sm leading-relaxed text-ink-muted">
          <p>
            <span className="font-medium text-ink">Час</span> міряє сам граф:
            різниця заголовків <code className="text-xs">Date</code> першої
            HTTP-відповіді і відповіді на запис. Вікно однакове в обох
            пайплайнах — інакше порівняння нічого не варте.
          </p>
          <p>
            <span className="font-medium text-ink">Токени</span> переносяться з
            Dify Logs руками: воркфлоу не бачить власного споживання токенів, а
            Service API недоступний апці зі стартовою нодою-тригером. Порожня
            комірка означає «ще не внесено», а не «нуль».
          </p>
          <p>
            <span className="font-medium text-ink">Критерії якості</span> рахує
            код за однією формулою для обох пайплайнів — тому «не гірше за
            baseline» тут перевірка, а не думка. Опис:{" "}
            <code className="text-xs">supabase/day3-article-contract.md</code>{" "}
            §10.
          </p>
          <p>
            <span className="font-medium text-ink">Δ</span> рахується від
            першого baseline. Зелений — менше за базу, жовтий — більше; для часу
            й токенів менше означає краще.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
