/**
 * Міст між сторінками `/support` і двома апками Dify кейсу Pairly:
 * chatflow `pairly-support-agent` (розмова) і workflow `pairly-handoff-summary`
 * (кнопка «Самарайз» у тех. сапорта).
 *
 * Межа відповідальності тут така сама, як у WaitBot, і вона головна в цьому
 * файлі: **панель не ухвалює жодного рішення про зміст**. Вона пише
 * повідомлення в базу, кличе Service API і малює те, що прийшло. Уся логіка
 * підтримки — розбір повідомлення, retrieval, таблиця правил ескалації, Tone
 * of Voice — живе у графі; логіка ролей і черги — у базі. Нове вміння агента
 * не має вимагати деплою панелі.
 *
 * Окремо від цього стоїть інша межа, яку кейс вимагає розмежувати чітко:
 * **відповіді тех. сапорта через Dify НЕ ходять узагалі.** Людина пише —
 * панель пише рядок у `pairly_messages` з `role='agent'`, і все. Перехід
 * «бот → людина» — це стан рядка в базі (`pairly_conversations.mode`), а не
 * гілка в графі, тому в цьому файлі немає й не має бути функції для нього.
 */

/**
 * Розділювач, яким chatflow дописує машинні дані в кінець відповіді.
 *
 * Чому маркер, а не окреме поле: `answer` у chatflow — це ОДИН рядок,
 * структури там немає, а панелі потрібні не тільки текст, а й intents ходу
 * (щоб наступний хід міг порахувати повтор), набір статей (щоб показати
 * джерела), факт ескалації й готовий handoff.
 *
 * Ставить маркер КОД (Code-нода `Зібрати відповідь і конверт`), а не промпт:
 * якби формат просили в моделі, рано чи пізно прийшов би поламаний JSON.
 *
 * Значення мусить збігатися з `MARK` у `dify/build_pairly_dsl.py`, і збіг
 * перевіряє `pairly/check_pipeline.py` — саме тому воно тут константа, а не
 * зашите в regexp усередині функції.
 */
export const PAIRLY_MARK = "⟦PAIRLY⟧";

/** Стеля довжини питання. Захист від зловживання, не автентифікація. */
export const PAIRLY_MAX_QUERY = 1000;

/**
 * Скільки чекати на chatflow. Один прогін — це дві LLM-ноди (analyze +
 * compose, кожна з резервом іншого вендора), два retrieval (Pinecone і текст
 * статей) і три HTTP-запити до PostgREST. 8-15 секунд типово, 90 — стеля.
 */
const CHAT_TIMEOUT_MS = 90_000;

/** Воркфлоу вижимки коротший: один LLM і два GET, ~4-6 секунд. */
const SUMMARY_TIMEOUT_MS = 60_000;

// --- Словник ролей і станів --------------------------------------------------

/**
 * Хто написав хід. `system` не пише ні бот, ні людина — це службові позначки
 * розмови (наприклад, «розмову передано тех. сапорту»), і вони мусять мати
 * власну роль, бо інакше їх довелося б підмішувати в текст ходу бота.
 */
export type PairlyRole = "user" | "bot" | "agent" | "system";

/**
 * Хто відповідає в розмові ЗАРАЗ. `pending_human` — ескалація вже сталася, але
 * жоден агент ще не написав: саме цей стан і є черга тех. сапорта, і без
 * окремого значення її не відрізнити ні від бота, ні від узятої розмови.
 */
export type PairlyMode = "bot" | "pending_human" | "human";

export type PairlyStatus = "open" | "closed";

/** Дії, які розрізняє `pairly/decide.py`. Панель їх не обчислює, лише показує. */
export type PairlyAction = "ANSWER" | "ASK_CLARIFY" | "ANSWER_THEN_ESCALATE" | "ESCALATE";

// --- Конверт ⟦PAIRLY⟧ --------------------------------------------------------

/**
 * Поля handoff — рівно ті, які вимагає `03_Pairly_Flow_Eskalatsii_UA`, у тому
 * ж порядку. Прозу (`bot_actions`, `user_request_summary`) дає модель, усі
 * факти підставляє код графа з прочитаного акаунта — тому тут вони приходять
 * готовими рядками, і панель нічого з них не перераховує.
 */
export type PairlyHandoff = {
  user_id: string;
  conversation_id: string;
  detected_intents: string[];
  billing_platform: string | null;
  subscription_status: string | null;
  auto_renew: boolean | null;
  subscription_period_end: string | null;
  last_charge: string | null;
  sentiment: string | null;
  bot_actions: string;
  user_request_summary: string;
};

export type PairlyEnvelope = {
  action: PairlyAction;
  /**
   * Дублює `action` навмисно: панель фільтрує чергу по одному булеву полю, і
   * розбирати для цього рядок `action` не має.
   */
  escalate: boolean;
  escalation_reason: string | null;
  intents: string[];
  sub_intent: string | null;
  sentiment: string | null;
  article_ids: string[];
  /** Що реально поїхало в промпт. `article_ids` — те, що модель звідти вибрала. */
  context_articles: string[];
  /**
   * Статті, які вектор знайшов, а код прибрав: cancellation-інструкція чужої
   * платформи. Без цього поля неможливо відрізнити «вектор не знайшов» від
   * «знайшов, і ми прибрали» — а при розборі провалу це різні речі.
   */
  dropped_articles: string[];
  /** Чи стоїть за відповіддю текст KB. `false` при `kb_no_answer`. */
  grounded: boolean;
  repeated_intents: string[];
  /**
   * Скільки автономії взяла модель. Дію тепер обирає вона, а код лишає підлоги,
   * тож ці три поля — єдиний спосіб побачити, де вони не згодні.
   *
   * `recommended_action` — що радив детермінований порадник;
   * `deviated_from_plan` — модель вирішила інакше й пояснила;
   * `override` — хто виграв: `escalated_up` (модель обережніша),
   *   `escalated_down` (модель знизила м'яку причину), `floor_held` (підлога не
   *   пустила), `rejected_silent_override` (знизила без пояснення — не прийняли).
   */
  recommended_action: PairlyAction | null;
  deviated_from_plan: boolean;
  deviation_reason: string | null;
  override: string | null;
  /** Чому саме ці статті — одним реченням від моделі. */
  why_articles: string | null;
  handoff: PairlyHandoff | null;
};

// --- Плоскі форми для клієнтських компонентів -------------------------------

/**
 * Хід розмови в тій формі, у якій його бачить розмітка. Плоский і
 * серіалізовний — так само, як `ReaderArticle`: вікна чату клієнтські, тож усе,
 * що туди їде, мусить пройти через межу сервер → клієнт.
 */
export type PairlyMessage = {
  id: string;
  conversationId: string;
  role: PairlyRole;
  text: string;
  createdAt: string;
  /** Машинні поля ходу. У ходу користувача заповнені лише `intents`. */
  intents: string[];
  subIntent: string | null;
  sentiment: string | null;
  action: string | null;
  escalate: boolean;
  escalationReason: string | null;
  /** Джерела під відповіддю бота: `KB-SUB-003` тощо. */
  articleIds: string[];
  grounded: boolean | null;
  /**
   * Дію обирає модель, код лишає підлоги. Ці три поля показують, де вони не
   * згодні: що радив порадник, чому модель вирішила інакше й хто виграв.
   * `override`: floor_held | escalated_up | escalated_down |
   * rejected_silent_override | compose_failed.
   */
  recommendedAction: string | null;
  deviationReason: string | null;
  override: string | null;
  /** Хто з тех. сапорту написав хід. Тільки для `role='agent'`. */
  agentId: string | null;
  latencyMs: number | null;
};

export type PairlyConversation = {
  id: string;
  userId: string;
  mode: PairlyMode;
  status: PairlyStatus;
  escalatedAt: string | null;
  escalationReason: string | null;
  assignedAgent: string | null;
  lastMessageAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
};

/** Рядок черги тех. сапорта: розмова плюс те, що видно в списку без кліку. */
export type PairlyQueueItem = PairlyConversation & {
  messageCount: number;
  lastRole: PairlyRole | null;
  lastText: string;
};

/** Акаунт із датасету — рівно те, що потрібно селекту на `/support`. */
export type PairlyUserOption = {
  userId: string;
  firstName: string;
  plan: string | null;
  billingPlatform: string | null;
  subscriptionStatus: string | null;
};

export type PairlyAgentOption = {
  agentId: string;
  name: string;
};

// --- Розбір конверта ---------------------------------------------------------

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  // Конверт складає код, але хвіст міг приїхати з іншої версії графа —
  // одиничний рядок краще підняти в масив, ніж викинути.
  if (typeof value === "string" && value) return [value];
  return [];
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * jsonb із пайплайну приходить непередбачувано: то об'єктом, то рядком із JSON
 * усередині. Розбираємо один раз на вході, а не в кожному місці показу — це той
 * самий хелпер, що `parseMaybeJson` у `lib/day-tables.ts`, але дублювати сюди
 * дешевше, ніж тягнути в цей модуль залежність від таблиць конвеєра днів.
 */
function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value ?? null;
  const text = value.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Не JSON — віддаємо як був. Загубити рядок гірше, ніж показати його текстом.
    return value;
  }
}

const ACTIONS: PairlyAction[] = ["ANSWER", "ASK_CLARIFY", "ANSWER_THEN_ESCALATE", "ESCALATE"];

function toHandoff(value: unknown): PairlyHandoff | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return {
    user_id: typeof raw.user_id === "string" ? raw.user_id : "",
    conversation_id: typeof raw.conversation_id === "string" ? raw.conversation_id : "",
    detected_intents: asStringArray(raw.detected_intents),
    billing_platform: asNullableString(raw.billing_platform),
    subscription_status: asNullableString(raw.subscription_status),
    auto_renew: typeof raw.auto_renew === "boolean" ? raw.auto_renew : null,
    subscription_period_end: asNullableString(raw.subscription_period_end),
    last_charge: asNullableString(raw.last_charge),
    sentiment: asNullableString(raw.sentiment),
    bot_actions: typeof raw.bot_actions === "string" ? raw.bot_actions : "",
    user_request_summary:
      typeof raw.user_request_summary === "string" ? raw.user_request_summary : "",
  };
}

/**
 * Нормалізує конверт. Кожне поле перевіряється, бо конверт — це jsonb з
 * пайплайну: то масив, то рядок, то немає зовсім. Невідома `action` стає
 * `ANSWER` і НЕ вмикає ескалацію сама — на це є окремий булев `escalate`,
 * який граф ставить кодом.
 */
export function toEnvelope(raw: unknown): PairlyEnvelope | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const action = ACTIONS.includes(value.action as PairlyAction)
    ? (value.action as PairlyAction)
    : "ANSWER";

  return {
    action,
    escalate:
      typeof value.escalate === "boolean"
        ? value.escalate
        // Прапорця немає — виводимо з дії, а не вважаємо, що ескалації не було:
        // втрачена ескалація означає розмову, якої тех. сапорт не побачить.
        : action === "ESCALATE" || action === "ANSWER_THEN_ESCALATE",
    escalation_reason: asNullableString(value.escalation_reason),
    intents: asStringArray(value.intents),
    sub_intent: asNullableString(value.sub_intent),
    sentiment: asNullableString(value.sentiment),
    article_ids: asStringArray(value.article_ids),
    context_articles: asStringArray(value.context_articles),
    dropped_articles: asStringArray(value.dropped_articles),
    grounded: value.grounded === true,
    repeated_intents: asStringArray(value.repeated_intents),
    recommended_action: ACTIONS.includes(value.recommended_action as PairlyAction)
      ? (value.recommended_action as PairlyAction)
      : null,
    deviated_from_plan: value.deviated_from_plan === true,
    deviation_reason: asNullableString(value.deviation_reason),
    override: asNullableString(value.override),
    why_articles: asNullableString(value.why_articles),
    handoff: toHandoff(value.handoff),
  };
}

/**
 * Відрізає хвіст із конвертом від тексту відповіді.
 *
 * Маркер шукається ЗАВЖДИ — навіть коли конверта не очікуємо. Якщо він колись
 * протече у видимий текст (перегенерували граф, змінили формат), людина, яка
 * щойно скаржилася на списання, побачить сирий JSON у чаті. Дешевше різати
 * беззастережно.
 *
 * Поламаний JSON у хвості не приховує відповідь: текст показуємо, конверт —
 * `null`. Ескалацію в такому разі все одно донесе вебхук `/api/pairly/escalate`
 * (§1.6 архітектури), і саме тому два шляхи — не дублювання.
 */
export function splitEnvelope(raw: string): { reply: string; envelope: PairlyEnvelope | null } {
  const at = raw.indexOf(PAIRLY_MARK);
  if (at < 0) return { reply: raw.trim(), envelope: null };

  const reply = raw.slice(0, at).trim();
  const tail = raw.slice(at + PAIRLY_MARK.length).trim();
  try {
    return { reply, envelope: toEnvelope(JSON.parse(tail)) };
  } catch {
    return { reply, envelope: null };
  }
}

// --- Конфігурація ------------------------------------------------------------

export type PairlyConfig = {
  base: string;
  chatKey: string | undefined;
  summaryKey: string | undefined;
  escalateKey: string | undefined;
};

export function pairlyConfig(): PairlyConfig {
  return {
    // Слеш у кінці вбиває маршрут тихо — той самий урок, що з вебхуками гейта.
    base: (process.env.DIFY_API_BASE ?? "https://api.dify.ai/v1").replace(/\/+$/, ""),
    chatKey: process.env.DIFY_PAIRLY_API_KEY,
    summaryKey: process.env.DIFY_PAIRLY_SUMMARY_API_KEY,
    escalateKey: process.env.PAIRLY_ESCALATE_KEY,
  };
}

/**
 * Безпечна форма конфігурації для GET-діагностики: наявність і довжина, ніколи
 * не значення. Перше, що варто відкрити, коли «підтримка не відповідає».
 */
export function pairlyDiagnostics() {
  const cfg = pairlyConfig();
  const show = (key: string | undefined) =>
    key ? `задано (${key.length} символів)` : "НЕ ЗАДАНО";

  return {
    difyBase: cfg.base,
    chatKey: show(cfg.chatKey),
    summaryKey: show(cfg.summaryKey),
    escalateKey: show(cfg.escalateKey),
  };
}

// --- Виклики Dify -----------------------------------------------------------

export type PairlyAnswer =
  | {
      reply: string;
      envelope: PairlyEnvelope | null;
      difyMessageId: string | null;
      latencyMs: number;
    }
  | { error: string };

/**
 * Питає chatflow `pairly-support-agent`.
 *
 * **`conversation_id` Dify тут НЕ передається — і це не недогляд.** Кожне
 * повідомлення це нова розмова Dify (§1.2 архітектури), а стан живе в нашій
 * базі. Три причини, кожна сама достатня: тех. сапорт мусить бачити ту саму
 * розмову (пам'ять Dify невидима і для панелі, і для воркфлоу вижимки); повтор
 * запиту мусить рахувати код по колонці `pairly_messages.intents`, а не
 * «пам'ятати» модель; документація Dify не регламентує, чи `inputs`
 * застосовуються повторно в межах наявної розмови — а ми передаємо `user_id` і
 * `turn_id` саме через `inputs`.
 *
 * `user` усе одно ставимо змістовним (`pairly:<conversation_id>`): у логах Dify
 * це єдине, за чим потім знайдеш прогони однієї розмови.
 */
export async function askPairly(opts: {
  query: string;
  userId: string;
  conversationId: string;
  /** id рядка `pairly_messages` цього ж ходу — граф виключає його з історії. */
  turnId: string;
}): Promise<PairlyAnswer> {
  const cfg = pairlyConfig();
  if (!cfg.chatKey) return { error: "DIFY_PAIRLY_API_KEY не заданий" };

  const startedAt = Date.now();
  try {
    const response = await fetch(`${cfg.base}/chat-messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.chatKey}`,
      },
      body: JSON.stringify({
        query: opts.query,
        inputs: {
          user_id: opts.userId,
          conversation_id: opts.conversationId,
          turn_id: opts.turnId,
          locale: "uk",
        },
        user: `pairly:${opts.conversationId}`,
        // blocking, а не streaming: панель показує готову репліку разом із
        // конвертом. Chatflow це підтримує, Agent-апки — ні.
        response_mode: "blocking",
        // Порожній рядок, не `opts.conversationId`: наш id — це рядок у базі,
        // а не розмова Dify, і Dify відповів би на нього `not_found`.
        conversation_id: "",
        auto_generate_name: false,
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });

    // Текст ДО JSON.parse: помилки Service API приходять і не-JSON теж
    // (проксі, 502 від воркера), і `response.json()` тоді кидає замість того,
    // щоб дати причину в лог.
    const text = await response.text();
    if (!response.ok) {
      console.error("[pairly] dify chat", response.status, text.slice(0, 400));
      return { error: "агент підтримки зараз недоступний — спробуйте за хвилину" };
    }

    const body = JSON.parse(text) as { answer?: string; message_id?: string };
    const { reply, envelope } = splitEnvelope(body.answer ?? "");
    if (!reply) return { error: "агент не сформулював відповідь — спробуйте ще раз" };

    return {
      reply,
      envelope,
      difyMessageId: body.message_id ?? null,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    console.error("[pairly] dify chat fetch", error);
    return {
      error: timeout
        ? "агент думає задовго — повторіть питання коротше"
        : "не дістаюся до агента підтримки, спробуйте пізніше",
    };
  }
}

export type PairlySummary =
  | { summaryMd: string; handoff: unknown }
  | { error: string };

/**
 * Кнопка «Самарайз»: воркфлоу `pairly-handoff-summary`.
 *
 * Це окрема Workflow-апка з нодою `start`, а не chatflow — публікувати в
 * Service API і перевикористовувати як інструмент можна лише
 * User-Input-воркфлоу, і вижимка не є розмовою. Тому й ендпоінт інший:
 * `/workflows/run`, а результат — у `data.outputs`, не в `answer`.
 *
 * `depth` порожній: скільки останніх ходів брати, вирішує граф. Панель не
 * ухвалює рішень про зміст.
 */
export async function askPairlySummary(conversationId: string): Promise<PairlySummary> {
  const cfg = pairlyConfig();
  if (!cfg.summaryKey) return { error: "DIFY_PAIRLY_SUMMARY_API_KEY не заданий" };

  try {
    const response = await fetch(`${cfg.base}/workflows/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.summaryKey}`,
      },
      body: JSON.stringify({
        inputs: { conversation_id: conversationId, depth: "" },
        // Вижимка не належить розмові користувача: її замовляє стіл сапорта,
        // і в логах Dify вона мусить бути окремим користувачем.
        user: "pairly-desk",
        response_mode: "blocking",
      }),
      signal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("[pairly] dify summary", response.status, text.slice(0, 400));
      return { error: "воркфлоу вижимки відповів помилкою" };
    }

    const body = JSON.parse(text) as {
      data?: { outputs?: { summary_md?: unknown; handoff?: unknown } };
    };
    const outputs = body.data?.outputs ?? {};
    const summaryMd = typeof outputs.summary_md === "string" ? outputs.summary_md : "";
    if (!summaryMd) return { error: "воркфлоу вижимки повернув порожній результат" };

    // `handoff` лишається `unknown`: це jsonb із пайплайну, і його форму
    // нормалізує той, хто його показує, а не той, хто передає далі в базу.
    //
    // Але РОЗІБРАТИ його треба саме тут. Нода `Зібрати handoff` віддає JSON-рядок
    // навмисно (тип виходу Code-ноди `object` не перевірений документацією), і
    // якби цей рядок поїхав у колонку `jsonb` як є, Postgres прийняв би його —
    // але як jsonb-СКАЛЯР. Тоді `payload.detected_intents` на столі сапорта
    // назавжди був би `undefined`, і жодна помилка про це не сказала б.
    return { summaryMd, handoff: parseMaybeJson(outputs.handoff) };
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    console.error("[pairly] dify summary fetch", error);
    return {
      error: timeout ? "вижимка не встигла за 60 секунд" : "не дістаюся до воркфлоу вижимки",
    };
  }
}
