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
};

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
  hook_idea?: string;
  audience?: string;
  hashtags?: string[];
  needs_verification?: boolean;
  sources?: unknown[];
  selected_at?: string;
  /** Чому саме ця тема з N кандидатів. */
  rationale?: string;
};

export type Day2Plan = {
  id: string;
  project_id: string;
  run_id: string;
  hook_formats: unknown;
  approved: boolean;
  approved_by: string | null;
  fallback_used: boolean;
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

export type Day3Assets = {
  id: string;
  project_id: string;
  run_id: string;
  script: string | null;
  hook_variants: unknown;
  /** Підказки ілюстрацій — по одній на розділ outline. Колонка була в базі
   *  від початку, але панель про неї не знала. */
  shot_hints: unknown;
  thumbnail_url: string | null;
};

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
