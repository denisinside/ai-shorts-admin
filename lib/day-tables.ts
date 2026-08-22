// Trend objects can come from two shapes depending on where they were
// produced: the live Dify pipeline (title/format/hashtags/hook_idea/
// description) or the legacy workshop seed data (format_name/why_it_works/
// example_topic/avg_length_sec/source_url). All fields are optional so the
// UI can render whichever shape actually shows up.
export type Trend = {
  // Dify pipeline shape
  title?: string;
  /** Буває рядком, а буває списком пунктів — залежить від гілки пайплайну. */
  format?: string | string[];
  hashtags?: string[];
  hook_idea?: string;
  description?: string;
  /** Кому адресована стаття — заповнює скіл blog-trends-research. */
  audience?: string;
  /** Тема не підтверджена джерелами; поруч має бути verification_note. */
  needs_verification?: boolean;
  verification_note?: string | null;
  /** Суміжна категорія, якщо пошук довелося розширити на рівень вище. */
  broader_category?: string | null;
  // Legacy seed shape
  format_name?: string;
  why_it_works?: string;
  example_topic?: string;
  avg_length_sec?: number;
  source_url?: string;
};

// jsonb-поля з пайплайну приходять непередбачувано: то масивом, то обʼєктом,
// то рядком із JSON усередині (подвійне кодування на боці Dify). Тому в типах
// вони unknown, а нормалізація — через хелпери нижче.
export type Day1Trends = {
  id: string;
  project_id: string;
  run_id: string;
  trends: unknown;
  sources: unknown;
  // ---- HITL-гейт: дзеркало day2_plan ----
  // Імена й семантика збігаються з Днем 2 навмисно: на цьому тримається
  // спільний обробник кліку в lib/discord-gate.ts.
  approved: boolean;
  /** Хто ухвалив рішення. При approved=false — хто відхилив. */
  approved_by: string | null;
  /**
   * Коли ухвалено рішення. `null` = картка ще висить у Discord.
   * Разом з `approved` дає три стани, тому окремого поля-статусу немає.
   */
  decided_at: string | null;
  /** Незакрите питання до людини; затвердження знімає позначку. */
  needs_review: boolean;
  review_reason: string | null;
  /** Факт про доказову базу — на відміну від needs_review, не знімається. */
  fallback_used: boolean;
  fallback_reason: string | null;
  discord_message_id: string | null;
  /** Запит, з якого зроблено прогін — без нього перезапуск із правками неможливий. */
  research_input: unknown;
  /** Попередня чернетка, яку цей прогін переробляє. */
  revision_of: string | null;
  /** Що саме людина попросила змінити. */
  revision_note: string | null;
};

/** Запит прогону Дня 1. Поля опційні: рядки до появи колонки її не мають. */
export type ResearchInput = {
  niche?: string;
  audience?: string;
  count?: number;
  language?: string;
  markets?: string[] | string;
  notes?: string | null;
};

export function toResearchInput(value: unknown): ResearchInput | null {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as ResearchInput;
}

/** Розгортає рядок із JSON; усе інше повертає як є. */
export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Масив або порожній масив — ніколи не кидає на несподіваній формі даних. */
export function toArray(value: unknown): unknown[] {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

export function toTrends(value: unknown): Trend[] {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) return parsed as Trend[];
  // Пайплайн іноді віддає один тренд обʼєктом, а не масивом з одного елемента
  if (parsed && typeof parsed === "object") return [parsed as Trend];
  return [];
}

/**
 * Значення jsonb для textarea у формі. Подвійно закодований JSON розгортається,
 * інакше адмін бачив би поле у лапках і псував дані при збереженні.
 */
export function toJsonText(value: unknown): string {
  return JSON.stringify(parseMaybeJson(value) ?? [], null, 2);
}

/**
 * Те саме, але для nullable-колонок: порожнє значення лишається порожнім
 * полем, щоб зберегтися назад як null, а не як «[]».
 */
export function toJsonTextOrEmpty(value: unknown): string {
  const parsed = parseMaybeJson(value);
  return parsed == null ? "" : JSON.stringify(parsed, null, 2);
}

/** Варіант гачка з дня 2. Контракт: supabase/day2-plan-contract.md */
export type Hook = {
  /** question | myth_bust | stat | story | promise */
  type?: string;
  text?: string;
  rationale?: string;
  /** Індекс розділу outline, який цей гачок анонсує. */
  section_ref?: number;
};

export type OutlineSection = {
  h2?: string;
  /** Навіщо розділ існує — це читає день 3, а не читач статті. */
  goal?: string;
  key_points?: string[];
  subsections?: string[];
  keywords?: string[];
  /** Джерела з day1.sources, на які спирається саме цей розділ. */
  source_urls?: string[];
  target_words?: number;
};

export type Outline = {
  working_title?: string;
  primary_keyword?: string;
  target_length_words?: number;
  sections?: OutlineSection[];
  cta?: string;
};

/**
 * Знімок теми, обраної з дня 1, на момент затвердження. Авторитетне джерело
 * для дня 3: переживає редагування й видалення вихідного дослідження.
 */
export type SelectedTrend = {
  day1_run_id?: string;
  title?: string;
  description?: string;
  hook_idea?: string;
  audience?: string;
  hashtags?: string[];
  /** Ескіз заголовків із Дня 1 — вхід для outline, не сам outline. */
  format?: string[];
  niche?: string;
  broader_category?: string | null;
  needs_verification?: boolean;
  verification_note?: string | null;
  /** Джерела, які фактчекер допустив до цитування (url, publisher, supports,
   *  relevance: direct|background, has_numbers). */
  sources?: unknown[];
  /** Джерела, відкинуті фактчекером: url + причина. */
  unusable_sources?: unknown[];
  /** Цифри, які дозволено подавати як встановлені: value, claim, url. */
  key_numbers?: unknown[];
  /** strong | partial | none — оцінка доказової бази. */
  evidence_quality?: string;
  selected_at?: string;
  /** Чому саме ця тема з N кандидатів. Старі рядки писали `rationale`,
   *  нові з Dify — `selection_reasoning`; читати треба обидва. */
  rationale?: string;
  selection_reasoning?: string;
  /** high | medium | low — упевненість ноди вибору теми. */
  confidence?: string;
  rejected_alternatives?: unknown[];
};

export const EVIDENCE_LABELS: Record<string, string> = {
  strong: "міцна доказова база",
  partial: "часткова доказова база",
  none: "без джерел",
};

/** Обґрунтування вибору теми — сумісно зі старою й новою формою знімка. */
export function selectedTrendReasoning(
  selected: SelectedTrend | null,
): string | undefined {
  return selected?.selection_reasoning ?? selected?.rationale ?? undefined;
}

export type Day2Plan = {
  id: string;
  project_id: string;
  run_id: string;
  hook_formats: unknown;
  approved: boolean;
  approved_by: string | null;
  fallback_used: boolean;
  /** ЯКА саме умова fallback спрацювала — заповнює День 2. */
  fallback_reason: string | null;
  /** Чернетка: людина ще має подивитися план. Затвердження знімає позначку,
   *  fallback_used при цьому лишається фактом про доказову базу. */
  needs_review: boolean;
  /** Що саме перевірити, людською мовою. */
  review_reason: string | null;
  /**
   * Коли ухвалено рішення. `null` = картка ще висить у Discord і гейт відкритий.
   * Разом з `approved` дає три стани, тому окремого поля-статусу немає:
   * null → чекає, час + true → затверджено, час + false → відхилено.
   */
  decided_at: string | null;
  /** Повідомлення з карткою — його перемальовує воркфлоу після рішення. */
  discord_message_id: string | null;
  /** FK → day1_trends.id; null означає, що дослідження видалили. */
  day1_trends_id: string | null;
  /** Позиція теми в day1_trends.trends — вказівник best-effort. */
  trend_index: number | null;
  selected_trend: unknown;
  outline: unknown;
};

export function toHooks(value: unknown): Hook[] {
  return toArray(value).map((item) =>
    typeof item === "string" ? { text: item } : (item as Hook),
  );
}

export function toOutline(value: unknown): Outline | null {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Outline;
}

export function toSelectedTrend(value: unknown): SelectedTrend | null {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as SelectedTrend;
}

/**
 * Розділ статті. Контракт: supabase/day3-article-contract.md §5.
 * Один елемент = один розділ outline Дня 2, у тому ж порядку.
 */
export type ArticleSection = {
  h2?: string;
  /** Markdown; підрозділи через `###` — другий рівень зайнятий h2 розділу. */
  body_md?: string;
  /** Публічний URL Supabase Storage. Рендериться В КІНЦІ розділу. */
  image_url?: string | null;
  /** З чого зроблено картинку — без цього перегенерувати її неможливо. */
  image_prompt?: string | null;
  image_alt?: string | null;
  /** Фактична довжина, рахує код воркфлоу, не модель. */
  words?: number;
  /** Копія source_urls свого розділу плану — ланцюг чесності Дня 1 → 2 → 3. */
  source_urls?: string[];
  /** Індекс розділу outline, з якого виріс цей; FK на елемент масиву не вказує. */
  plan_index?: number;
};

export type ArticleSeo = {
  seo_title?: string;
  meta_description?: string;
  slug?: string;
  og_title?: string;
  og_description?: string;
  keywords?: string[];
};

/** Оцінка одного критерію рубрики. Поля різні, спільне лише `pass`. */
export type QualityCriterion = { pass?: boolean } & Record<string, unknown>;

/**
 * Телеметрія прогону — вхід для таблиці «до/після».
 * `tokens_total` приходить з Dify Logs окремо: воркфлоу не бачить власного
 * споживання токенів, тому в графі чесно міряється лише час.
 */
export type ArticleMetrics = {
  workflow_run_id?: string;
  elapsed_ms?: number;
  llm_calls?: number;
  image_calls?: number;
  models?: Record<string, number>;
  /** Скільки розділів повернув редактор. Завжди 0 = редактор нічого не ловить. */
  rewrites?: number;
  /** `dify` означає, що аплоад у Storage не вдався і посилання протухне. */
  images_stored?: "supabase" | "dify";
  tokens_total?: number | null;
  quality?: Record<string, QualityCriterion | number>;
};

/** Який пайплайн зробив рядок — на цьому тримається таблиця порівняння. */
export type ArticlePipeline = "baseline" | "optimized";

export const PIPELINE_LABELS: Record<ArticlePipeline, string> = {
  baseline: "Baseline",
  optimized: "Optimized",
};

export const PIPELINE_STYLES: Record<ArticlePipeline, string> = {
  baseline: "text-ink-muted ring-white/12",
  optimized: "bg-arc/14 text-arc ring-arc/30",
};

/**
 * Стаття Дня 3. На відміну від Днів 1 і 2, рядків на проєкт навмисно багато:
 * baseline і optimized пишуть у ту саму таблицю, і різниця між ними — предмет
 * дня. Контракт: supabase/day3-article-contract.md
 */
export type Day3Article = {
  id: string;
  project_id: string;
  /** null означає, що план видалили — стаття лишається. */
  day2_plan_id: string | null;
  run_id: string;
  pipeline: ArticlePipeline;
  /** Мітка ітерації оптимізації: opt-v1, opt-v2… */
  variant: string | null;
  title: string;
  thumbnail_url: string | null;
  /** Markdown без власного заголовка — H1 живе в `title`. */
  intro: string;
  sections: unknown;
  conclusion_h2: string;
  conclusion: string;
  cta: string | null;
  seo: unknown;
  // ---- HITL-гейт: дзеркало Днів 1 і 2 ----
  approved: boolean;
  approved_by: string | null;
  decided_at: string | null;
  needs_review: boolean;
  review_reason: string | null;
  fallback_used: boolean;
  fallback_reason: string | null;
  discord_message_id: string | null;
  metrics: unknown;
  created_at: string;
};

export function toSections(value: unknown): ArticleSection[] {
  return toArray(value).map((item) =>
    typeof item === "string" ? { body_md: item } : (item as ArticleSection),
  );
}

export function toSeo(value: unknown): ArticleSeo | null {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as ArticleSeo;
}

export function toMetrics(value: unknown): ArticleMetrics | null {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as ArticleMetrics;
}

/**
 * Скільки критеріїв рубрики пройдено. Читає готовий `score`, а якщо його
 * немає — рахує по вкладених `pass`: рядки, записані до появи score, теж
 * мають щось показувати.
 */
export function qualityScore(
  metrics: ArticleMetrics | null,
): { passed: number; total: number } | null {
  const quality = metrics?.quality;
  if (!quality) return null;

  const criteria = Object.entries(quality).filter(
    ([key, value]) =>
      key !== "score" && value !== null && typeof value === "object",
  ) as [string, QualityCriterion][];

  if (criteria.length === 0) return null;

  const passed =
    typeof quality.score === "number"
      ? quality.score
      : criteria.filter(([, value]) => value.pass === true).length;

  return { passed, total: criteria.length };
}

/** Довжина статті в словах: сума розділів + вступ і висновок. */
export function articleWords(article: Day3Article): number {
  const countWords = (text: string) =>
    text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    countWords(article.intro) +
    countWords(article.conclusion) +
    toSections(article.sections).reduce(
      (sum, section) =>
        sum + (section.words ?? countWords(section.body_md ?? "")),
      0,
    )
  );
}

/** «3 хв 4 с» — цифра з metrics читабельно. */
export function formatElapsed(ms: number | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} с`;
  return `${Math.floor(seconds / 60)} хв ${seconds % 60} с`;
}

export type Day4Video = {
  id: string;
  project_id: string;
  run_id: string;
  shotlist: unknown;
  video_url: string | null;
  voiceover_url: string | null;
  knowledge_refs: unknown;
  status: string | null;
};
