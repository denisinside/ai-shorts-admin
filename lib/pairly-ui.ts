import type { PairlyMessage, PairlyMode, PairlyRole } from "./pairly";

/**
 * Клієнтська половина `/support`: константи, підписи й розкладка бульбашок.
 *
 * Чому окремий файл, а не той самий `lib/pairly.ts`. Той модуль читає
 * `process.env.DIFY_PAIRLY_API_KEY` і робить запити в Service API — його місце
 * на сервері, і клієнтські компоненти беруть звідти лише `import type`, який
 * стирається при компіляції. Один-єдиний імпорт ЗНАЧЕННЯ звідти затягнув би
 * весь модуль у браузерний бандл. Той самий поділ, що між `lib/waitbot.ts` і
 * `lib/waitbot-settings.ts`.
 *
 * Класи тут — з `app/(support)/support.css`, тобто з макета
 * `docs/Pairly_support_bot.html`. Tailwind на цьому маршруті не підключений
 * навмисно (див. шапку `support.css`), тому жодних утилітарних класів.
 */

/**
 * Крок опитування сторінок `/support`.
 *
 * Опитування, а не Realtime: Realtime Supabase вимагає publishable-ключа в
 * браузері й RLS-політики на читання — тобто рівно того, від чого ми
 * відмовилися в §2.2 архітектури. Ціна — секунда затримки в демо; виграш —
 * транскрипти підтримки не читаються публічним ключем.
 */
export const PAIRLY_POLL_MS = 3_000;

/** Хто відповідає ЗАРАЗ — те, що людина в чаті мусить бачити без пояснень. */
export const MODE_LABEL: Record<PairlyMode, string> = {
  bot: "бот підтримки · онлайн",
  pending_human: "передано менеджеру · чекає на людину",
  human: "менеджер Support · на лінії",
};

/** Клас крапки в демо-стрічці: зелена — бот, жовта — черга, сіра — закрито. */
export const MODE_DOT: Record<PairlyMode, string> = {
  bot: "dot",
  pending_human: "dot warn",
  human: "dot",
};

export const MODE_TAG: Record<PairlyMode, string> = {
  bot: "Бот",
  pending_human: "Чекає на людину",
  human: "Менеджер",
};

/**
 * Причини ескалації з `pairly/decide.py` — людською мовою.
 *
 * Коди в базі лишаються кодами: їх читає і тест, і вижимка. Але в чаті й у
 * черзі людина мусить бачити причину, а не `unresolved_after_attempt`. Невідомий
 * код показуємо як є — краще технічний рядок, ніж порожнє місце.
 */
export const REASON_LABEL: Record<string, string> = {
  refund_or_dispute: "refund або оскарження списання",
  repeated_unresolved: "те саме питання вдруге",
  unresolved_after_attempt: "попередні кроки не допомогли",
  kb_requires_support: "випадок вимагає Support",
  frustration: "користувач роздратований",
  data_conflict: "дані провайдера й акаунта суперечать",
  cancellation_plus_other: "відміна плюс інше питання",
  kb_no_answer: "база знань не дала надійної відповіді",
  missing_account_data: "немає даних акаунта",
  compose_failed: "модель не сформулювала відповідь",
  user_requested_human: "користувач попросив людину",
};

export function reasonLabel(code: string | null): string {
  if (!code) return "";
  return REASON_LABEL[code] ?? code;
}

/**
 * Як показати хід. Макет має чотири види бульбашки, і кожен щось ЗНАЧИТЬ:
 * зелена — дію виконала людина, фіалкова — розмову передали, пісочна — бот
 * чогось не знає й питає, сіра — службова позначка.
 *
 * Мапимо на те, що приходить у конверті, а не на настрій тексту: якщо
 * підсвітка «передано» з'явиться там, де передачі не було, людина перестане їй
 * вірити — і саме ця підсвітка й потрібна їй найбільше.
 */
export type BubbleLook = { tone: string; icon: string; label: string };

export function bubbleLook(message: PairlyMessage): BubbleLook | null {
  if (message.role === "system") {
    return { tone: "system", icon: "i", label: "" };
  }
  if (message.role === "agent") {
    return { tone: "success", icon: "✓", label: "Менеджер Support" };
  }
  if (message.role !== "bot") return null;

  if (message.escalate) {
    const why = reasonLabel(message.escalationReason);
    return {
      tone: "handoff",
      icon: "↗",
      label: why ? `Передано менеджеру · ${why}` : "Передано менеджеру",
    };
  }
  if (message.action === "ASK_CLARIFY") {
    return { tone: "clarify", icon: "?", label: "Потрібне уточнення" };
  }
  return null;
}

export const ROLE_INITIAL: Record<PairlyRole, string> = {
  user: "Я",
  bot: "P",
  agent: "M",
  system: "·",
};

/** Час у бульбашці. Дата тут зайва — розмова живе хвилини, не дні. */
export function bubbleTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

/** Коли розмову передали. Тут дата потрібна: черга живе годинами. */
export function shortTime(iso: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Стартові підказки під першим повідомленням.
 *
 * У макеті на цьому місці було дерево рішень: кнопка «Скасувати підписку»
 * вела на зашиту гілку з готовим текстом. Тут кнопка НАДСИЛАЄ РЕАЛЬНЕ
 * ПОВІДОМЛЕННЯ — тобто це швидкий набір, а не сценарій. Різниця принципова:
 * дерево показувало б відповіді, яких агент не давав.
 *
 * Формулювання взяті з тестового датасету (`pairly/data/test_queries.json`),
 * щоб демо одразу влучало в кейси, які кейс і просить показати: базова відміна,
 * перевірка статусу, пристрій ≠ канал покупки, refund, multi-intent.
 */
export const STARTERS: { icon: string; text: string; primary?: boolean }[] = [
  { icon: "👑", text: "Як скасувати мою підписку?", primary: true },
  { icon: "✅", text: "Моя відміна спрацювала?" },
  { icon: "📅", text: "До якої дати в мене буде Premium?" },
  { icon: "🌟", text: "Скільки Super Likes у мене залишилося?" },
  { icon: "📱", text: "Я на iPhone. Де скасувати підписку?" },
  { icon: "💳", text: "Я хочу повернути останній платіж." },
];

/**
 * Стікери з макета. Кожен — виріз із аркуша: координати в пікселях аркуша,
 * далі перераховані у відсотки `background-size` / `background-position`.
 *
 * Розміри аркушів узяті з макета й НЕ дорівнюють піксельним розмірам webp —
 * і це не помилка. У CSS усе задано відсотками, тому важливе лише
 * співвідношення `аркуш / виріз`, а воно при конвертації збереглося.
 */
type Sticker = {
  caption: string;
  sheet: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sw: number;
  sh: number;
};

const FLOWERS = "/pairly/stickers-flowers.webp";
const WOMAN = "/pairly/stickers-woman.webp";
const GREETING = "/pairly/greeting.webp";

export const STICKERS: Sticker[] = [
  { caption: "Дякую!", sheet: FLOWERS, x: 143, y: 20, w: 136, h: 123, sw: 708, sh: 892 },
  { caption: "Чудово!", sheet: FLOWERS, x: 294, y: 409, w: 126, h: 124, sw: 708, sh: 892 },
  { caption: "Будьте здорові!", sheet: FLOWERS, x: 294, y: 541, w: 126, h: 123, sw: 708, sh: 892 },
  { caption: "Доброго ранку!", sheet: FLOWERS, x: 575, y: 278, w: 127, h: 125, sw: 708, sh: 892 },
  { caption: "Цілую!", sheet: FLOWERS, x: 14, y: 148, w: 126, h: 126, sw: 708, sh: 892 },
  { caption: "З любов’ю!", sheet: FLOWERS, x: 432, y: 148, w: 128, h: 126, sw: 708, sh: 892 },
  { caption: "Привіт!", sheet: WOMAN, x: 47, y: 23, w: 250, h: 245, sw: 678, sh: 918 },
  { caption: "Щиро дякую!", sheet: WOMAN, x: 465, y: 526, w: 210, h: 250, sw: 678, sh: 918 },
  { caption: "Гарного дня!", sheet: GREETING, x: 360, y: 35, w: 320, h: 180, sw: 2048, sh: 738 },
];

export function stickerStyle(s: Sticker): React.CSSProperties {
  const px = s.sw === s.w ? 0 : (s.x / (s.sw - s.w)) * 100;
  const py = s.sh === s.h ? 0 : (s.y / (s.sh - s.h)) * 100;
  return {
    backgroundImage: `url('${s.sheet}')`,
    backgroundSize: `${(s.sw / s.w) * 100}% ${(s.sh / s.h) * 100}%`,
    backgroundPosition: `${px}% ${py}%`,
  };
}

export const EMOJI = ["🙂", "😊", "😂", "😍", "👍", "🙏", "❤️", "🌷", "🌸", "💐"];
