"use client";

import { useEffect, useState } from "react";

import type { PairlyAgentOption, PairlyUserOption } from "@/lib/pairly";

/**
 * Вхід у симулятор: хто ти й у якій ролі.
 *
 * Авторизації тут немає й не передбачено — це демо на синтетичних акаунтах із
 * `docs/task4/04_Pairly_Test_Dataset_UA.xlsx`. Вибір акаунта не косметика:
 * маршрутизація відміни визначається `billing_platform`, тож саме тут людина
 * обирає, який випадок кейсу показати. Тому в списку одразу видно план,
 * канал покупки й статус — інакше довелося б угадувати, який із 32 акаунтів
 * дає потрібний сценарій.
 */
export function RoleEntry() {
  const [users, setUsers] = useState<PairlyUserOption[]>([]);
  const [agents, setAgents] = useState<PairlyAgentOption[]>([]);
  const [userId, setUserId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;

    /** Довідник і перелік проблем оточення приходять однією відповіддю. */
    async function read<T>(key: "users" | "agents"): Promise<T[]> {
      const response = await fetch(`/api/pairly/stream?${key}=1`, { cache: "no-store" });
      const data = (await response.json()) as Record<string, unknown>;
      const problems = data.problems;
      // Назва змінної, якої не вистачає, коштує години — тому показуємо список,
      // а не «підтримка не налаштована».
      if (Array.isArray(problems) && problems.length > 0 && alive) {
        setProblems(problems.map(String));
      }
      const rows = data[key];
      return Array.isArray(rows) ? (rows as T[]) : [];
    }

    void (async () => {
      try {
        const [userRows, agentRows] = await Promise.all([
          read<PairlyUserOption>("users"),
          read<PairlyAgentOption>("agents"),
        ]);
        if (!alive) return;
        setUsers(userRows);
        setAgents(agentRows);
        setUserId((current) => current || userRows[0]?.userId || "");
        setAgentId((current) => current || agentRows[0]?.agentId || "");
      } catch {
        if (alive) setProblems(["сервер не відповідає"]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="stage">
      <div className="chooser">
        <h1>Pairly Support</h1>
        <p>
          Симулятор першої лінії підтримки. Користувач пише — відповідає RAG-агент у
          Dify: він знаходить статтю в базі знань, читає дані акаунта й передає складні
          випадки живому агенту. Тех. сапорт бачить ту саму розмову, може відповісти сам
          і взяти вижимку діалогу.
        </p>

        {problems.length > 0 ? (
          <p className="hint">
            <strong>Демо не запуститься:</strong> {problems.join("; ")}. Заповніть ключі в{" "}
            <code>config/secrets.local.env</code> і запустіть{" "}
            <code>python config/apply_secrets.py</code>.
          </p>
        ) : null}

        <div className="roles">
          <section className="role">
            <h2>
              <span>🌷</span> Я користувач
            </h2>
            <p>
              Пишу в підтримку від імені синтетичного акаунта з датасету. Дві постійні
              кнопки — покликати людину й завершити діалог — доступні будь-коли.
            </p>
            <label>
              Акаунт
              <select value={userId} onChange={(event) => setUserId(event.target.value)}>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.userId} · {user.firstName} · {user.plan ?? "Free"} ·{" "}
                    {user.billingPlatform ?? "без білінгу"} · {user.subscriptionStatus}
                  </option>
                ))}
              </select>
            </label>
            <a className="go" href={`/support/chat?user=${userId}`} aria-disabled={!userId}>
              Відкрити чат
            </a>
          </section>

          <section className="role">
            <h2>
              <span>👩‍💼</span> Я тех. сапорт
            </h2>
            <p>
              Бачу чергу звернень із поміткою причини передачі, читаю той самий діалог,
              відповідаю від свого імені й тисну «Самарайз», щоб не читати все підряд.
            </p>
            <label>
              Хто на зміні
              <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                {agents.length === 0 ? (
                  <option value="">агентів у базі немає</option>
                ) : (
                  agents.map((agent) => (
                    <option key={agent.agentId} value={agent.agentId}>
                      {agent.name} · {agent.agentId}
                    </option>
                  ))
                )}
              </select>
            </label>
            <a
              className="go ghost"
              href={`/support/desk?agent=${agentId}`}
              aria-disabled={!agentId}
            >
              Відкрити стіл
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
