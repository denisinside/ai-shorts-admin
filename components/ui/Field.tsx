import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/ui";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink-muted"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="text-xs font-medium text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-xs text-ink-faint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn("field", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn("field", className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn("field field-select", className)} />;
}

export function Checkbox({
  label,
  className,
  ...props
}: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        "glass pressable flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink",
        className,
      )}
    >
      <input
        {...props}
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/10 accent-[var(--color-arc)]"
      />
      {label}
    </label>
  );
}

/** Текстове поле з міткою — найчастіший випадок у формах. */
export function TextField({
  label,
  name,
  hint,
  error,
  className,
  ...props
}: ComponentProps<"input"> & {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  error?: ReactNode;
}) {
  return (
    <Field label={label} htmlFor={name} hint={hint} error={error}>
      <Input
        id={name}
        name={name}
        type="text"
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${name}-error` : hint ? `${name}-hint` : undefined
        }
        className={className}
        {...props}
      />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  options,
  hint,
  ...props
}: ComponentProps<"select"> & {
  label: ReactNode;
  name: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  hint?: ReactNode;
}) {
  return (
    <Field label={label} htmlFor={name} hint={hint}>
      <Select id={name} name={name} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
