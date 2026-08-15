import { Button, LinkButton } from "./Button";
import { WarningIcon } from "./icons";

/**
 * Спільний «підвал» усіх форм: помилка сервера + сабміт + скасування.
 * Раніше цей блок був скопійований у кожну з пʼяти форм.
 */
export function FormFooter({
  error,
  pending,
  submitLabel,
  pendingLabel = "Зберігаємо…",
  cancelHref,
}: {
  error?: string | null;
  pending?: boolean;
  submitLabel: string;
  pendingLabel?: string;
  cancelHref: string;
}) {
  return (
    <div className="space-y-4 border-t border-white/6 pt-5">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-danger/12 px-3.5 py-2.5 text-sm text-danger ring-1 ring-inset ring-danger/25"
        >
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          pendingLabel={pendingLabel}
        >
          {submitLabel}
        </Button>
        <LinkButton href={cancelHref} variant="ghost">
          Скасувати
        </LinkButton>
      </div>
    </div>
  );
}
