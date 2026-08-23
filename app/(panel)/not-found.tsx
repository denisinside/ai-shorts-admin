import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LayersIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-ink-faint ring-1 ring-inset ring-white/10">
        <LayersIcon className="h-5 w-5" />
      </span>
      <h1 className="text-lg font-semibold text-ink">Сторінку не знайдено</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Можливо, запис уже видалено або посилання застаріло.
      </p>
      <div className="mt-5">
        <LinkButton href="/" variant="primary">
          До списку проєктів
        </LinkButton>
      </div>
    </Card>
  );
}
