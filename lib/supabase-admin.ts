import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ПЕРШИЙ service-role клієнт у панелі. До цього ключ service-role жив тільки в
 * env-змінних воркфлоу Dify, і це був інваріант проєкту. Тут він порушений
 * свідомо — ось чому.
 *
 * Таблиці розмов підтримки (`pairly_conversations`, `pairly_messages`,
 * `pairly_users`, `pairly_handoffs`) мають **увімкнену RLS і ні однієї
 * політики**: publishable-ключем їх не видно взагалі — ні на читання, ні на
 * запис. Це не забутий крок, це і є захист.
 *
 * Альтернатива, яку ми відкинули, — політика `for select/insert to anon`, як у
 * `slang_terms`. Для словника сленгу вона правильна: словник публічний, і
 * найгірше, що дає публічний ключ, — прочитати те, що й так на сторінці. Тут
 * ціна інша: тим самим ключем, який лежить у браузері, можна було б прочитати
 * КОЖЕН транскрипт підтримки й написати повідомлення від імені будь-якого
 * користувача. Транскрипти підтримки — гірше місце для цього, ніж словник.
 *
 * Правило, яке робить це безпечним, одне й механічне:
 *
 *   **цей модуль не імпортується нізвідки, крім `app/api/pairly/**`.**
 *
 * Ні з компонентів, ні зі сторінок, ні з server actions. `import "server-only"`
 * першим рядком робить порушення помилкою БІЛДУ, а не сюрпризом у рантаймі:
 * будь-яка спроба затягнути цей файл у клієнтський бандл валить збірку з
 * явним повідомленням. Без цього рядка ключ поїхав би в браузер тихо, і
 * помітили б це вже після деплою.
 *
 * Саме через це правило сторінки `/support` читають дані не напряму з бази, а
 * через `/api/pairly/*` — навіть там, де серверний компонент міг би зробити
 * один запит. Зайвий хоп дешевший за виняток у правилі, яке перевіряється
 * механічно.
 */

export type PairlyAdminConfig = {
  url: string;
  /** Наявність і довжина, не значення: діагностику видно в браузері. */
  keyPresent: boolean;
  keyLength: number;
};

export function adminConfig(): PairlyAdminConfig {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return {
    // Той самий URL, що й у publishable-клієнта: різниться лише ключ, а не
    // проєкт. Слеш у кінці зрізаємо — інакше supabase-js склеїв би `//rest/v1`.
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, ""),
    keyPresent: Boolean(key),
    keyLength: key.length,
  };
}

/** Що саме зламано в конфігурації. Порожній масив = все на місці. */
export function adminProblems(): string[] {
  const cfg = adminConfig();
  const problems: string[] = [];
  if (!cfg.url) problems.push("NEXT_PUBLIC_SUPABASE_URL не заданий");
  if (!cfg.keyPresent)
    problems.push("SUPABASE_SERVICE_ROLE_KEY не заданий — таблиці pairly_* недосяжні");
  return problems;
}

/**
 * Клієнт під service-role. Кидає, якщо env немає: тихий клієнт із порожнім
 * ключем відповідав би `401` на кожен запит, і в логах це виглядало б як
 * проблема з RLS, а не як забута змінна оточення.
 *
 * `persistSession: false` — на сервері немає ні браузерного сховища, ні
 * користувача, чию сесію варто зберігати; без цього supabase-js тримав би
 * стан між запитами одного інстансу.
 */
export function createAdminClient(): SupabaseClient {
  const problems = adminProblems();
  if (problems.length > 0) throw new Error(problems.join("; "));

  return createSupabaseClient(
    adminConfig().url,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
