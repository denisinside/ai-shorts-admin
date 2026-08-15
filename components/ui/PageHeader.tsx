import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui";
import { ArrowLeftIcon } from "./icons";

/**
 * Заголовок сторінки. Раніше Topbar сидів у layout із захардкодженим
 * title="Projects" і брехав на всіх внутрішніх сторінках — тепер кожен
 * маршрут оголошує свій заголовок сам.
 */
export function PageHeader({
  title,
  eyebrow,
  backHref,
  backLabel = "Назад",
  actions,
  children,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-4", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h1>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {children}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-ink-faint ring-1 ring-inset ring-white/10">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-faint">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
