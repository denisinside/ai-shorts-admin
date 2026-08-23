import "server-only";

import { createAdminClient } from "@/lib/supabase-admin";
import type {
  PairlyAgentOption,
  PairlyConversation,
  PairlyEnvelope,
  PairlyMessage,
  PairlyMode,
  PairlyQueueItem,
  PairlyRole,
  PairlyStatus,
  PairlyUserOption,
} from "@/lib/pairly";

/**
 * Доступ до таблиць `pairly_*` — єдине місце в панелі, де вони читаються й
 * пишуться.
 *
 * Файл лежить ПІД `app/api/pairly/`, а не в `lib/`, і це не косметика:
 * `lib/supabase-admin.ts` не імпортується нізвідки, крім `app/api/pairly/**`
 * (§2.2 архітектури), а правило перевіряється очима по шляху файла. Виніс
 * цього модуля в `lib/` зробив би межу непомітною — і наступний, хто захоче
 * прочитати транскрипт із серверного компонента, зробив би це «як усі».
 *
 * Підкреслення на початку імені — приватний файл маршруту: Next бере з теки
 * лише `route.ts`, тож `_db.ts` ніколи не стане ендпоінтом.
 *
 * КОНТРАКТ КОЛОНОК. Форма таблиць — `supabase/pairly.sql`; тут перелічено
 * рівно те, що панель читає й пише, щоб розсинхрон видно було в одному місці:
 *
 *   pairly_conversations  id, user_id, mode, status, escalated_at,
 *                         escalation_reason, assigned_agent, last_message_at,
 *                         closed_at, closed_by, created_at
 *   pairly_messages       id, conversation_id, role, content, intents,
 *                         sub_intent, sentiment, action, escalate,
 *                         escalation_reason, article_ids, grounded, agent_id,
 *                         dify_message_id, latency_ms, created_at
 *   pairly_handoffs       id, conversation_id, payload, summary_md,
 *                         generated_by, created_at
 *   pairly_users          user_id, first_name, plan, billing_platform,
 *                         subscription_status
 *   pairly_agents         agent_id, name
 */

const CONVERSATION_COLUMNS =
  "id, user_id, mode, status, escalated_at, escalation_reason, assigned_agent," +
  " last_message_at, closed_at, closed_by, created_at";

const MESSAGE_COLUMNS =
  "id, conversation_id, role, content, intents, sub_intent, sentiment, action," +
  " escalate, escalation_reason, article_ids, grounded, agent_id, latency_ms," +
  " recommended_action, deviation_reason, override, created_at";

/** Скільки ходів віддаємо в інтерфейс. Транскрипт демо-розмови коротший. */
const MESSAGE_LIMIT = 200;

/** Скільки розмов показує стіл сапорта. */
const QUEUE_LIMIT = 40;

const ROLES: PairlyRole[] = ["user", "bot", "agent", "system"];
const MODES: PairlyMode[] = ["bot", "pending_human", "human"];

type ConversationRow = {
  id: string;
  user_id: string;
  mode: string | null;
  status: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  assigned_agent: string | null;
  last_message_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string | null;
  content: string | null;
  intents: unknown;
  sub_intent: string | null;
  sentiment: string | null;
  action: string | null;
  escalate: boolean | null;
  escalation_reason: string | null;
  article_ids: unknown;
  grounded: boolean | null;
  recommended_action: string | null;
  deviation_reason: string | null;
  override: string | null;
  agent_id: string | null;
  latency_ms: number | null;
  created_at: string;
};

/**
 * `text[]` через PostgREST приходить масивом, але не завжди: порожня колонка
 * дає `null`, а стара міграція могла лишити рядок. Той самий інваріант, що з
 * jsonb у `lib/day-tables.ts` — нормалізація в одному місці, а не в розмітці.
 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value) return [value];
  return [];
}

export function toPairlyConversation(row: ConversationRow): PairlyConversation {
  return {
    id: row.id,
    userId: row.user_id,
    mode: MODES.includes(row.mode as PairlyMode) ? (row.mode as PairlyMode) : "bot",
    status: row.status === "closed" ? "closed" : ("open" as PairlyStatus),
    escalatedAt: row.escalated_at,
    escalationReason: row.escalation_reason,
    assignedAgent: row.assigned_agent,
    lastMessageAt: row.last_message_at,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    createdAt: row.created_at,
  };
}

export function toPairlyMessage(row: MessageRow): PairlyMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: ROLES.includes(row.role as PairlyRole) ? (row.role as PairlyRole) : "system",
    text: row.content ?? "",
    createdAt: row.created_at,
    intents: toStringArray(row.intents),
    subIntent: row.sub_intent,
    sentiment: row.sentiment,
    action: row.action,
    escalate: row.escalate === true,
    escalationReason: row.escalation_reason,
    articleIds: toStringArray(row.article_ids),
    grounded: row.grounded,
    recommendedAction: row.recommended_action,
    deviationReason: row.deviation_reason,
    override: row.override,
    agentId: row.agent_id,
    latencyMs: row.latency_ms,
  };
}

// --- Розмови -----------------------------------------------------------------

export async function createConversation(userId: string): Promise<PairlyConversation> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_conversations")
    // `mode: 'bot'` і `status: 'open'` ставить КОД, не форма й не модель: це
    // детерміновані прапорці стану, і в цьому проєкті їх ніколи не віддають
    // нікому, хто може «здебільшого» вгадати правильно.
    .insert({ user_id: userId, mode: "bot", status: "open" })
    .select(CONVERSATION_COLUMNS)
    .single<ConversationRow>();

  if (error) throw new Error(error.message);
  return toPairlyConversation(data);
}

export async function loadConversation(id: string): Promise<PairlyConversation | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("id", id)
    .maybeSingle<ConversationRow>();

  if (error) throw new Error(error.message);
  return data ? toPairlyConversation(data) : null;
}

/**
 * Остання відкрита розмова користувача. Сторінка `/support/chat` не носить
 * `conversation_id` в URL: людина приходить за посиланням із вибору роли, і
 * розмова мусить продовжитися там, де скінчилася.
 */
export async function loadOpenConversation(userId: string): Promise<PairlyConversation | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    // Вторинний ключ обов'язковий: дві розмови, створені в один момент, без
    // нього обиралися б недетерміновано.
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<ConversationRow>();

  if (error) throw new Error(error.message);
  return data ? toPairlyConversation(data) : null;
}

export async function touchConversation(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pairly_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Позначає розмову ескалованою. Фільтр `escalated_at is null` — атомарний
 * guard: до цього рядка приходять ДВА шляхи (конверт у відповіді та вебхук
 * `/api/pairly/escalate`, §1.6), і перемагає той, хто прийшов першим. Без
 * фільтра другий перетер би час і причину, які вже побачив тех. сапорт.
 *
 * Повертає `true`, якщо запис зробив саме цей виклик.
 */
export async function markEscalated(
  id: string,
  reason: string | null,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_conversations")
    .update({
      mode: "pending_human",
      escalated_at: new Date().toISOString(),
      escalation_reason: reason,
    })
    .eq("id", id)
    .is("escalated_at", null)
    .select("id");

  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/**
 * Розмова переходить у режим людини. Викликається з ходу тех. сапорта, і
 * `escalated_at` тут НЕ чіпається: факт ескалації лишається фактом про
 * розмову, а не станом, який знімається відповіддю.
 */
export async function assignAgent(id: string, agentId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pairly_conversations")
    .update({
      mode: "human",
      assigned_agent: agentId,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Закриває розмову. Фільтр `status=eq.open` робить другий клік безпечним:
 * закрити вже закрите — не помилка, але й не причина переписувати `closed_by`
 * на того, хто натиснув пізніше.
 *
 * Повертає `true`, якщо закрив саме цей виклик.
 */
export async function closeConversation(id: string, closedBy: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_conversations")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: closedBy,
    })
    .eq("id", id)
    .eq("status", "open")
    .select("id");

  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

// --- Ходи --------------------------------------------------------------------

export async function loadMessages(conversationId: string): Promise<PairlyMessage[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    // Вторинний ключ, бо хід користувача й хід бота одного прогону можуть
    // мати однаковий `created_at` до мікросекунди — той самий порядок, що
    // нода історії в графі (`order=created_at.asc,id.asc`).
    .order("id", { ascending: true })
    .limit(MESSAGE_LIMIT)
    .returns<MessageRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(toPairlyMessage);
}

/**
 * Хід користувача. Пишеться ПЕРШИМ, до виклику Dify, і повертає свій `id` —
 * він же `turn_id` для графа (§5 архітектури). Порядок не переставляти:
 * якщо Dify не відповість, хід мусить лишитися в базі, інакше людина побачить
 * порожній чат після власного повідомлення.
 */
export async function insertUserTurn(
  conversationId: string,
  text: string,
): Promise<PairlyMessage> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_messages")
    .insert({ conversation_id: conversationId, role: "user", content: text })
    .select(MESSAGE_COLUMNS)
    .single<MessageRow>();

  if (error) throw new Error(error.message);
  return toPairlyMessage(data);
}

/**
 * Дописує intents у рядок ходу КОРИСТУВАЧА.
 *
 * Це не дублювання з ходом бота. Правило повтору (`decide.count_repeats`)
 * читає intents саме з ходів `role='user'`: питання «скільки попередніх ходів
 * користувача мали той самий intent» інакше не має де взяти відповідь. Без
 * цього UPDATE другий хід розмови ніколи не побачив би повтору, і кейси
 * T013B/T063 давали б інструкцію втретє — рівно те, що флоу ескалації
 * забороняє.
 */
export async function tagUserTurn(id: string, intents: string[]): Promise<void> {
  if (intents.length === 0) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from("pairly_messages").update({ intents }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertBotTurn(opts: {
  conversationId: string;
  text: string;
  envelope: PairlyEnvelope | null;
  difyMessageId: string | null;
  latencyMs: number;
}): Promise<PairlyMessage> {
  const supabase = createAdminClient();
  const envelope = opts.envelope;
  const { data, error } = await supabase
    .from("pairly_messages")
    .insert({
      conversation_id: opts.conversationId,
      role: "bot",
      content: opts.text,
      intents: envelope?.intents ?? [],
      sub_intent: envelope?.sub_intent ?? null,
      sentiment: envelope?.sentiment ?? null,
      action: envelope?.action ?? null,
      escalate: envelope?.escalate ?? false,
      escalation_reason: envelope?.escalation_reason ?? null,
      article_ids: envelope?.article_ids ?? [],
      // `grounded` лишається `null`, коли конверт не приїхав: `false` означало
      // б «KB не дала ґрунту», а ми просто не знаємо.
      grounded: envelope ? envelope.grounded : null,
      // Рішення моделі проти поради коду. `override` каже, хто виграв, і саме
      // його рахує `pairly/test_agent.py` окремим кошиком.
      recommended_action: envelope?.recommended_action ?? null,
      deviation_reason: envelope?.deviation_reason ?? null,
      override: envelope?.override ?? null,
      dify_message_id: opts.difyMessageId,
      latency_ms: opts.latencyMs,
    })
    .select(MESSAGE_COLUMNS)
    .single<MessageRow>();

  if (error) throw new Error(error.message);
  return toPairlyMessage(data);
}

/**
 * Хід тех. сапорта. Dify тут не викликається взагалі — це і є та межа, яку
 * кейс вимагає розмежувати: бот або людина.
 */
export async function insertAgentTurn(opts: {
  conversationId: string;
  agentId: string;
  text: string;
}): Promise<PairlyMessage> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_messages")
    .insert({
      conversation_id: opts.conversationId,
      role: "agent",
      content: opts.text,
      agent_id: opts.agentId,
    })
    .select(MESSAGE_COLUMNS)
    .single<MessageRow>();

  if (error) throw new Error(error.message);
  return toPairlyMessage(data);
}

/**
 * Службовий хід розмови: «користувач попросив людину», «розмову закрито».
 *
 * Окрема роль, а не приписка до ходу бота. Ці рядки нічого не відповідають —
 * вони фіксують, що змінився стан розмови, і в транскрипті для живого агента
 * мусять читатися саме так. Підмішані в текст бота, вони колись поїхали б у
 * вижимку як його слова.
 */
export async function insertSystemTurn(opts: {
  conversationId: string;
  text: string;
  escalationReason?: string | null;
}): Promise<PairlyMessage> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_messages")
    .insert({
      conversation_id: opts.conversationId,
      role: "system",
      content: opts.text,
      escalate: Boolean(opts.escalationReason),
      escalation_reason: opts.escalationReason ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single<MessageRow>();

  if (error) throw new Error(error.message);
  return toPairlyMessage(data);
}

// --- Вижимки -----------------------------------------------------------------

/**
 * Багато рядків на розмову — кожен клік «Самарайз» свій. Причина та сама, що в
 * Дні 3: людина ухвалює рішення по конкретній вижимці, і перезапис зробив би
 * попередню недосяжною разом із тим, що по ній вирішили.
 */
export async function insertHandoff(opts: {
  conversationId: string;
  summaryMd: string;
  payload: unknown;
  generatedBy: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("pairly_handoffs").insert({
    conversation_id: opts.conversationId,
    summary_md: opts.summaryMd,
    payload: opts.payload,
    generated_by: opts.generatedBy,
  });
  if (error) throw new Error(error.message);
}

// --- Черга й довідники -------------------------------------------------------

/**
 * Черга тех. сапорта. Порядок не «за часом», а за роботою: спершу все, що вже
 * не на боті (`mode <> 'bot'`) — найдавніша ескалація вгорі не потрібна,
 * потрібна найсвіжіша, бо людина в чаті чекає ЗАРАЗ; далі решта відкритих
 * розмов за останнім повідомленням.
 *
 * Два запити, а не один із `or`: PostgREST відсортував би обидві групи одним
 * ключем, а в них різні ключі (`escalated_at` проти `last_message_at`), і
 * розмова без ескалації взагалі не має `escalated_at`.
 */
export async function loadQueue(): Promise<PairlyQueueItem[]> {
  const supabase = createAdminClient();

  const escalated = await supabase
    .from("pairly_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("status", "open")
    .neq("mode", "bot")
    .order("escalated_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(QUEUE_LIMIT)
    .returns<ConversationRow[]>();
  if (escalated.error) throw new Error(escalated.error.message);

  const rest = await supabase
    .from("pairly_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("status", "open")
    .eq("mode", "bot")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(QUEUE_LIMIT)
    .returns<ConversationRow[]>();
  if (rest.error) throw new Error(rest.error.message);

  const rows = [...(escalated.data ?? []), ...(rest.data ?? [])];
  if (rows.length === 0) return [];

  // Останнє повідомлення й лічильник — одним запитом на всю чергу, а не
  // запитом на розмову: список опитується раз на 3 секунди, і N+1 тут
  // помножився б на кожен тик.
  const ids = rows.map((row) => row.id);
  const { data: messages, error } = await supabase
    .from("pairly_messages")
    .select("conversation_id, role, content, created_at, id")
    .in("conversation_id", ids)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .returns<Pick<MessageRow, "conversation_id" | "role" | "content" | "created_at" | "id">[]>();
  if (error) throw new Error(error.message);

  const last = new Map<string, { role: PairlyRole | null; text: string }>();
  const count = new Map<string, number>();
  for (const message of messages ?? []) {
    count.set(message.conversation_id, (count.get(message.conversation_id) ?? 0) + 1);
    last.set(message.conversation_id, {
      role: ROLES.includes(message.role as PairlyRole) ? (message.role as PairlyRole) : null,
      text: message.content ?? "",
    });
  }

  return rows.map((row) => {
    const tail = last.get(row.id);
    return {
      ...toPairlyConversation(row),
      messageCount: count.get(row.id) ?? 0,
      lastRole: tail?.role ?? null,
      lastText: tail?.text ?? "",
    };
  });
}

/**
 * 32 акаунти датасету для селекту на `/support`. Читаються через API, а не
 * серверним компонентом: `pairly_users` під RLS без політик, а
 * `lib/supabase-admin.ts` не виходить за межі `app/api/pairly/**`.
 */
export async function loadUsers(): Promise<PairlyUserOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_users")
    .select("user_id, first_name, plan, billing_platform, subscription_status")
    .order("user_id", { ascending: true })
    .returns<
      {
        user_id: string;
        first_name: string | null;
        plan: string | null;
        billing_platform: string | null;
        subscription_status: string | null;
      }[]
    >();

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    firstName: row.first_name ?? row.user_id,
    plan: row.plan,
    billingPlatform: row.billing_platform,
    subscriptionStatus: row.subscription_status,
  }));
}

export async function loadAgents(): Promise<PairlyAgentOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pairly_agents")
    .select("agent_id, name")
    .order("agent_id", { ascending: true })
    .returns<{ agent_id: string; name: string | null }[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    agentId: row.agent_id,
    name: row.name ?? row.agent_id,
  }));
}
