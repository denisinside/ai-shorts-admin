import type { SlangIndex } from "@/lib/slang-client";

/**
 * Підказки під інпутом чату — щоразу інші, зібрані зі справжнього словника.
 *
 * ЧОМУ НЕ ЧОТИРИ ЗАШИТІ РЯДКИ. Зашиті підказки навчають рівно чотирьом
 * питанням: людина натискає «ЩО ТАКЕ RIZZ», отримує відповідь і більше не має
 * куди тицьнути. Словник із 389 слів дає нескінченну кількість питань — і
 * заодно показує, що там усередині значно більше, ніж rizz і delulu.
 *
 * ЧОМУ ЗЖЕРЕБІЙ КИДАЄ ПАНЕЛЬ, А НЕ СЕРВЕР. Кубик у рендері серверного проходу
 * дав би інший набір, ніж на клієнті, і React зустрів би розбіжність
 * гідратації на кожному завантаженні `/blog`. Тому початковий набір —
 * константа, а перекидання відбувається вже в браузері: після того, як
 * приїхав індекс, і після кожної відповіді бота.
 *
 * ЧОМУ ФОРМИ РІЗНІ. Чотири однотипні «що таке X» не показують, що бот уміє
 * ще й перекладати в обидва боки й кидати меми. Тому в наборі завжди різні
 * ЖАНРИ питань — по одному на гілку воркфлоу.
 */

export type Suggestion = { label: string; query: string };

/** Показується до того, як приїхав індекс, і на сервері. Без випадковості. */
export const STARTER_SUGGESTIONS: Suggestion[] = [
  { label: "ЩО ТАКЕ RIZZ", query: "що таке rizz" },
  { label: "HE HAS NO RIZZ FR FR", query: "he has no rizz fr fr" },
  {
    label: "ПЕРЕКЛАДИ НА ЗУМЕРСЬКУ",
    query: "переклади на зумерську: він дуже впевнений у собі, хоча підстав нема",
  },
  { label: "КИНЬ МЕМ ПРО ПОНЕДІЛОК", query: "кинь мем про понеділок" },
];

/** Нейтральні речення для «перекладіть на зумерську». */
const PHRASES = [
  "він дуже впевнений у собі, хоча підстав нема",
  "я нічого не хочу робити цього тижня",
  "вона вдягнулася просто неймовірно",
  "він прочитав і не відповів",
  "ця вечірка була найкраща за рік",
  "я витратив усі гроші на дурниці",
  "мені соромно за те, що я сказав",
  "цей серіал перехвалили",
  "я всю ніч не спав і тепер помираю",
  "він зник і не пояснив нічого",
];

/** Теми мемів — іменниками: усі підставляються у «мем про X» і мусять
 *  читатися. «мем про коли писати нікому» — вже ні. */
const MEME_THEMES = [
  "понеділок",
  "дедлайни",
  "іспити",
  "недосип",
  "робочі зустрічі",
  "безгрошів'я",
  "спортзал",
  "каву",
  "прокрастинацію",
  "весну",
];

/** Дрібний детермінований кубик не потрібен — рандом тут живе рівно тут. */
function pick<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Maker = () => Suggestion | null;

export function pickSuggestions(index: SlangIndex | null, count = 4): Suggestion[] {
  const all = index ? [...index.byKey.values()] : [];
  // Однослівні неоднозначні («ate», «so») у підказки не беремо: питання «що
  // таке so» виглядає як помилка, а не як пропозиція.
  const terms = all.filter((entry) => !entry.ambiguous && entry.term.length > 1);
  if (terms.length < 4) return STARTER_SUGGESTIONS;

  const withUk = terms.filter((entry) => entry.ukEquivalents.length > 0);

  const makers: Maker[] = [
    // 1. пояснити слово
    () => {
      const entry = pick(terms);
      if (!entry) return null;
      return {
        label: `ЩО ТАКЕ ${entry.term.toUpperCase()}`,
        query: `що таке ${entry.term}`,
      };
    },
    // 2. зумерська -> нормальна: слово в живій фразі, а не окремо
    () => {
      const entry = pick(terms);
      if (!entry) return null;
      return {
        label: `«${entry.term.toUpperCase()}» — ЦЕ ПОХВАЛА ЧИ НІ?`,
        query: `«${entry.term}» — це похвала чи образа? і коли так не варто казати`,
      };
    },
    // 3. нормальна -> зумерська через українське слово зі словника
    () => {
      const entry = pick(withUk);
      const word = entry ? pick(entry.ukEquivalents) : undefined;
      if (!word) return null;
      return {
        label: `ЯК СКАЗАТИ «${word.toUpperCase()}» ПО-ЗУМЕРСЬКИ`,
        query: `як сказати «${word}» по-зумерськи`,
      };
    },
    // 4. нормальна -> зумерська: ціле речення
    () => {
      const phrase = pick(PHRASES);
      if (!phrase) return null;
      return {
        label: "ПЕРЕКЛАДИ НА ЗУМЕРСЬКУ",
        query: `переклади на зумерську: ${phrase}`,
      };
    },
    // 5. різниця між двома словами — питання, яке словник сам не відповідає
    () => {
      const [a, b] = shuffle(terms).slice(0, 2);
      if (!a || !b) return null;
      return {
        label: `${a.term.toUpperCase()} ЧИ ${b.term.toUpperCase()}?`,
        query: `у чому різниця між «${a.term}» і «${b.term}»`,
      };
    },
    // 6. мем
    () => {
      const theme = pick(MEME_THEMES);
      if (!theme) return null;
      return { label: `МЕМ ПРО ${theme.toUpperCase()}`, query: `кинь мем про ${theme}` };
    },
  ];

  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const make of shuffle(makers)) {
    if (out.length >= count) break;
    const item = make();
    if (!item || seen.has(item.label)) continue;
    seen.add(item.label);
    out.push(item);
  }
  return out.length ? out : STARTER_SUGGESTIONS;
}
