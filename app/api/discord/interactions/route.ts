import crypto from "node:crypto";
import { after } from "next/server";
import {
  actionVerb,
  decisionButtons,
  gateDiagnostics,
  gateProblems,
  parseCustomId,
  reviseModal,
  reviseNote,
  type GateTarget,
} from "@/lib/discord-gate";
import {
  MOODS,
  PROGRESS,
  THINKING,
  aislopConfig,
  askOrchestrator,
  pick,
  renderAnswer,
} from "@/lib/aislop";

// node:crypto недоступний в edge-рантаймі, а без перевірки підпису Discord
// навіть не збереже Interactions Endpoint URL.
export const runtime = "nodejs";

/**
 * Ендпоінт Discord Interactions. Стоїть тут, а не в Dify, з однієї причини:
 * Discord вимагає `{"type":1}` на PING і **401** на битий підпис (він надсилає
 * такий при реєстрації URL), а вебхук-тригер Dify віддає лише 2xx–3xx.
 *
 * Головне обмеження: **3 секунди на відповідь**. Інакше користувач бачить
 * «Приложение не ответило вовремя». Тому порядок такий: перевірили підпис →
 * ВІДПОВІЛИ (кнопки згасли) → і лише потім, у `after()`, стукаємо в Dify.
 * Якщо Dify не відповів, `after()` повертає кнопки й пише причину в картку —
 * клік завжди можна повторити.
 *
 * Куди саме стукати, вирішує НЕ цей файл, а `lib/discord-gate.ts` за доменом
 * з `custom_id` (`day1:<uuid>:approve`). Так новий день додається рядком у
 * реєстрі, а не гілкою тут.
 *
 * GET на цю ж адресу показує стан конфігурації (без значень) — коли клік
 * «не працює», починати варто звідти.
 */

// Ed25519 SPKI DER-префікс: 32 байти ключа Discord дає у hex без обгортки.
const DER_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const GREY = 0x9b9b9b;
const RED = 0xed4245;
const DISCORD_API = "https://discord.com/api/v10";

// Типи взаємодій Discord, які нас стосуються.
const PING = 1;
const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;
const MODAL_SUBMIT = 5;

const AISLOP_COMMAND = "aislop";

type Interaction = {
  type?: number;
  application_id?: string;
  token?: string;
  channel_id?: string;
  channel?: { id?: string };
  message?: { id?: string; embeds?: unknown[] };
  member?: { user?: { username?: string; id?: string } };
  user?: { username?: string; id?: string };
  data?: {
    custom_id?: string;
    components?: unknown;
    name?: string;
    options?: { name?: string; value?: unknown }[];
  };
};

function commandOption(interaction: Interaction, name: string): unknown {
  return interaction.data?.options?.find((o) => o.name === name)?.value;
}

function verifySignature(raw: string, request: Request, publicKey: string): boolean {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!signature || !timestamp) return false;

  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([DER_PREFIX, Buffer.from(publicKey.trim(), "hex")]),
      format: "der",
      type: "spki",
    });
    return crypto.verify(
      null, // для ed25519 алгоритм задає сам ключ
      Buffer.from(timestamp + raw),
      key,
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

/** Ефемерна відповідь: бачить лише той, хто натиснув; кнопки лишаються живими. */
function ephemeral(content: string) {
  return Response.json({ type: 4, data: { content, flags: 64 } });
}

/**
 * Діагностика: що з конфігурації видно застосунку. Значень не показує —
 * лише наявність, довжину й хост, щоб не зливати ключі в браузер.
 */
export async function GET() {
  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? "";

  const problems: string[] = [];
  if (!aislopConfig().key)
    problems.push("DIFY_ORCHESTRATOR_API_KEY не заданий — /aislop не відповідатиме");
  if (!publicKey) problems.push("DISCORD_PUBLIC_KEY не заданий — Discord отримає 500");
  else if (publicKey.trim().length !== 64)
    problems.push(`DISCORD_PUBLIC_KEY має бути 64 hex-символи, а не ${publicKey.trim().length}`);
  problems.push(...gateProblems());

  return Response.json({
    endpoint: "discord interactions",
    runtime: "nodejs",
    discord_public_key: {
      present: Boolean(publicKey),
      length: publicKey.trim().length,
    },
    gates: gateDiagnostics(),
    dify_webhook_key: { present: Boolean(process.env.DIFY_WEBHOOK_KEY) },
    aislop: {
      api_base: aislopConfig().base,
      api_key: { present: Boolean(aislopConfig().key) },
    },
    ok: problems.length === 0,
    problems,
  });
}

/**
 * Передає рішення у воркфлоу домену. Повертає порожній рядок при успіху або
 * причину збою — щоб той, хто викликав, вирішив, як її показати людині.
 *
 * У тіло їдуть ТІЛЬКИ ідентифікатори: вебхук-тригер Dify не має
 * автентифікації, тому все, що тут поїде, вважається недовіреним і
 * перевіряється у графі.
 */
async function forward(
  target: GateTarget,
  payload: Record<string, string>,
): Promise<string> {
  const webhookUrl = target.gate.webhook;
  if (!webhookUrl) return `вебхук домену ${target.domain} не налаштований`;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.DIFY_WEBHOOK_KEY
          ? { Authorization: `Bearer ${process.env.DIFY_WEBHOOK_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        domain: target.domain,
        record_id: target.recordId,
        // Легасі-ім'я: опублікований воркфлоу Дня 2 читає з тіла саме `plan_id`.
        // Дублюємо, поки він не перейде на `record_id`, — інакше викладка цієї
        // зміни зламала б уже працюючий гейт.
        plan_id: target.recordId,
        action: target.action,
        ...payload,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return "";
    console.error("[discord] Dify webhook", response.status, await response.text());
    return `воркфлоу відповів HTTP ${response.status}`;
  } catch (error) {
    console.error("[discord] Dify webhook недоступний", error);
    return "воркфлоу недоступний";
  }
}

/**
 * Дописує ще одне повідомлення до тієї самої взаємодії. Потрібне, коли відповідь
 * не влізла в одне: ліміт `content` — 2000 символів, опису ембеда — 4096.
 * Токен взаємодії живе 15 хвилин і авторизує це сам, бот-токен не потрібен.
 */
async function followUp(
  applicationId: string | undefined,
  token: string | undefined,
  body: unknown,
) {
  if (!applicationId || !token) return;
  try {
    await fetch(`${DISCORD_API}/webhooks/${applicationId}/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[discord] не вдалося дописати повідомлення", error);
  }
}

/** Редагує повідомлення, яким ми вже відповіли. Токен взаємодії авторизує сам. */
async function editOriginal(
  applicationId: string | undefined,
  token: string | undefined,
  body: unknown,
) {
  if (!applicationId || !token) return;
  try {
    await fetch(`${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[discord] не вдалося оновити повідомлення", error);
  }
}

/**
 * `/aislop <запит>` — розмова з оркестратором.
 *
 * Відповідаємо ТИПОМ 4, а не 5 (deferred), навмисно: deferred показує
 * безлике системне «застосунок думає», а тип 4 дозволяє одразу сказати щось
 * своїм голосом і потім замінити це відповіддю. Три секунди на це вистачає
 * з запасом, бо в Dify ми йдемо вже після відповіді, у `after()`.
 */
function handleAislop(interaction: Interaction) {
  if (interaction.data?.name !== AISLOP_COMMAND) {
    return ephemeral("Невідома команда.");
  }

  const query = String(commandOption(interaction, "запит") ?? "").trim();
  const fresh = commandOption(interaction, "нова") === true;
  if (!query) return ephemeral("Порожній запит — нема на що відповідати.");

  const who = interaction.member?.user ?? interaction.user ?? {};
  const author = who.username ?? "хтось";
  const channelId = interaction.channel_id ?? interaction.channel?.id ?? "global";
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;

  const header = `-# ${author}: ${query.slice(0, 180)}`;

  after(async () => {
    // Питання з вибіркою по базі або запуск воркфлоу можуть тривати довше за
    // кілька секунд. Без ознак життя це виглядає як зависання, тому дописуємо
    // проміжні репліки — і гасимо їх, щойно прийшла відповідь, щоб таймер не
    // перезаписав уже готовий текст.
    let answered = false;
    const timers = PROGRESS.map((variants, index) =>
      setTimeout(
        () => {
          if (answered) return;
          void editOriginal(applicationId, interactionToken, {
            content: `${pick(variants)}\n${header}`,
          });
        },
        6000 + index * 9000,
      ),
    );

    const result = await askOrchestrator({
      query,
      author,
      // Пам'ять прив'язана до КАНАЛУ, не до людини: у робочому чаті контекст
      // спільний, і відповідь на «а що там далі» має враховувати сусідні репліки.
      user: `discord:${channelId}`,
      mood: pick(MOODS),
      fresh,
    });

    answered = true;
    for (const timer of timers) clearTimeout(timer);

    const messages =
      "answer" in result
        ? renderAnswer(result.answer)
        : [{ content: `ой, зараз не вийшло: ${result.error} 🥲` }];

    // Перше повідомлення замінює репліку «думаю», решта дописуються слідом —
    // саме в такому порядку, інакше хвіст з'явиться раніше за початок.
    const [first, ...rest] = messages;
    await editOriginal(applicationId, interactionToken, first);
    for (const part of rest) {
      await followUp(applicationId, interactionToken, part);
    }
  });

  // Репліка «думаю» випадкова — саме вона робить кожен виклик несхожим на
  // попередній ще до того, як модель щось написала.
  return Response.json({
    type: 4,
    data: { content: `${pick(THINKING)}\n${header}` },
  });
}

export async function POST(request: Request) {
  // Підпис перевіряється над СИРИМ тілом: розпарсений і зібраний назад JSON
  // дасть інші байти й перевірка провалиться.
  const raw = await request.text();

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    console.error("[discord] DISCORD_PUBLIC_KEY не заданий");
    return new Response("misconfigured", { status: 500 });
  }
  if (!verifySignature(raw, request, publicKey)) {
    return new Response("invalid request signature", { status: 401 });
  }

  let interaction: Interaction;
  try {
    interaction = JSON.parse(raw) as Interaction;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (interaction.type === PING) return Response.json({ type: 1 });

  if (interaction.type === APPLICATION_COMMAND) {
    return handleAislop(interaction);
  }

  if (interaction.type !== MESSAGE_COMPONENT && interaction.type !== MODAL_SUBMIT) {
    return Response.json({ type: 1 });
  }

  const target = parseCustomId(interaction.data?.custom_id ?? "");
  if (!target) return ephemeral("Невідома кнопка — рішення не передано.");

  const who = interaction.member?.user ?? interaction.user ?? {};
  const user = who.username ?? "discord";
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;
  const common = {
    user,
    user_id: who.id ?? "",
    channel_id: interaction.channel_id ?? interaction.channel?.id ?? "",
    message_id: interaction.message?.id ?? "",
    decided_at: new Date().toISOString(),
  };

  // ---- правки, крок 1: показати модалку ----
  // Модалка — єдина відповідь, яку тут можна дати (тип 9 не поєднується з
  // редагуванням повідомлення), тому кнопки картки лишаються на місці.
  // Це навмисно: людина може закрити модалку, і їй є куди повернутися.
  if (interaction.type === MESSAGE_COMPONENT && target.action === "revise") {
    return Response.json(reviseModal(target.domain, target.recordId));
  }

  // ---- правки, крок 2: сабміт модалки ----
  if (interaction.type === MODAL_SUBMIT) {
    const note = reviseNote(interaction.data?.components);
    if (!note) return ephemeral("Порожній текст правок — нічого не передано.");

    after(async () => {
      const failure = await forward(target, { ...common, note });
      if (!failure) return;
      // Картку не чіпаємо: кнопки на ній живі, бо ми відповідали ефемерно.
      // Правимо саме ефемерну відповідь — її бачить тільки автор кліку.
      await editOriginal(applicationId, interactionToken, {
        content: `⚠️ Правки не передано: ${failure}. Натисни «Правки» ще раз.`,
      });
    });

    return ephemeral(
      `Правки прийнято — запускаю новий прогін.\n> ${note.slice(0, 300)}`,
    );
  }

  // ---- рішення: затвердити або відхилити ----
  const embeds = Array.isArray(interaction.message?.embeds)
    ? interaction.message!.embeds!.slice(0, 9)
    : [];

  // Робота ПІСЛЯ відповіді: у Discord є лише 3 секунди, і вони не мають
  // залежати від того, як швидко відповість Dify.
  after(async () => {
    const failure = await forward(target, common);
    if (!failure) return;

    // Не вдалося передати рішення — повертаємо кнопки й пишемо причину в картку.
    await editOriginal(applicationId, interactionToken, {
      embeds: [
        ...embeds,
        {
          description: `⚠️ Рішення не передано: ${failure}. Натисни ще раз.`,
          color: RED,
        },
      ],
      components: decisionButtons(target.domain, target.recordId),
    });
  });

  // type 7 = UPDATE_MESSAGE. Кнопки гасить саме ендпоінт: так вікно для
  // повторного кліку закривається ще до старту рану у Dify.
  return Response.json({
    type: 7,
    data: {
      embeds: [
        ...embeds,
        {
          description: `⏳ Обробляється: ${actionVerb(target.action)} від ${user}`,
          color: GREY,
        },
      ],
      components: [],
    },
  });
}
