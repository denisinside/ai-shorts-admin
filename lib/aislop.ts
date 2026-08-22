/**
 * Характер і різноманіття відповідей `/aislop`.
 *
 * Випадковість живе ТУТ, а не в моделі. У пісочниці Dify немає надійного
 * генератора випадкових чисел (`Math.random` там просто заборонений у Code-нодах),
 * а сама лише температура LLM дає варіації тону, але не структури: модель однаково
 * починає, однаково форматує, і за десяток викликів це читається як шаблон.
 *
 * Тому панель кидає кубик на трьох рівнях і передає результат далі:
 *   1. репліка «думаю» — видно ще до того, як Dify щось відповів;
 *   2. `mood` — іде в чатфлоу вхідною змінною й задає регістр саме цієї відповіді;
 *   3. форма подачі — звичайний текст або ембед із випадковим акцентом.
 */

/** Показується миттєво, поки Dify думає. Потім замінюється відповіддю. */
export const THINKING = [
  "секунду, гортаю базу 💅",
  "ща гляну, не дихай",
  "омг окей чекай",
  "так, дай подивлюсь шо там",
  "хвилинку, я в базі",
  "чекай, звіряю",
  "ммм цікаве питання, дивлюсь",
  "оk оk зараз буде",
  "лізу перевіряти 🫧",
  "тримай думку, я подивлюсь",
] as const;

/**
 * Регістр відповіді. Персона в чатфлоу отримує це рядком і слідує йому —
 * так одна й та сама фактура щоразу звучить інакше.
 */
export const MOODS = [
  "спокійна й трохи сонна, відповідай коротко й без зайвих емоцій",
  "в піднесеному настрої, радієш що є про що поговорити",
  "легко саркастична, але добра — можеш підколоти, не ображаючи",
  "діловита: мінімум води, по суті, майже як колега на дедлайні",
  "драматизуєш дрібниці, ніби це серіал, але факти не спотворюєш",
  "тепла й підбадьорлива, хвалиш за те що процес рухається",
  "трохи втомлена, відповідаєш чесно й лаконічно",
  "зацікавлена деталями, ставиш одне уточнювальне питання в кінці",
  "розслаблена, наче пишеш подрузі між справами",
  "зібрана й впевнена, без емодзі взагалі",
] as const;

/**
 * Проміжні репліки, поки відповідь ще збирається. Питання до бази з вибіркою
 * або запуск воркфлоу можуть тривати довше за кілька секунд, і без ознак життя
 * це виглядає як зависання.
 *
 * Прогрес умисно НЕ читається зі стріму подій Dify: `blocking` простіший і
 * надійніший, а тут достатньо показати, що робота триває.
 */
export const PROGRESS = [
  ["ще копаюсь, не тікай", "окей це трохи довше ніж я думала 🫠"],
  ["так, майже", "ще секундочку, збираю думку"],
  ["воно велике, зараз домучу", "ок ще трохи, тримайся"],
] as const;

/** Акценти ембеда — приглушені, щоб не сперечалися з картками гейта. */
const ACCENTS = [0xf2a2c0, 0xc3a6ff, 0x8fd6c2, 0xffd48a, 0x9ec5ff, 0xf5a7a7];

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const CONTENT_LIMIT = 1900; // 2000 мінус запас на службові символи
const EMBED_LIMIT = 3800; // 4096 мінус той самий запас

/**
 * Ріже текст по межах абзаців, а не посеред слова. Обрив на півслові — саме те,
 * від чого ми тут тікаємо, тож жорсткий розріз лишається аварійним шляхом.
 */
function chunk(text: string, size: number): string[] {
  if (text.length <= size) return [text];

  const parts: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const window = rest.slice(0, size);
    let cut = window.lastIndexOf("\n\n");
    if (cut < size * 0.4) cut = window.lastIndexOf("\n");
    if (cut < size * 0.4) cut = window.lastIndexOf(" ");
    if (cut < size * 0.4) cut = size;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export type DiscordMessage = { content: string } | { embeds: { description: string; color: number }[] };

/**
 * Готує ОДНЕ або КІЛЬКА повідомлень. Раніше довга відповідь просто обрізалася
 * трьома крапками, і людина не бачила половини — тепер хвіст їде наступними
 * повідомленнями.
 *
 * Це не заміна ліміту `max_tokens` у моделі, а страховка після нього: обрив
 * посеред речення лікується лімітом токенів, а не тут, бо тут ми вже нічого
 * не можемо дописати за модель.
 */
export function renderAnswer(text: string): DiscordMessage[] {
  const clean = text.trim() || "щось я загубила думку, спитай ще раз";
  // Довге завжди ембедом: там утричі більше місця, отже менше розривів.
  const asEmbed = clean.length > 1400 || Math.random() < 0.34;

  if (!asEmbed) return chunk(clean, CONTENT_LIMIT).map((part) => ({ content: part }));

  const color = pick(ACCENTS);
  return chunk(clean, EMBED_LIMIT).map((part) => ({
    embeds: [{ description: part, color }],
  }));
}

export type AislopConfig = {
  base: string;
  key: string | undefined;
};

export function aislopConfig(): AislopConfig {
  return {
    base: (process.env.DIFY_API_BASE ?? "https://api.dify.ai/v1").replace(/\/+$/, ""),
    key: process.env.DIFY_ORCHESTRATOR_API_KEY,
  };
}

/**
 * Остання розмова цього каналу. Окремої таблиці навмисно немає: Dify сам
 * зберігає розмови на `user`, тож пам'ять тримається одним GET замість
 * міграції, схеми й ще одного місця, яке може розсинхронитися.
 */
async function latestConversation(
  cfg: AislopConfig,
  user: string,
): Promise<string> {
  try {
    const response = await fetch(
      `${cfg.base}/conversations?user=${encodeURIComponent(user)}&limit=1&sort_by=-updated_at`,
      {
        headers: { Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) return "";
    const body = (await response.json()) as { data?: { id?: string }[] };
    return body.data?.[0]?.id ?? "";
  } catch {
    // Немає розмови — не помилка: почнеться нова.
    return "";
  }
}

export type AskResult = { answer: string } | { error: string };

/** Питає оркестратор. `blocking`: Chatflow це підтримує, Agent-апки — ні. */
export async function askOrchestrator(opts: {
  query: string;
  author: string;
  user: string;
  mood: string;
  fresh: boolean;
}): Promise<AskResult> {
  const cfg = aislopConfig();
  if (!cfg.key) return { error: "DIFY_ORCHESTRATOR_API_KEY не заданий" };

  const conversationId = opts.fresh ? "" : await latestConversation(cfg, opts.user);

  try {
    const response = await fetch(`${cfg.base}/chat-messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        query: opts.query,
        inputs: { author: opts.author, mood: opts.mood },
        user: opts.user,
        conversation_id: conversationId,
        response_mode: "blocking",
        auto_generate_name: false,
      }),
      // Discord тримає токен взаємодії 15 хвилин, але стільки чекати нікому не
      // треба: якщо оркестратор не вклався, чесніше сказати про це.
      signal: AbortSignal.timeout(120_000),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("[aislop] dify", response.status, text.slice(0, 500));
      // Розмова могла завершитися або зникнути — наступна спроба почне нову.
      if (text.includes("conversation_completed") || text.includes("not_found")) {
        return { error: "розмова застаріла — спробуй ще раз, почну з чистого аркуша" };
      }
      return { error: `оркестратор відповів HTTP ${response.status}` };
    }

    const body = JSON.parse(text) as { answer?: string };
    return { answer: body.answer ?? "" };
  } catch (error) {
    console.error("[aislop] dify недоступний", error);
    return { error: "оркестратор не відповів вчасно" };
  }
}
