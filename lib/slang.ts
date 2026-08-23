import { createClient } from "@/lib/supabase";

/**
 * Словник сленгу для читалки: індекс для підкреслювання слів у чаті і повні
 * статті для віконця-словника.
 *
 * ЧОМУ ДВА РІЗНІ ЗАПИТИ, А НЕ ОДИН. Індекс потрібен на кожну репліку бота, і
 * в ньому 389 рядків — але лише ті поля, без яких не обійтися: написання
 * (щоб знайти слово в тексті), короткий опис (щоб намалювати список) і
 * прапорець неоднозначності. Це ~90 КБ. Повні статті з поясненням і
 * прикладами — це ~840 КБ на весь словник, і вони потрібні рівно для того
 * слова, по якому клацнули.
 *
 * ЧОМУ ПРАПОРЕЦЬ `ambiguous` ПРИХОДИТЬ КОЛОНКОЮ. Той самий список слів
 * («ate», «so», «cap» — і терміни, і звичайна англійська) потрібен матчеру
 * в Dify і матчеру тут. Дві копії списку в двох матчерах розсинхронилися б
 * на першій же правці, тому джерело істини одне: `slang/data/ordinary.txt`
 * заливається в колонку, а обидва матчери її читають.
 */

/** Рядок індексу: рівно те, що потрібно, щоб знайти слово й показати в списку. */
export type SlangIndexEntry = {
  key: string;
  term: string;
  aka: string[];
  short: string;
  partOfSpeech: string;
  register: string;
  /** Слово збігається зі звичайним англійським — у тексті не підкреслюємо. */
  ambiguous: boolean;
};

/** Повна стаття словника. Тягнеться на клік, а не разом з індексом. */
export type SlangEntry = SlangIndexEntry & {
  explanation: string;
  ukEquivalents: string[];
  enSynonyms: string[];
  related: string[];
  examples: { en: string; uk: string }[];
  sources: { source: string; url: string }[];
  urbanPermalinks: string[];
};

const INDEX_COLUMNS = "key,term,aka,short,part_of_speech,register,ambiguous";
const FULL_COLUMNS = `${INDEX_COLUMNS},explanation,uk_equivalents,en_synonyms,related,examples,sources,urban_permalinks`;

/** jsonb з бази приходить непередбачувано — то масивом, то рядком із JSON. */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function toExamples(value: unknown): { en: string; uk: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as { en?: unknown; uk?: unknown };
    if (typeof item.en !== "string" || typeof item.uk !== "string") return [];
    return [{ en: item.en, uk: item.uk }];
  });
}

function toSources(value: unknown): { source: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as { source?: unknown; url?: unknown };
    if (typeof item.url !== "string") return [];
    return [{ source: typeof item.source === "string" ? item.source : "", url: item.url }];
  });
}

type Row = Record<string, unknown>;

function toIndexEntry(row: Row): SlangIndexEntry {
  return {
    key: String(row.key ?? ""),
    term: String(row.term ?? ""),
    aka: toStringArray(row.aka),
    short: String(row.short ?? ""),
    partOfSpeech: String(row.part_of_speech ?? ""),
    register: String(row.register ?? ""),
    ambiguous: row.ambiguous === true,
  };
}

function toEntry(row: Row): SlangEntry {
  return {
    ...toIndexEntry(row),
    explanation: String(row.explanation ?? ""),
    ukEquivalents: toStringArray(row.uk_equivalents),
    enSynonyms: toStringArray(row.en_synonyms),
    related: toStringArray(row.related),
    examples: toExamples(row.examples),
    sources: toSources(row.sources),
    urbanPermalinks: toStringArray(row.urban_permalinks),
  };
}

export async function fetchSlangIndex(): Promise<SlangIndexEntry[]> {
  const supabase = createClient();
  // Сортування за `key`, а не за `term`: у списку словника поруч мусять стояти
  // «no cap» і «no crumbs», а не «No cap» і «no crumbs» через регістр літери.
  const { data, error } = await supabase
    .from("slang_terms")
    .select(INDEX_COLUMNS)
    .order("key", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toIndexEntry(row as Row));
}

export async function fetchSlangEntries(keys: string[]): Promise<SlangEntry[]> {
  if (!keys.length) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("slang_terms")
    .select(FULL_COLUMNS)
    .in("key", keys.slice(0, 20));
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toEntry(row as Row));
}
