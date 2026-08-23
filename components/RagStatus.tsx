import { toRag, type Day3Article } from "@/lib/day-tables";
import { Badge } from "./ui/Badge";
import { WarningIcon } from "./ui/icons";

/**
 * Теми редакційного стандарту, які граф питає окремими запитами. Провалена
 * тема — це не «стаття без стандарту», а «стаття без ЦІЄЇ частини стандарту»,
 * тому в попередженні мусять бути імена, а не лише кількість.
 */
const KB_TOPICS: Record<string, string> = {
  voice: "голос",
  struct: "структура",
  head: "заголовки",
  seo: "SEO",
};

/**
 * Чим заземлювався прогін. Стаття, написана без редакційного стандарту, не
 * гірша сама по собі — але падіння критерію «Редакційний стандарт» на ній
 * означає зовсім інше: правил ніхто не сказав. Без цього рядка людина читає
 * рубрику як оцінку моделі.
 *
 * Старі рядки, зроблені до заземлення, `rag` не мають — там компонент
 * нічого не малює: «прогін без заземлення» на них було б переписуванням
 * історії, а не фактом про прогін.
 */
export default function RagStatus({ article }: { article: Day3Article }) {
  const rag = toRag(article.metrics);
  if (!rag) return null;

  const enabled = rag.enabled === true;
  const chunks = typeof rag.chunks === "number" ? rag.chunks : 0;
  const sources = Array.isArray(rag.sources)
    ? rag.sources.filter((id): id is string => typeof id === "string")
    : [];
  const failed = Array.isArray(rag.failed)
    ? rag.failed.filter((name): name is string => typeof name === "string")
    : [];
  // Заземлення просили, а база знань нічого не віддала. Це не те саме, що
  // прогін без заземлення: стаття вийшла як «без RAG», і списати її потім на
  // модель було б неправдою.
  const askedButEmpty = enabled && chunks === 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={
            enabled && chunks > 0
              ? "bg-ok/14 text-ok ring-ok/30"
              : "text-ink-muted ring-white/12"
          }
        >
          {enabled && chunks > 0
            ? `Заземлено на редакційний стандарт · ${chunks} фрагментів`
            : "Прогін без заземлення"}
        </Badge>
        {typeof rag.top_score === "number" && rag.top_score > 0 && (
          <span className="tabular text-xs text-ink-faint">
            найкращий збіг {rag.top_score.toFixed(2)}
            {typeof rag.min_score === "number" && rag.min_score > 0
              ? ` · найгірший ${rag.min_score.toFixed(2)}`
              : ""}
          </span>
        )}
      </div>

      {askedButEmpty && (
        <p className="flex items-start gap-2 rounded-lg bg-warn/8 px-3 py-2 text-xs leading-relaxed text-warn ring-1 ring-inset ring-warn/20">
          <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Стандарт питали, але база знань не віддала жодного фрагмента — статтю
          писали без правил видавця
        </p>
      )}

      {failed.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warn/8 px-3 py-2 text-xs leading-relaxed text-warn ring-1 ring-inset ring-warn/20">
          <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Не приїхали теми стандарту:{" "}
          {failed.map((name) => KB_TOPICS[name] ?? name).join(", ")}
        </p>
      )}

      {/* Це id чанків kb/… — вони цікаві тільки при розборі «чому стаття
          написана саме так», тому за замовчуванням складені */}
      {sources.length > 0 && (
        <details className="text-xs text-ink-faint">
          <summary className="cursor-pointer text-ink-muted transition-colors hover:text-ink">
            Фрагменти стандарту ({sources.length})
          </summary>
          <ul className="mt-1.5 space-y-0.5 font-mono">
            {sources.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
