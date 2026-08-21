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
const MESSAGE_COMPONENT = 3;
const MODAL_SUBMIT = 5;

type Interaction = {
  type?: number;
  application_id?: string;
  token?: string;
  channel_id?: string;
  channel?: { id?: string };
  message?: { id?: string; embeds?: unknown[] };
  member?: { user?: { username?: string; id?: string } };
  user?: { username?: string; id?: string };
  data?: { custom_id?: string; components?: unknown };
};

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
