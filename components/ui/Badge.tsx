import { cn } from "@/lib/ui";
import { STATUS_LABELS, STATUS_STYLES, type Status } from "@/lib/projects";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge className={STATUS_STYLES[status]}>
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
      />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
