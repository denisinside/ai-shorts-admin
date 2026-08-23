/**
 * Реєстр HITL-гейтів: який домен куди веде.
 *
 * Раніше ендпоінт знав рівно один `DIFY_WEBHOOK_URL` — і це працювало доти,
 * доки гейт був один. З появою Дня 1 кнопка мусить сама казати, у який
 * воркфлоу летіти, тому `custom_id` має форму `<домен>:<uuid>:<дія>`, а
 * домен резолвиться тут. Додати День 3 — це рядок у `GATES` і ключ у словнику
 * секретів, а не нова гілка коду в обробнику.
 *
 * Таблиця статична навмисно: `process.env[динамічний ключ]` переживає не
 * кожен збирач, а статичний доступ ще й дозволяє `GET` на ендпоінті
 * надрукувати стан кожного домену — коли кнопка «не працює», причина в 9 з 10
 * випадків саме тут.
 */

export const GATE_ACTIONS = ["approve", "reject", "revise"] as const;
export type GateAction = (typeof GATE_ACTIONS)[number];

/**
 * Маршрут вебхук-тригера Dify — це `/triggers/webhook/<id>` БЕЗ слеша в кінці:
 * зі слешем Flask не матчить правило й віддає загальний 404 «The requested URL
 * was not found», який ніяк не схожий на «вебхук не той». Один зайвий символ у
 * змінній оточення тихо вбив гейт Дня 2 і не був видний у діагностиці, бо та
 * друкувала лише хост. Дешевше нормалізувати, ніж ще раз це шукати.
 */
function normalizeWebhook(raw: string | undefined): string | undefined {
  const clean = raw?.trim().replace(/\/+$/, "");
  return clean || undefined;
}

export type Gate = {
  /** Людською мовою — для повідомлень у Discord і для діагностики. */
  label: string;
  /** URL вебхук-тригера відповідного воркфлоу Dify. */
  webhook: string | undefined;
  /** Білий список дій ДЛЯ ЦЬОГО домену: `day2:<uuid>:revise` не долетить нікуди. */
  actions: readonly GateAction[];
};

export const GATES = {
  day1: {
    label: "Дослідження трендів",
    webhook: normalizeWebhook(process.env.DIFY_WEBHOOK_DAY1),
    actions: ["approve", "reject", "revise"],
  },
  // DIFY_WEBHOOK_URL — легасі-ім'я з часів єдиного гейта. Лишається запасним
  // значенням, щоб викладка цієї зміни не зламала вже налаштований День 2
  // до того, як у Vercel з'явиться DIFY_WEBHOOK_DAY2.
  day2: {
    label: "План статті",
    webhook: normalizeWebhook(process.env.DIFY_WEBHOOK_DAY2 ?? process.env.DIFY_WEBHOOK_URL),
    actions: ["approve", "reject"],
  },
  // Гейт статті живе лише в апці optimized: baseline існує, щоб дати цифри
  // «до», і його рядки затверджуються кнопкою в панелі. `revise` тут немає
  // навмисно — для статті «правки» означають повний перезапуск, а це окрема
  // гілка з власним revision_of, як у Дні 1.
  day3: {
    label: "Стаття",
    webhook: normalizeWebhook(process.env.DIFY_WEBHOOK_DAY3),
    actions: ["approve", "reject"],
  },
} as const satisfies Record<string, Gate>;

export type GateDomain = keyof typeof GATES;

export const GATE_DOMAINS = Object.keys(GATES) as GateDomain[];

/**
 * `<домен>:<uuid>:<дія>` — усе, що влазить у ліміт `custom_id` (100 символів)
 * і при цьому не є даними: вебхук-тригер Dify не має автентифікації, тому в
 * кнопці їдуть тільки ідентифікатори, а зміст читається з бази.
 */
const CUSTOM_ID_RE =
  /^([a-z0-9]{1,12}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([a-z_]{1,20})$/i;

export type GateTarget = {
  domain: GateDomain;
  recordId: string;
  action: GateAction;
  gate: Gate;
};

function isDomain(value: string): value is GateDomain {
  return Object.prototype.hasOwnProperty.call(GATES, value);
}

/**
 * Розбирає `custom_id` кнопки або модалки. `null` означає «не наша кнопка» —
 * невідомий домен, невідома дія або дія, не дозволена цьому домену.
 * Валідність перевіряється ТУТ, щоб у Dify не полетів запит, який воркфлоу
 * все одно відкине, але вже витративши ран.
 */
export function parseCustomId(customId: string): GateTarget | null {
  const match = CUSTOM_ID_RE.exec(customId);
  if (!match) return null;

  const domain = match[1].toLowerCase();
  const action = match[3].toLowerCase();
  if (!isDomain(domain)) return null;

  const gate: Gate = GATES[domain];
  if (!(GATE_ACTIONS as readonly string[]).includes(action)) return null;
  if (!gate.actions.includes(action as GateAction)) return null;

  return {
    domain,
    recordId: match[2].toLowerCase(),
    action: action as GateAction,
    gate,
  };
}

export function customId(
  domain: GateDomain,
  recordId: string,
  action: GateAction,
): string {
  return `${domain}:${recordId}:${action}`;
}

const ACTION_LABELS: Record<GateAction, string> = {
  approve: "Затвердити",
  reject: "Відхилити",
  revise: "Правки",
};

/** Стиль кнопки Discord: 3 — зелена, 4 — червона, 2 — сіра. */
const ACTION_STYLES: Record<GateAction, number> = {
  approve: 3,
  reject: 4,
  revise: 2,
};

const ACTION_VERBS: Record<GateAction, string> = {
  approve: "затвердження",
  reject: "відхилення",
  revise: "правки",
};

export function actionVerb(action: GateAction): string {
  return ACTION_VERBS[action];
}

/**
 * Кнопки домену — рівно ті, що дозволені йому в `GATES`. Використовується,
 * щоб ПОВЕРНУТИ кнопки, коли передати рішення не вдалося: інакше картка
 * лишиться мертвою й повторити клік буде нічим.
 */
export function decisionButtons(domain: GateDomain, recordId: string) {
  return [
    {
      type: 1,
      components: GATES[domain].actions.map((action) => ({
        type: 2,
        style: ACTION_STYLES[action],
        label: ACTION_LABELS[action],
        custom_id: customId(domain, recordId, action),
      })),
    },
  ];
}

/** Поле модалки правок. Ім'я читає обробник сабміту — тримати синхронно. */
export const REVISE_INPUT_ID = "note";

/**
 * Модалка «що змінити». Discord дає на неї 5 хвилин і не вимагає від нас
 * нічого до сабміту, тому кнопки картки лишаються живими: якщо людина закриє
 * модалку, їй є куди повернутися.
 */
export function reviseModal(domain: GateDomain, recordId: string) {
  return {
    type: 9,
    data: {
      custom_id: customId(domain, recordId, "revise"),
      title: `Правки · ${GATES[domain].label}`.slice(0, 45),
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: REVISE_INPUT_ID,
              style: 2, // paragraph
              label: "Що змінити?",
              placeholder:
                "Напр.: більше про ринок ЄС, прибрати теми про no-code, 3 теми замість 5",
              min_length: 3,
              max_length: 1000,
              required: true,
            },
          ],
        },
      ],
    },
  };
}

/** Дістає текст із сабміту модалки, не покладаючись на порядок компонентів. */
export function reviseNote(components: unknown): string {
  if (!Array.isArray(components)) return "";
  for (const row of components) {
    const inner = (row as { components?: unknown[] })?.components;
    if (!Array.isArray(inner)) continue;
    for (const field of inner) {
      const item = field as { custom_id?: string; value?: unknown };
      if (item?.custom_id === REVISE_INPUT_ID && typeof item.value === "string") {
        return item.value.trim().slice(0, 1000);
      }
    }
  }
  return "";
}

/**
 * Що видно застосунку по кожному домену. Без значень — лише наявність і хост,
 * щоб не зливати URL вебхуків у браузер.
 */
/**
 * Сирі значення зі змінних оточення — щоб діагностика показала САМЕ те, що
 * задано, а не те, що лишилося після нормалізації. Статичний доступ тут з тієї
 * ж причини, що й у `GATES`.
 */
const RAW_WEBHOOKS: Record<GateDomain, string | undefined> = {
  day1: process.env.DIFY_WEBHOOK_DAY1,
  day2: process.env.DIFY_WEBHOOK_DAY2 ?? process.env.DIFY_WEBHOOK_URL,
  day3: process.env.DIFY_WEBHOOK_DAY3,
};

/**
 * Що не так зі значенням, крім його відсутності. Сам URL сюди не потрапляє
 * НІКОЛИ: вебхук-тригер Dify не має автентифікації, тож його адреса — це і є
 * ключ. Але «слеш у кінці» або «пробіл» назвати можна й треба — без цього
 * діагностика показувала правильний хост у обох випадках, і зайвий символ
 * шукався годину.
 */
function webhookQuirks(raw: string | undefined): string[] {
  if (!raw) return [];
  const quirks: string[] = [];
  if (raw !== raw.trim()) quirks.push("пробіли на краях");
  const trimmed = raw.trim();
  if (/\/$/.test(trimmed)) quirks.push("слеш у кінці — Dify віддасть 404");
  if (/\s/.test(trimmed)) quirks.push("пробіл усередині");
  if (/^["']|["']$/.test(trimmed)) quirks.push("лапки навколо значення");
  return quirks;
}

export function gateDiagnostics() {
  return GATE_DOMAINS.map((domain) => {
    const gate: Gate = GATES[domain];
    let host = "";
    try {
      host = gate.webhook ? new URL(gate.webhook).host : "";
    } catch {
      host = "НЕКОРЕКТНИЙ URL";
    }
    const quirks = webhookQuirks(RAW_WEBHOOKS[domain]);
    return {
      domain,
      label: gate.label,
      actions: gate.actions,
      webhook: {
        present: Boolean(gate.webhook),
        host,
        // Довжина ідентифікатора, а не сам ідентифікатор: у Dify він завжди
        // 24 символи, тож обрізане чи склеєне значення видно одразу.
        id_length: gate.webhook ? (gate.webhook.split("/").pop() ?? "").length : 0,
        quirks,
      },
    };
  });
}

export function gateProblems(): string[] {
  const problems: string[] = [];
  for (const domain of GATE_DOMAINS) {
    const gate: Gate = GATES[domain];
    if (!gate.webhook) {
      problems.push(
        `вебхук домену ${domain} (${gate.label}) не заданий — рішення нікуди передавати`,
      );
      continue;
    }
    if (!/^https?:\/\//.test(gate.webhook)) {
      problems.push(`вебхук домену ${domain} має починатися з https://`);
    }
    for (const quirk of webhookQuirks(RAW_WEBHOOKS[domain])) {
      problems.push(`вебхук домену ${domain}: ${quirk}`);
    }
  }
  return problems;
}
