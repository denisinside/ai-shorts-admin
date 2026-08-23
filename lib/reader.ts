import {
  articleWords,
  toSections,
  toSeo,
  type ArticleSection,
  type ArticleSeo,
  type Day3Article,
} from "./day-tables";

/**
 * Модель даних читацької сторінки («Wait, What?»).
 *
 * Сторінка живе окремим коренем (`app/(reader)`) і навмисно НЕ знає про типи
 * панелі: усе, що вона показує, зводиться сюди до однієї плоскої форми
 * `ReaderArticle`. Тому демонстраційні картки з макета й справжні рядки
 * `day3_article` рендерить один і той самий компонент, а не дві гілки верстки.
 *
 * Форма плоска ще й тому, що вікно статті — клієнтський компонент: усе, що
 * туди їде, мусить бути серіалізовним.
 */

/** Скільки слів на хвилину читає людина — для «7 хв читання» на картці. */
const WORDS_PER_MINUTE = 200;

/** Скільки символів анотації влазить у картку, доки вона не поїхала. */
const EXCERPT_LIMIT = 190;

/**
 * Акценти карток — рівно ті чотири з макета. Колір обирається хешем `id`, а не
 * позицією в списку: інакше стаття перефарбовувалася б від кожного нового
 * прогону, який став перед нею.
 */
const ACCENTS = ["#ff63a8", "#38a9ff", "#5b84ff", "#6c8cff"] as const;

export type ReaderArticle = {
  /** uuid рядка `day3_article` або `demo-N` для картки з макета. */
  id: string;
  title: string;
  /** Рубрика в титульному рядку картки: ніша проєкту або категорія макета. */
  category: string;
  excerpt: string;
  minutes: number;
  /** Публічний URL обкладинки; `null` — малюємо градієнтну (див. reader.css). */
  cover: string | null;
  accent: string;

  // ---- повна структура статті: рівно те, що описує day3-article-contract ----
  intro: string;
  sections: ArticleSection[];
  conclusionH2: string | null;
  conclusion: string | null;
  cta: string | null;
  seo: ArticleSeo | null;

  // ---- походження: чернетку читач мусить бачити як чернетку ----
  /** `true` — картка з макета, за нею немає рядка в базі. */
  demo: boolean;
  /** Який прогін це написав. Лишається в моделі для діагностики, у верстку
   *  не йде: читачеві «optimized / opt-v2» не означає нічого. */
  pipeline: string | null;
  variant: string | null;
  approved: boolean;
  needsReview: boolean;
  createdAt: string | null;
  /** Кудою вернутися в панель. `null` у демо-карток. */
  projectId: string | null;
  words: number;
};

/**
 * Рядок статті разом із нішею свого проєкту. Ніша — єдине, що читацька
 * сторінка бере з `projects`, і вона потрібна як рубрика на картці, тому
 * тягнемо її вбудованим ресурсом, а не другим запитом.
 */
export type ArticleRow = Day3Article & {
  projects: { niche: string | null } | null;
};

/**
 * Глибоке посилання з панелі приходить довільним рядком, а демо-картки мають
 * id `demo-N`. Без цієї перевірки `?article=demo-1` пішов би у PostgREST і
 * повернув 22P02 замість статті.
 */
export function isUuid(value: string | undefined | null): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Колір картки — детермінований, тому однаковий на сервері й після гідратації. */
function accentFor(id: string): string {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) {
    sum = (sum + id.charCodeAt(index) * (index + 1)) % 65_536;
  }
  return ACCENTS[sum % ACCENTS.length];
}

/**
 * Ніша проєкту як рубрика. Ніші бувають довгими реченнями («крипто для
 * початківців, що шукають швидкий заробіток»), а титульний рядок картки — це
 * 9px капіталками, тому беремо першу частину до коми й ріжемо.
 */
function shortCategory(niche: string | null | undefined): string {
  const source = niche?.trim();
  if (!source) return "Блог";
  const head = source.split(/[,—–:(]/)[0].trim() || source;
  return head.length > 30 ? `${head.slice(0, 29).trimEnd()}…` : head;
}

/** Розмітку в анотації читач побачив би як сміття, тому знімаємо її. */
function stripMarkdown(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Анотація картки. `meta_description` для цього й існує; якщо SEO ще немає —
 * беремо перший абзац вступу, бо саме він несе обіцянку статті.
 */
function excerptFrom(seo: ArticleSeo | null, intro: string): string {
  const meta = seo?.meta_description?.trim();
  if (meta) return meta;

  const plain = stripMarkdown(intro.split(/\n{2,}/)[0] ?? "");
  if (plain.length <= EXCERPT_LIMIT) return plain;

  const cut = plain.slice(0, EXCERPT_LIMIT);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Обкладинка: власний thumbnail, а якщо його немає — перша ілюстрація
 * розділу. У реальних даних обидва поля бувають порожнім РЯДКОМ, а не null
 * (так їх пише воркфлоу), тому перевіряємо на непорожність, а не на `!= null`.
 */
function coverFrom(
  thumbnail: string | null,
  sections: ArticleSection[],
): string | null {
  if (thumbnail?.trim()) return thumbnail.trim();
  const fromSection = sections.find((section) => section.image_url?.trim());
  return fromSection?.image_url?.trim() ?? null;
}

export function toReaderArticle(row: ArticleRow): ReaderArticle {
  const sections = toSections(row.sections);
  const seo = toSeo(row.seo);
  const words = articleWords(row);

  return {
    id: row.id,
    title: row.title,
    category: shortCategory(row.projects?.niche),
    excerpt: excerptFrom(seo, row.intro),
    minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    cover: coverFrom(row.thumbnail_url, sections),
    accent: accentFor(row.id),

    intro: row.intro,
    sections,
    conclusionH2: row.conclusion_h2,
    conclusion: row.conclusion,
    cta: row.cta,
    seo,

    demo: false,
    pipeline: row.pipeline,
    variant: row.variant,
    approved: row.approved,
    needsReview: row.needs_review,
    createdAt: row.created_at,
    projectId: row.project_id,
    words,
  };
}

/**
 * Термін глосарія. Своєї таблиці термінів у проєкті немає, і заводити її під
 * одне вікно було б дорого — але `seo.keywords` кожної статті це вже, по суті,
 * і є перелік того, про що вона. Тому глосарій збирається з них.
 *
 * `count` — у скількох статтях термін зустрівся. Саме він робить вікно
 * корисним: видно, навколо чого блог обертається, а не просто список слів.
 */
export type GlossaryTerm = { term: string; count: number };

export function glossaryTerms(articles: ReaderArticle[]): GlossaryTerm[] {
  const seen = new Map<string, GlossaryTerm>();

  for (const article of articles) {
    // Ключі однієї статті можуть повторюватися між собою — рахуємо статті,
    // а не входження, інакше одна стаття накрутила б собі вагу
    const unique = new Set(
      (article.seo?.keywords ?? [])
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 1),
    );

    for (const keyword of unique) {
      const key = keyword.toLowerCase();
      const existing = seen.get(key);
      if (existing) existing.count += 1;
      // Показуємо перше написання: пайплайн пише то з великої, то з малої
      else seen.set(key, { term: keyword, count: 1 });
    }
  }

  return [...seen.values()].sort((a, b) =>
    a.term.localeCompare(b.term, "uk"),
  );
}

/** Фасети стрічки. Це не колонки бази, а те, що читач хоче звузити. */
export type ReaderFacet = "all" | "ready" | "draft" | "saved" | "demo";

export const FACET_LABELS: Record<ReaderFacet, string> = {
  all: "Статті",
  ready: "Готові",
  draft: "Чернетки",
  saved: "Збережене",
  demo: "Демо",
};

export function matchesFacet(
  article: ReaderArticle,
  facet: ReaderFacet,
  saved: ReadonlySet<string>,
): boolean {
  switch (facet) {
    case "ready":
      return !article.demo && article.approved;
    case "draft":
      return !article.demo && !article.approved;
    case "saved":
      return saved.has(article.id);
    case "demo":
      return article.demo;
    default:
      return true;
  }
}
