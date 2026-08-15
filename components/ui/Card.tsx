import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

/**
 * Шар контенту (L1). Скло тут стримане: адмінка живе даними, тому картка не
 * має конкурувати з таблицею всередині себе.
 */
export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("glass rounded-2xl", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-white/6 px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-0.5 truncate text-base font-semibold text-ink">
          {title}
        </h2>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
