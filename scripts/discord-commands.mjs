#!/usr/bin/env node
/**
 * Реєстрація слеш-команд бота.
 *
 *   npm run discord:register     зареєструвати (ідемпотентно: PUT замінює весь набір)
 *   npm run discord:list         показати, що зараз зареєстровано
 *   npm run discord:delete       прибрати всі команди
 *
 * ЧОМУ ЦЕЙ ФАЙЛ ЛЕЖИТЬ У РЕПОЗИТОРІЇ ПАНЕЛІ, А НЕ ПОРУЧ З РЕШТОЮ СКРИПТІВ:
 * опис команди (`aislop`, опції `запит` і `нова`) мусить збігатися з тим, що
 * читає обробник у `app/api/discord/interactions/route.ts`. Тримати опис в
 * іншому репозиторії означає майже гарантований розсинхрон: хтось перейменує
 * опцію в одному місці, і команда мовчки почне приходити з полем, якого код
 * не чекає. Тут вони поруч і правляться одним комітом.
 *
 * КОМАНДИ РЕЄСТРУЮТЬСЯ НА СЕРВЕРІ (guild-scoped), а не глобально: guild-команди
 * з'являються миттєво, глобальні розповзаються до години. Для одного робочого
 * сервера глобальні не дають нічого, крім очікування.
 *
 * Токен береться з `DISCORD_BOT_TOKEN`. Локально, коли змінної немає, читається
 * словник `../config/secrets.local.env` — щоб не заводити копію бот-токена в
 * `.env.local` панелі.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = "https://discord.com/api/v10";

/** Єдиний опис команди. Міняєш тут — перезапускаєш реєстрацію. */
const COMMANDS = [
  {
    name: "aislop",
    type: 1,
    description: "спитати студійного асистента про проєкти, тренди й плани",
    options: [
      {
        type: 3, // STRING
        name: "запит",
        description: "що спитати або що зробити",
        required: true,
      },
      {
        type: 5, // BOOLEAN
        name: "нова",
        description: "почати розмову з чистого аркуша, без попереднього контексту",
        required: false,
      },
    ],
  },
];

function readToken() {
  if (process.env.DISCORD_BOT_TOKEN) return process.env.DISCORD_BOT_TOKEN.trim();

  // Локальний запуск: словник лежить у корені монорепо, поза репозиторієм панелі.
  const dict = path.resolve(HERE, "..", "..", "config", "secrets.local.env");
  if (!fs.existsSync(dict)) return "";
  for (const line of fs.readFileSync(dict, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq).trim() === "DISCORD_BOT_TOKEN") {
      return trimmed.slice(eq + 1).trim();
    }
  }
  return "";
}

async function call(method, endpoint, token, payload) {
  const response = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      // Discord вимагає User-Agent від ботів; без нього частина маршрутів дає 403.
      "User-Agent": "DiscordBot (ai-shorts-studio, 1.0)",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

async function run() {
  const mode = process.argv.includes("--list")
    ? "list"
    : process.argv.includes("--delete")
      ? "delete"
      : "register";
  const gated = process.argv.includes("--if-enabled");

  // Автоматичний хук: мовчки нічого не робить, доки його явно не увімкнули.
  // Реєструвати команди на кожен деплой сенсу немає — опис міняється раз на
  // місяці, а збій Discord не має валити викладку панелі.
  if (gated) {
    if (process.env.DISCORD_REGISTER_COMMANDS !== "1") return;
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
      console.log("[discord] preview-деплой — команди не чіпаємо");
      return;
    }
  }

  const token = readToken();
  if (!token) {
    const message = "немає DISCORD_BOT_TOKEN (ні в оточенні, ні у config/secrets.local.env)";
    if (gated) {
      console.warn(`[discord] ${message} — пропускаю`);
      return;
    }
    throw new Error(message);
  }

  const me = await call("GET", "/users/@me", token);
  if (me.status !== 200) {
    throw new Error(`бот-токен не приймається (HTTP ${me.status}): ${JSON.stringify(me.body)}`);
  }
  const appId = me.body.id;
  console.log(`[discord] бот ${me.body.username} (application id ${appId})`);

  const guilds = await call("GET", "/users/@me/guilds", token);
  if (guilds.status !== 200 || !Array.isArray(guilds.body) || guilds.body.length === 0) {
    throw new Error(`не вдалося отримати список серверів (HTTP ${guilds.status})`);
  }

  for (const guild of guilds.body) {
    const endpoint = `/applications/${appId}/guilds/${guild.id}/commands`;

    if (mode === "list") {
      const existing = await call("GET", endpoint, token);
      console.log(`\n${guild.name} (${guild.id}): HTTP ${existing.status}`);
      for (const cmd of existing.body ?? []) {
        const opts = (cmd.options ?? []).map((o) => o.name).join(", ");
        console.log(`  /${cmd.name}(${opts}) — ${cmd.description}`);
      }
      continue;
    }

    const payload = mode === "delete" ? [] : COMMANDS;
    const result = await call("PUT", endpoint, token, payload);
    if (result.status !== 200 && result.status !== 201) {
      // 403 тут майже завжди означає одне: бота запросили без скоупу
      // applications.commands, і його треба перезапросити.
      const hint =
        result.status === 403
          ? " — схоже, бота запрошено без скоупу applications.commands"
          : "";
      console.error(
        `\n${guild.name} (${guild.id}): ПОМИЛКА HTTP ${result.status}${hint}\n  ` +
          JSON.stringify(result.body),
      );
      if (!gated) process.exitCode = 1;
      continue;
    }

    if (mode === "delete") {
      console.log(`\n${guild.name} (${guild.id}): команди прибрано`);
    } else {
      console.log(`\n${guild.name} (${guild.id}): зареєстровано ${result.body.length}`);
      for (const cmd of result.body) {
        console.log(`  /${cmd.name} — ${cmd.description}`);
      }
    }
  }

  if (mode === "register") {
    console.log(
      "\nКоманда доступна одразу. Якщо в Discord її не видно — перезайди в клієнт (Ctrl+R).",
    );
  }
}

run().catch((error) => {
  // У режимі хука падіння не має валити білд: панель працює й без свіжих команд.
  if (process.argv.includes("--if-enabled")) {
    console.warn(`[discord] реєстрація не вдалася, білд це не спиняє: ${error.message}`);
    return;
  }
  console.error(String(error.message ?? error));
  process.exitCode = 1;
});
