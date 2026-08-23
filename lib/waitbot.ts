/**
 * Міст між вікном WaitBot на `/blog` і чатфлоу `waitbot-slang` у Dify.
 *
 * Чому окремий файл, а не `lib/aislop.ts`: у оркестратора інша апка, інший
 * ключ, інші таймаути й інша модель пам'яті. `/aislop` прив'язує розмову до
 * КАНАЛУ Discord і дістає `conversation_id` окремим GET; тут розмова
 * прив'язана до вкладки браузера, і `conversation_id` носить сам клієнт —
 * походу в Dify по історію не потрібно взагалі.
 *
 * Чому Dify, а не прямий виклик моделі з маршруту: уся логіка (матчер
 * словника, два різні пошуки, маршрутизація наміру) живе у воркфлоу і
 * редагується без деплою панелі. Панель лишається тонкою.
 */

export const WAITBOT_MAX_QUERY = 500;

/** Скільки чекати на відповідь. Гілка перекладу — це LLM + до 4 запитів у
 *  Pinecone + два GET у Supabase, тож 60 с це стеля, а не типовий випадок. */
const TIMEOUT_MS = 60_000;

export type WaitbotConfig = { base: string; key: string | undefined };

export function waitbotConfig(): WaitbotConfig {
  return {
    base: (process.env.DIFY_API_BASE ?? "https://api.dify.ai/v1").replace(/\/+$/, ""),
    key: process.env.DIFY_WAITBOT_API_KEY,
  };
}

export type WaitbotAnswer =
  | { answer: string; conversationId: string }
  | { error: string };

/**
 * Настрій відповіді. Той самий прийом, що в `/aislop`: у пісочниці Dify немає
 * `Math.random`, а сама температура дає варіації тону, але не структури —
 * за десяток реплік це читається як шаблон. Кубик кидає панель.
 */
const MOODS = [
  "спокійна й доброзичлива, без надриву",
  "весела й трохи хаотична, але по суті",
  "легко саркастична — можеш підколоти, не ображаючи",
  "по-діловому коротка, без води",
  "тепла й підбадьорлива",
  "здивована, що про це питають, але радо пояснюєш",
] as const;

export function pickMood(): string {
  return MOODS[Math.floor(Math.random() * MOODS.length)];
}

export async function askWaitbot(opts: {
  query: string;
  user: string;
  conversationId: string;
}): Promise<WaitbotAnswer> {
  const cfg = waitbotConfig();
  if (!cfg.key) return { error: "DIFY_WAITBOT_API_KEY не заданий" };

  try {
    const response = await fetch(`${cfg.base}/chat-messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        query: opts.query,
        inputs: { mood: pickMood() },
        user: opts.user,
        conversation_id: opts.conversationId,
        // blocking, а не streaming: вікно показує готову репліку. Chatflow це
        // підтримує, Agent-апки — ні, і саме тому воркфлоу зроблений чатфлоу.
        response_mode: "blocking",
        auto_generate_name: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("[waitbot] dify", response.status, text.slice(0, 400));
      // Розмова могла завершитися або зникнути — клієнту повертаємо порожній
      // conversationId, і наступне питання почне нову.
      if (text.includes("conversation_completed") || text.includes("not_found")) {
        return { error: "розмова застаріла, почнімо спочатку — спитай ще раз" };
      }
      return { error: "щось зламалося на моєму боці, спробуй за хвилину" };
    }

    const body = JSON.parse(text) as { answer?: string; conversation_id?: string };
    const answer = (body.answer ?? "").trim();
    if (!answer) return { error: "я щось задумався і не відповів. спробуй ще раз" };
    return { answer, conversationId: body.conversation_id ?? "" };
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    console.error("[waitbot] fetch", error);
    return {
      error: timeout
        ? "щось я довго думаю. спробуй коротше питання"
        : "не дістаюся до себе самого, спробуй пізніше",
    };
  }
}
