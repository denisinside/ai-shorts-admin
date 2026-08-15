"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WarningIcon } from "@/components/ui/icons";

/**
 * Раніше будь-яка помилка Supabase просто прокидалась нагору — користувач
 * бачив дефолтний краш-екран Next без жодної підказки, що робити.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/14 text-danger ring-1 ring-inset ring-danger/30">
        <WarningIcon className="h-5 w-5" />
      </span>
      <h1 className="text-lg font-semibold text-ink">Щось пішло не так</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Не вдалося отримати дані з бази. Перевірте зʼєднання з Supabase і
        спробуйте ще раз.
      </p>

      <p className="mt-4 rounded-xl bg-white/4 px-3 py-2 font-mono text-xs break-words text-ink-faint ring-1 ring-inset ring-white/8">
        {error.message}
        {error.digest && ` (digest: ${error.digest})`}
      </p>

      <div className="mt-5 flex items-center justify-center gap-2">
        <Button variant="primary" onClick={reset}>
          Спробувати ще раз
        </Button>
        <LinkButton href="/" variant="ghost">
          До проєктів
        </LinkButton>
      </div>
    </Card>
  );
}
