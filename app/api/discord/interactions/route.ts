import crypto from "node:crypto";
import { after } from "next/server";

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
 * GET на цю ж адресу показує стан конфігурації (без значень) — коли клік
 * «не працює», починати варто звідти.
 */

// Ed25519 SPKI DER-префікс: 32 байти ключа Discord дає у hex без обгортки.
const DER_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const CUSTOM_ID_RE =
  /^day2:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(approve|reject)$/i;

const GREY = 0x9b9b9b;
const RED = 0xed4245;
const DISCORD_API = "https://discord.com/api/v10";

type Interaction = {
  type?: number;
  application_id?: string;
  token?: string;
  channel_id?: string;
  channel?: { id?: string };
  message?: { id?: string; embeds?: unknown[] };
  member?: { user?: { username?: string; id?: string } };
  user?: { username?: string; id?: string };
  data?: { custom_id?: string };
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

function decisionButtons(planId: string) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "Затвердити",
          custom_id: `day2:${planId}:approve`,
        },
        {
          type: 2,
          style: 4,
          label: "Відхилити",
          custom_id: `day2:${planId}:reject`,
        },
      ],
    },
  ];
}

/**
 * Діагностика: що з конфігурації видно застосунку. Значень не показує —
 * лише наявність, довжину й хост, щоб не зливати ключі в браузер.
 */
export async function GET() {
  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? "";
  const webhook = process.env.DIFY_WEBHOOK_URL ?? "";
  let webhookHost = "";
  try {
    webhookHost = webhook ? new URL(webhook).host : "";
  } catch {
    webhookHost = "НЕКОРЕКТНИЙ URL";
  }

  const problems: string[] = [];
  if (!publicKey) problems.push("DISCORD_PUBLIC_KEY не заданий — Discord отримає 500");
  else if (publicKey.trim().length !== 64)
    problems.push(`DISCORD_PUBLIC_KEY має бути 64 hex-символи, а не ${publicKey.trim().length}`);
  if (!webhook) problems.push("DIFY_WEBHOOK_URL не заданий — рішення нікуди передавати");
  else if (!/^https?:\/\//.test(webhook)) problems.push("DIFY_WEBHOOK_URL має починатися з https://");

  return Response.json({
    endpoint: "discord interactions",
    runtime: "nodejs",
    discord_public_key: {
      present: Boolean(publicKey),
      length: publicKey.trim().length,
    },
    dify_webhook: { present: Boolean(webhook), host: webhookHost },
    dify_webhook_key: { present: Boolean(process.env.DIFY_WEBHOOK_KEY) },
    ok: problems.length === 0,
    problems,
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

  if (interaction.type === 1) return Response.json({ type: 1 }); // PING
  if (interaction.type !== 3) return Response.json({ type: 1 }); // не компонент

  const customId = interaction.data?.custom_id ?? "";
  const match = CUSTOM_ID_RE.exec(customId);
  if (!match) return ephemeral("Невідома кнопка — рішення не передано.");

  const [, planId, rawAction] = match;
  const action = rawAction.toLowerCase();
  const who = interaction.member?.user ?? interaction.user ?? {};
  const user = who.username ?? "discord";

  const webhookUrl = process.env.DIFY_WEBHOOK_URL;
  if (!webhookUrl) {
    // Кнопки лишаємо живими: щойно змінна з'явиться, клік спрацює.
    console.error("[discord] DIFY_WEBHOOK_URL не заданий");
    return ephemeral(
      "Вебхук воркфлоу не налаштований (DIFY_WEBHOOK_URL). Рішення не передано — " +
        "перевір /api/discord/interactions у браузері.",
    );
  }

  const embeds = Array.isArray(interaction.message?.embeds)
    ? interaction.message!.embeds!.slice(0, 9)
    : [];
  const applicationId = interaction.application_id;
  const interactionToken = interaction.token;

  // Робота ПІСЛЯ відповіді: у Discord є лише 3 секунди, і вони не мають
  // залежати від того, як швидко відповість Dify.
  after(async () => {
    let failure = "";
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.DIFY_WEBHOOK_KEY
            ? { Authorization: `Bearer ${process.env.DIFY_WEBHOOK_KEY}` }
            : {}),
        },
        // Тільки ідентифікатори: вебхук-тригер Dify не має автентифікації, тому
        // все, що тут поїде, вважається недовіреним і перевіряється у графі.
        body: JSON.stringify({
          plan_id: planId,
          action,
          user,
          user_id: who.id ?? "",
          channel_id: interaction.channel_id ?? interaction.channel?.id ?? "",
          message_id: interaction.message?.id ?? "",
          decided_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        failure = `воркфлоу відповів HTTP ${response.status}`;
        console.error("[discord] Dify webhook", response.status, await response.text());
      }
    } catch (error) {
      failure = "воркфлоу недоступний";
      console.error("[discord] Dify webhook недоступний", error);
    }

    if (!failure || !applicationId || !interactionToken) return;

    // Не вдалося передати рішення — повертаємо кнопки й пишемо причину в картку.
    // Токен взаємодії авторизує цей запит сам, бот-токен тут не потрібен.
    try {
      await fetch(
        `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [
              ...embeds,
              {
                description: `⚠️ Рішення не передано: ${failure}. Натисни ще раз.`,
                color: RED,
              },
            ],
            components: decisionButtons(planId),
          }),
        },
      );
    } catch (error) {
      console.error("[discord] не вдалося повернути кнопки", error);
    }
  });

  // type 7 = UPDATE_MESSAGE. Кнопки гасить саме ендпоінт: так вікно для
  // повторного кліку закривається ще до старту рану у Dify.
  return Response.json({
    type: 7,
    data: {
      embeds: [
        ...embeds,
        {
          description: `⏳ Обробляється: ${
            action === "approve" ? "затвердження" : "відхилення"
          } від ${user}`,
          color: GREY,
        },
      ],
      components: [],
    },
  });
}
