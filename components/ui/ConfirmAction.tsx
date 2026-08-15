"use client";

import { useRef, useTransition, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";
import { WarningIcon } from "./icons";

/**
 * Руйнівна дія за підтвердженням. Нативний <dialog> дає фокус-пастку, ESC
 * та inert-фон від браузера — без жодної залежності.
 */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel = "Видалити",
  pendingLabel = "Видаляємо…",
  trigger,
  triggerVariant = "ghost",
  triggerSize = "sm",
  triggerLabel,
}: {
  action: () => Promise<void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  trigger: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  /** Доступна назва, коли тригер — лише іконка. */
  triggerLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await action();
      dialogRef.current?.close();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        aria-label={triggerLabel}
        onClick={() => dialogRef.current?.showModal()}
      >
        {trigger}
      </Button>

      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="confirm-title"
        onClick={(event) => {
          // Клік по підкладці: ціль події — сам <dialog>, а не його вміст
          if (event.target === dialogRef.current && !pending) {
            dialogRef.current?.close();
          }
        }}
      >
        <div className="glass-overlay rounded-2xl p-5">
          <div className="flex gap-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger/14 text-danger ring-1 ring-inset ring-danger/30">
              <WarningIcon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h2 id="confirm-title" className="text-base font-semibold text-ink">
                {title}
              </h2>
              <div className="mt-1 text-sm text-ink-muted">{description}</div>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
            >
              Скасувати
            </Button>
            <Button
              type="button"
              variant="danger"
              pending={pending}
              pendingLabel={pendingLabel}
              onClick={confirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
