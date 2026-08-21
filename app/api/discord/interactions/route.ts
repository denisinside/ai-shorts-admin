import crypto from "node:crypto";

// node:crypto недоступний в edge-рантаймі, а без перевірки підпису Discord
// навіть не збереже Interactions Endpoint URL.
export const runtime = "nodejs";

/**
 * Ендпоінт Discord Interactions. Стоїть тут, а не в Dify, з однієї причини:
 * Discord вимагає 401 на битий підпис (він надсилає такий при реєстрації URL)
 * і `{"type":1}` на PING, а вебхук-тригер Dify віддає лише 2xx–3xx.
 *
 * Роль ендпоінта — тонка: перевірити підпис, погасити кнопки й переказати
 * ІДЕНТИФІКАТОРИ у вебхук Dify. Рішення в базу пише воркфлоу, не ця ручка.
 */

// Ed25519 SPKI DER-префікс: 32 байти ключа Discord дає у hex без обгортки.
const DER_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const CUSTOM_ID_RE =
  /^day2:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(approve|reject)$/i;

const GREY = 0x9b9b9b;

type Interaction = {
  type?: number;
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
      key: Buffer.concat([DER_PREFIX, Buffer.from(publicKey, "hex")]),
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

/** Ефемерна відповідь: бачить лише той, хто натиснув, кнопки лишаються живими. */
function ephemeral(content: string) {
  return Response.json({ type: 4, data: { content, flags: 64 } });
}

export async function POST(request: Request) {
  // Підпис перевіряється над СИРИМ тілом: розпарсений і зібраний назад JSON
  // дасть інші байти й перевірка провалиться.
  const raw = await request.text();

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    console.error("DISCORD_PUBLIC_KEY не заданий");
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
    console.error("DIFY_WEBHOOK_URL не заданий");
    return ephemeral("Вебхук воркфлоу не налаштований — рішення не передано.");
  }

  // Awaited, не fire-and-forget: serverless уб'є процес після відповіді.
  // Вебхук-тригер Dify відповідає одразу після старту рану, тож у 3 секунди,
  // які дає Discord, це вкладається.
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
      // все, що тут поїде, вважається недовіреним і перевіряється на боці графа.
      body: JSON.stringify({
        plan_id: planId,
        action,
        user,
        user_id: who.id ?? "",
        channel_id: interaction.channel_id ?? interaction.channel?.id ?? "",
        message_id: interaction.message?.id ?? "",
        decided_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      console.error("Dify webhook відповів", response.status, await response.text());
      return ephemeral(
        `Воркфлоу не прийняв рішення (HTTP ${response.status}). Спробуйте ще раз.`,
      );
    }
  } catch (error) {
    console.error("Dify webhook недоступний", error);
    return ephemeral("Воркфлоу недоступний — рішення не передано. Спробуйте ще раз.");
  }

  // type 7 = UPDATE_MESSAGE. Кнопки гасить саме ендпоінт, а не воркфлоу:
  // так вікно для повторного кліку закривається ще до старту рану.
  const embeds = Array.isArray(interaction.message?.embeds)
    ? interaction.message!.embeds!.slice(0, 9)
    : [];

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
