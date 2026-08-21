import { cn } from "@/lib/ui";
import {
  EVIDENCE_LABELS,
  selectedTrendReasoning,
  toArray,
  toHooks,
  toOutline,
  toSelectedTrend,
  type Day2Plan,
  type Trend,
} from "@/lib/day-tables";
import { Badge } from "./ui/Badge";
import { GateBadges } from "./GateStatus";
import { ExternalIcon, WarningIcon } from "./ui/icons";

const HOOK_LABELS: Record<string, string> = {
  question: "питання",
  myth_bust: "розвінчання міфу",
  stat: "цифра",
  story: "історія",
  promise: "обіцянка",
};

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
      {children}
    </p>
  );
}

/**
 * Вміст картки «День 2». Раніше все поле hook_formats розплющувалося у рядки
 * «ключ: значення» — читати структуру статті в такому вигляді неможливо.
 */
export default function PlanDetails({
  plan,
  currentTrends,
}: {
  plan: Day2Plan;
  /** Теми з Дня 1 — щоб звірити знімок із тим, що в базі зараз. */
  currentTrends: Trend[];
}) {
  const selected = toSelectedTrend(plan.selected_trend);
  const outline = toOutline(plan.outline);
  const hooks = toHooks(plan.hook_formats);
  const sections = outline?.sections ?? [];
  const reasoning = selectedTrendReasoning(selected);
  const allowedSources = toArray(selected?.sources).length;
  const rejectedSources = toArray(selected?.unusable_sources).length;
  const keyNumbers = toArray(selected?.key_numbers).length;

  // Знімок робився на момент затвердження; дослідження могли змінити пізніше
  const linkedTrend =
    plan.trend_index != null ? currentTrends[plan.trend_index] : undefined;
  const researchDeleted = plan.day1_trends_id == null && selected != null;
  const driftedFromResearch =
    !researchDeleted &&
    selected?.title != null &&
    linkedTrend?.title != null &&
    selected.title !== linkedTrend.title;

  return (
    <div className="space-y-5">
      <GateBadges
        gate={plan}
        fallbackReviewText="План позначено як такий, що потребує перевірки"
      />

      {/* ---------------------------------------------- обрана тема */}
      {selected && (
        <section className="rounded-xl bg-white/4 p-3.5 ring-1 ring-inset ring-white/8">
          <div className="flex items-start justify-between gap-3">
            <SubHeading>Обрана тема</SubHeading>
            {plan.trend_index != null && (
              <a
                href="#day-1"
                className="text-xs font-medium text-arc transition-colors hover:text-ink"
              >
                тема №{plan.trend_index + 1} з Дня 1
              </a>
            )}
          </div>

          <p className="mt-1.5 font-medium text-ink">{selected.title}</p>

          {reasoning && (
            <p className="mt-1.5 text-sm text-ink-muted">{reasoning}</p>
          )}

          {/* Підсумок роботи фактчекера: скільки джерел дозволено цитувати,
              скільки відкинуто і чи є цифри для гачка типу stat */}
          {(allowedSources > 0 ||
            rejectedSources > 0 ||
            selected.evidence_quality) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
              {selected.evidence_quality && (
                <span>
                  {EVIDENCE_LABELS[selected.evidence_quality] ??
                    selected.evidence_quality}
                </span>
              )}
              <span className="tabular">{allowedSources} джерел дозволено</span>
              {rejectedSources > 0 && (
                <span className="tabular">{rejectedSources} відкинуто</span>
              )}
              {keyNumbers > 0 && (
                <span className="tabular">{keyNumbers} перевірених цифр</span>
              )}
              {selected.confidence && (
                <span>упевненість: {selected.confidence}</span>
              )}
            </div>
          )}

          {(researchDeleted || driftedFromResearch) && (
            <p className="mt-2.5 flex items-start gap-2 rounded-lg bg-warn/8 px-3 py-2 text-xs leading-relaxed text-warn ring-1 ring-inset ring-warn/20">
              <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {researchDeleted
                ? "Вихідне дослідження видалено. План працює зі збереженого знімка теми."
                : "Дослідження змінилося після затвердження — знімок не збігається з поточною темою Дня 1."}
            </p>
          )}

          {selected.needs_verification && (
            <Badge className="mt-2.5 bg-warn/14 text-warn ring-warn/30">
              тема потребує перевірки
            </Badge>
          )}

          {selected.verification_note && (
            <p className="mt-1.5 text-xs text-ink-faint">
              {selected.verification_note}
            </p>
          )}
        </section>
      )}

      {/* ---------------------------------------------- структура */}
      {outline && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <SubHeading>Структура статті</SubHeading>
            <p className="tabular text-xs text-ink-faint">
              {sections.length} розділів
              {outline.target_length_words
                ? ` · ~${outline.target_length_words} слів`
                : ""}
            </p>
          </div>

          {outline.working_title && (
            <p className="mt-1.5 font-medium text-ink">
              {outline.working_title}
            </p>
          )}

          {outline.primary_keyword && (
            <p className="mt-1 text-xs text-ink-faint">
              Ключове слово: {outline.primary_keyword}
            </p>
          )}

          {sections.length > 0 && (
            <ol className="mt-3 space-y-2.5">
              {sections.map((section, index) => (
                <li
                  key={index}
                  className="rounded-xl bg-white/4 p-3.5 ring-1 ring-inset ring-white/8"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="tabular mt-0.5 shrink-0 text-xs text-ink-faint">
                      {index + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {section.h2 ?? `Розділ ${index + 1}`}
                      </p>

                      {section.goal && (
                        <p className="mt-1 text-xs italic text-ink-faint">
                          {section.goal}
                        </p>
                      )}

                      {section.key_points && section.key_points.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {section.key_points.map((point, pointIndex) => (
                            <li
                              key={pointIndex}
                              className="flex gap-2 text-sm text-ink-muted"
                            >
                              <span
                                aria-hidden="true"
                                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-arc/60"
                              />
                              {point}
                            </li>
                          ))}
                        </ul>
                      )}

                      {section.subsections &&
                        section.subsections.length > 0 && (
                          <p className="mt-2 text-xs text-ink-faint">
                            H3: {section.subsections.join(" · ")}
                          </p>
                        )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                        {section.target_words && (
                          <span className="tabular">
                            ~{section.target_words} слів
                          </span>
                        )}
                        {section.keywords && section.keywords.length > 0 && (
                          <span>{section.keywords.join(", ")}</span>
                        )}
                        {section.source_urls &&
                          section.source_urls.length > 0 && (
                            <span className="flex items-center gap-1 text-arc">
                              <ExternalIcon className="h-3 w-3" />
                              {section.source_urls.length} джерел
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {outline.cta && (
            <p className="mt-3 rounded-xl border border-dashed border-white/10 px-3.5 py-2.5 text-sm text-ink-muted">
              CTA: {outline.cta}
            </p>
          )}
        </section>
      )}

      {/* ---------------------------------------------- гачки */}
      <section>
        <SubHeading>Гачки</SubHeading>
        {hooks.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">Гачків ще немає</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {hooks.map((hook, index) => (
              <li
                key={index}
                className={cn(
                  "rounded-xl bg-white/4 p-3.5 ring-1 ring-inset ring-white/8",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink">
                    {hook.text ?? `Гачок ${index + 1}`}
                  </p>
                  {hook.type && (
                    <Badge className="shrink-0 text-ink-muted ring-white/12">
                      {HOOK_LABELS[hook.type] ?? hook.type}
                    </Badge>
                  )}
                </div>
                {hook.rationale && (
                  <p className="mt-1.5 text-xs text-ink-faint">
                    {hook.rationale}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
