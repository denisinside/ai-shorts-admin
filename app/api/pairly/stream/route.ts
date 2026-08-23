import { NextResponse } from "next/server";

import { envFailure, envProblems, isUserId, isUuid, jsonError } from "../_http";
import {
  loadAgents,
  loadConversation,
  loadMessages,
  loadOpenConversation,
  loadQueue,
  loadUsers,
} from "../_db";

/**
 * Один ендпоінт читання на всі три сторінки `/support`.
 *
 * ЧОМУ ОПИТУВАННЯ, А НЕ REALTIME. Realtime Supabase вимагає publishable-ключа
 * в браузері й RLS-політики на читання — тобто рівно того, від чого ми
 * відмовилися в §2.2 архітектури. Ціна — секунда затримки; виграш —
 * транскрипти підтримки не читаються публічним ключем. Клієнт тикає раз на
 * 3 секунди, і на демо з двох-трьох чатів це дешевше за окремий канал.
 *
 * ЧОМУ ОДИН РОУТ НА ЧОТИРИ ВИБІРКИ. Усі вони — те саме читання під
 * service-role, і різні шляхи означали б чотири копії перевірки оточення й
 * чотири місця, де правило «service-role лише в `app/api/pairly/**`» треба
 * тримати в голові. Форма відповіді при цьому різна за параметром, а не
 * об'єднана в один об'єкт: стіл сапорта не має тягнути 32 акаунти на кожен тик.
 *
 * Довідники (`users`, `agents`) читаються тут, а не серверним компонентом
 * сторінки, з тієї самої причини: `pairly_users` під RLS без політик, а
 * `lib/supabase-admin.ts` за межі цієї теки не виходить.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const problems = envProblems();
  if (problems.length > 0) return envFailure(problems);

  const params = new URL(request.url).searchParams;

  try {
    if (params.get("users")) {
      return NextResponse.json({ users: await loadUsers() });
    }
    if (params.get("agents")) {
      return NextResponse.json({ agents: await loadAgents() });
    }
    if (params.get("desk")) {
      return NextResponse.json({ queue: await loadQueue() });
    }

    const conversationId = params.get("conversationId")?.trim() ?? "";
    if (conversationId) {
      if (!isUuid(conversationId)) return jsonError("conversationId має бути uuid", 400);
      const conversation = await loadConversation(conversationId);
      if (!conversation) return jsonError("розмову не знайдено", 404);
      return NextResponse.json({
        conversation,
        messages: await loadMessages(conversationId),
      });
    }

    // Вхід користувача в чат: розмови в URL немає, бо людина приходить із
    // вибору роли. Продовжуємо останню відкриту, а не починаємо нову —
    // інакше кожне перезавантаження сторінки губило б контекст, на якому
    // тримається правило повтору.
    const userId = params.get("userId")?.trim() ?? "";
    if (userId) {
      if (!isUserId(userId)) return jsonError("userId має бути у форматі U001", 400);
      const conversation = await loadOpenConversation(userId);
      // Рядок акаунта їде тією ж відповіддю. Чат показує план і канал покупки в
      // шапці, і окремий запит по них означав би другий похід у базу на кожне
      // відкриття сторінки — при тому, що `pairly_users` під RLS без політик і
      // серверний компонент прочитати їх однаково не може.
      const users = await loadUsers();
      return NextResponse.json({
        user: users.find((row) => row.userId === userId) ?? null,
        conversation,
        messages: conversation ? await loadMessages(conversation.id) : [],
      });
    }

    return jsonError("потрібен один із параметрів: conversationId, userId, desk, users, agents", 400);
  } catch (error) {
    console.error("[pairly] stream", error);
    return jsonError("не вдалося прочитати розмови", 500);
  }
}
