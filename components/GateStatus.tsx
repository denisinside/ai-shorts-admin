import { Badge } from "./ui/Badge";
import { WarningIcon } from "./ui/icons";

/**
 * Стан HITL-гейта. Один компонент на всі дні: колонки `approved` /
 * `decided_at` / `needs_review` / `fallback_used` навмисно однакові в
 * `day1_trends` і `day2_plan`, тому й показувати їх треба однаково —
 * інакше той самий стан виглядав би в панелі по-різному залежно від дня.
 */
export type GateState = {
  approved: boolean;
  approved_by: string | null;
  /** `null` = картка ще висить у Discord і рішення немає. */
  decided_at: string | null;
  needs_review: boolean;
  review_reason: string | null;
  fallback_used: boolean;
  fallback_reason: string | null;
  discord_message_id: string | null;
};

/** Текст, коли `review_reason` порожній, — залежить від того, що саме на гейті. */
export function GateBadges({
  gate,
  fallbackReviewText,
}: {
  gate: GateState;
  fallbackReviewText: string;
}) {
  // Три стани гейта з двох колонок: decided_at — чи ухвалене рішення,
  // approved — яке саме. Окремого поля-статусу немає навмисно.
  const decided = Boolean(gate.decided_at);
  const decidedAt = gate.decided_at
    ? new Date(gate.decided_at).toLocaleString("uk-UA", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={
            gate.approved
              ? "bg-ok/14 text-ok ring-ok/30"
              : decided
                ? "bg-danger/14 text-danger ring-danger/30"
                : "bg-warn/14 text-warn ring-warn/30"
          }
        >
          {gate.approved
            ? "Затверджено"
            : decided
              ? "Відхилено"
              : "Чекає на рішення"}
        </Badge>
        {decided && gate.approved_by && (
          <span className="text-xs text-ink-faint">
            {gate.approved ? "затвердив" : "відхилив"}: {gate.approved_by}
          </span>
        )}
        {decidedAt && (
          <span className="tabular text-xs text-ink-faint">{decidedAt}</span>
        )}
        {!decided && gate.discord_message_id && (
          <span className="text-xs text-ink-faint">картка в Discord</span>
        )}
        {/* Дві різні речі: needs_review — незакрите питання до людини,
            fallback_used — факт про доказову базу, який лишається назавжди */}
        {gate.needs_review && (
          <Badge className="bg-warn/14 text-warn ring-warn/30">
            Потребує перевірки
          </Badge>
        )}
        {gate.fallback_used && (
          <Badge className="text-ink-muted ring-white/12">Fallback</Badge>
        )}
      </div>

      {(gate.needs_review || gate.review_reason) && (
        <p className="flex items-start gap-2 rounded-lg bg-warn/8 px-3 py-2 text-xs leading-relaxed text-warn ring-1 ring-inset ring-warn/20">
          <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {gate.review_reason ?? fallbackReviewText}
        </p>
      )}

      {gate.fallback_used && gate.fallback_reason && (
        <p className="text-xs leading-relaxed text-ink-faint">
          Fallback: {gate.fallback_reason}
        </p>
      )}
    </>
  );
}
