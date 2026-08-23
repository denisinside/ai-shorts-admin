import type { SlangEntry, SlangIndexEntry } from "@/lib/slang";

/**
 * Пошук термінів словника у тексті чату — той самий алгоритм, що в Code-ноді
 * воркфлоу WaitBot, тільки в браузері й заради підкреслення, а не промпту.
 *
 * ЧОМУ TRIE ПО ТОКЕНАХ, А НЕ РЕГУЛЯРКА ПО СЛОВАХ. Термінів 389, з них
 * шістдесят багатослівні («standing on business», «ate and left no crumbs» —
 * п'ять токенів). Регулярка з 389 альтернатив ловила б підрядки («cap» у
 * «capacity») і не давала б найдовшого збігу: «no cap» розпалося б на «no» +
 * «cap», і людина клацнула б на слово з протилежним значенням.
 *
 * ЩО РОБИМО З `ambiguous`. «ate», «so», «cap», «ghost» — це і терміни, і
 * звичайні англійські слова, і токенний матчер їх розрізнити НЕ МОЖЕ. У
 * промпті такий збіг іде окремим списком, бо там рішення ухвалює модель, у
 * якої є все речення. Тут вирішувати нікому, тому правило простіше й
 * жорсткіше: **точна форма такого слова не підкреслюється, а відмінена —
 * підкреслюється**. «I ate lunch» і «the ghost» лишаються текстом, а
 * «he ghosted me» і «she was simping» підсвічуються — саме у відміненій
 * формі живе сленгове значення, а в базовій — звичайне.
 */

const TOKEN_RE = /[a-z0-9']+/gi;
const MAX_LEN = 6;
const SUFFIXES = ["ing", "ers", "ed", "es", "er", "s", "in"] as const;

type Token = { text: string; start: number; end: number };

/** Легкий стемінг: набір можливих основ, а не одна «правильна». */
function variants(token: string): string[] {
  const base = token.replace(/^'+|'+$/g, "");
  if (!base) return [];
  const out = new Set<string>([base]);
  for (const suffix of SUFFIXES) {
    if (base.endsWith(suffix) && base.length - suffix.length >= 3) {
      const stem = base.slice(0, -suffix.length);
      out.add(stem);
      out.add(`${stem}e`); // glazing -> glaze
    }
  }
  return [...out];
}

export type SlangIndex = {
  /** послідовність токенів -> ключ терміна + чи це слово ще й звичайне */
  byTokens: Map<string, { key: string; ambiguous: boolean }>;
  byKey: Map<string, SlangIndexEntry>;
};

export function buildSlangIndex(entries: SlangIndexEntry[]): SlangIndex {
  const byTokens = new Map<string, { key: string; ambiguous: boolean }>();
  const byKey = new Map<string, SlangIndexEntry>();

  const forms: { key: string; tokens: string[]; ambiguous: boolean }[] = [];
  for (const entry of entries) {
    if (!entry.key) continue;
    byKey.set(entry.key, entry);
    const seen = new Set<string>();
    for (const raw of [entry.term, entry.key, ...entry.aka]) {
      const tokens = (raw ?? "").toLowerCase().match(TOKEN_RE);
      if (!tokens) continue;
      const id = tokens.join(" ");
      if (seen.has(id)) continue;
      seen.add(id);
      // Прапорець ставиться лише однослівним: «no cap» звичайною фразою не
      // буває, а «cap» — буває.
      forms.push({ key: entry.key, tokens, ambiguous: entry.ambiguous && tokens.length === 1 });
    }
  }

  // Два проходи, і порядок принциповий: спершу всі точні написання, потім
  // варіанти. Одним проходом варіант слова A зайняв би комірку, яка є точним
  // написанням слова B, і B перестало б знаходитися взагалі.
  const put = (tokens: string[], key: string, ambiguous: boolean) => {
    const id = tokens.join(" ");
    if (!byTokens.has(id)) byTokens.set(id, { key, ambiguous });
  };
  for (const form of forms) put(form.tokens, form.key, form.ambiguous);
  for (const form of forms) {
    const last = form.tokens[form.tokens.length - 1];
    for (const variant of variants(last)) {
      put([...form.tokens.slice(0, -1), variant], form.key, form.ambiguous);
    }
  }

  return { byTokens, byKey };
}

export type SlangSpan = { start: number; end: number; key: string; surface: string };

export function findSlangSpans(text: string, index: SlangIndex): SlangSpan[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN_RE)) {
    if (match.index === undefined) continue;
    tokens.push({
      text: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const spans: SlangSpan[] = [];
  let i = 0;
  while (i < tokens.length) {
    let step = 1;
    for (let n = Math.min(MAX_LEN, tokens.length - i); n >= 1; n -= 1) {
      const window = tokens.slice(i, i + n);
      const words = window.map((token) => token.text);
      const last = words[words.length - 1];
      const exact = index.byTokens.get(words.join(" "));
      let key: string | undefined;

      if (exact) {
        // Точна форма слова, яке є ще й звичайним англійським — майже завжди
        // саме звичайне слово. Не підкреслюємо й не з'їдаємо токен.
        if (!exact.ambiguous) key = exact.key;
      } else {
        // Стемінг мусить працювати з обох боків: варіанти лише в індексі
        // ловлять «glaze» на термін «glazing», але не «rizzed» на «rizz».
        // Тут же відмінена форма легалізує й неоднозначне слово: «ghosted»
        // — це вже сленг, а не привид.
        for (const variant of variants(last)) {
          if (variant === last) continue;
          const hit = index.byTokens.get([...words.slice(0, -1), variant].join(" "));
          if (hit) {
            key = hit.key;
            break;
          }
        }
      }

      if (key) {
        spans.push({
          start: window[0].start,
          end: window[window.length - 1].end,
          key,
          surface: text.slice(window[0].start, window[window.length - 1].end),
        });
        step = n;
        break;
      }
    }
    i += step;
  }
  return spans;
}

/* ------------------------------------------------------------------ загрузка
   Індекс тягнеться ОДИН раз на вкладку і лежить у модулі: він потрібен і чату
   (на кожну репліку), і вікну словника, а важить ~90 КБ. Обіцянка кешується, а
   не результат, щоб два одночасні виклики не зробили два запити.
   -------------------------------------------------------------------------- */
let indexPromise: Promise<SlangIndex> | null = null;

export function loadSlangIndex(): Promise<SlangIndex> {
  if (!indexPromise) {
    indexPromise = fetch("/api/slang")
      .then((response) => response.json() as Promise<{ terms?: SlangIndexEntry[] }>)
      .then((body) => buildSlangIndex(body.terms ?? []))
      .catch(() => buildSlangIndex([])); // без словника чат просто не підкреслює
  }
  return indexPromise;
}

const entryCache = new Map<string, Promise<SlangEntry | null>>();

export function loadSlangEntry(key: string): Promise<SlangEntry | null> {
  const cached = entryCache.get(key);
  if (cached) return cached;
  const request = fetch(`/api/slang?key=${encodeURIComponent(key)}`)
    .then((response) => response.json() as Promise<{ entries?: SlangEntry[] }>)
    .then((body) => body.entries?.[0] ?? null)
    .catch(() => null);
  entryCache.set(key, request);
  return request;
}
