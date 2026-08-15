import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/ui";
import { CheckIcon } from "./ui/icons";

export type PipelineStep = {
  id: string;
  day: number;
  title: string;
  /** Короткий підсумок стану: «5 трендів», «Немає даних» тощо. */
  summary: string;
  done: boolean;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Чотири дні пайплайну — це послідовність, а не чотири рівноправні картки.
 * Рейка показує, доки дійшов проєкт, ще до того як користувач почне читати.
 */
export default function Pipeline({ steps }: { steps: PipelineStep[] }) {
  const completed = steps.filter((step) => step.done).length;

  return (
    <nav aria-label="Етапи пайплайну" className="glass rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
          Пайплайн
        </p>
        <p className="tabular text-xs text-ink-muted">
          {completed} з {steps.length} етапів
        </p>
      </div>

      <ol className="flex flex-col gap-1 sm:flex-row sm:items-stretch sm:gap-0">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex flex-1 items-start gap-3 sm:flex-col sm:gap-0"
          >
            <div className="flex flex-col items-center sm:w-full sm:flex-row">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-colors",
                  step.done
                    ? "bg-arc/16 text-arc ring-arc/30"
                    : "bg-white/4 text-ink-faint ring-white/10",
                )}
              >
                {step.done ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </span>

              {/* Конектор: вертикальний на мобільному, горизонтальний далі */}
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "my-1 w-px flex-1 sm:my-0 sm:ml-3 sm:h-px sm:w-auto sm:flex-1",
                    steps[index + 1].done || step.done
                      ? "bg-arc/30"
                      : "bg-white/10",
                  )}
                />
              )}
            </div>

            <a
              href={`#${step.id}`}
              className="min-w-0 pb-3 sm:pb-0 sm:pr-4 sm:pt-3"
            >
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
                День {step.day}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-medium transition-colors",
                  step.done ? "text-ink" : "text-ink-muted",
                )}
              >
                {step.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-faint">
                {step.summary}
              </p>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
