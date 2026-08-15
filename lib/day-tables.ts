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

export type Day2Plan = {
  id: string;
  project_id: string;
  run_id: string;
  hook_formats: unknown;
  approved: boolean;
  approved_by: string | null;
  fallback_used: boolean;
};

export type Day3Assets = {
  id: string;
  project_id: string;
  run_id: string;
  script: string | null;
  hook_variants: unknown;
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
