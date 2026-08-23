"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  PairlyAgentOption,
  PairlyConversation,
  PairlyMessage,
  PairlyQueueItem,
} from "@/lib/pairly";
import {
  MODE_TAG,
  PAIRLY_POLL_MS,
  reasonLabel,
  shortTime,
} from "@/lib/pairly-ui";

import { MessageList } from "./MessageList";

/**
 * Стіл тех. сапорта: черга розмов і той самий діалог, що бачить користувач.
 *
 * Макет `docs/Pairly_support_bot.html` описував лише бік користувача, тому цей
 * екран зроблений у ЙОГО мові — та сама палітра, ті самі бульбашки, ті самі
 * шпалери під стрічкою, — але в двох панелях: у телефонну рамку черга не влазить,
 * а живому агенту потрібні обидві половини одночасно.
 *
 * ЧОМУ ДІАЛОГ ТУТ РЕНДЕРИТЬ ТОЙ САМИЙ КОМПОНЕНТ. Друга верстка означала б, що
 * сапорт читає інший діалог, ніж людина, — і найдорожча помилка підтримки
 * («ви ж мені писали інше») стала б технічно можливою.
 *
 * Відповіді сапорта через Dify НЕ ходять: людина пише — панель пише рядок з
 * `role='agent'`. Перехід «бот ↔ людина» це `pairly_conversations.mode`.
 */
export function AgentDesk({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<PairlyAgentOption | null>(null);
  const [queue, setQueue] = useState<PairlyQueueItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<PairlyConversation | null>(null);
  const [messages, setMessages] = useState<PairlyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);
  const closed = conversation?.status === "closed";

  // Ім'я агента читається один раз: воно не змінюється, а черга — щотри секунди.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch("/api/pairly/stream?agents=1", { cache: "no-store" });
        if (!response.ok || !alive) return;
        const data = (await response.json()) as { agents: PairlyAgentOption[] };
        if (!alive) return;
        setAgent(data.agents.find((row) => row.agentId === agentId) ?? null);
      } catch {
        // Підпис у шапці — не причина ламати стіл.
      }
    })();
    return () => {
      alive = false;
    };
  }, [agentId]);

  const loadQueue = useCallback(async () => {
    try {
      const response = await fetch("/api/pairly/stream?desk=1", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { queue: PairlyQueueItem[] };
      setQueue(data.queue);
      // Перше звернення відкриваємо самі: стіл із порожньою правою половиною
      // виглядає як зламаний, хоч черга й приїхала.
      setActiveId((current) => current ?? data.queue[0]?.id ?? null);
    } catch {
      // Тиха невдача: наступний тик спробує знову.
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/pairly/stream?conversationId=${id}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        conversation: PairlyConversation;
        messages: PairlyMessage[];
      };
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch {
      // Те саме: тик повторить.
    }
  }, []);

  // Один інтервал на обидві вибірки. Перший тик — через мікрозадачу, бо
  // синхронний setState у тілі ефекту заборонений правилом React Compiler
  // (`react-hooks/set-state-in-effect`).
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      void loadQueue();
      if (activeId) void loadThread(activeId);
    };
    void Promise.resolve().then(tick);
    const timer = setInterval(tick, PAIRLY_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [activeId, loadQueue, loadThread]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const node = chatRef.current;
      if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    });
  }, [messages.length]);

  function pick(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    setSummary("");
    setError("");
    setMessages([]);
    setConversation(null);
  }

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/pairly/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        conversation?: PairlyConversation;
        messages?: PairlyMessage[];
        summaryMd?: string;
        error?: string;
      };
      if (data.conversation) setConversation(data.conversation);
      if (data.messages) setMessages(data.messages);
      if (data.summaryMd) setSummary(data.summaryMd);
      if (data.error) setError(data.error);
      await loadQueue();
    } catch {
      setError("не дістаюся до сервера, спробуйте ще раз");
    } finally {
      setBusy(false);
    }
  }

  const waiting = queue.filter((item) => item.mode === "pending_human").length;

  return (
    <div className="stage">
      <div className="desk">
        <section className="pane" aria-label="Черга звернень">
          <div className="panehead">
            <strong>Черга звернень</strong>
            <span className="count" title="Чекають на людину">
              {waiting}
            </span>
          </div>
          <div className="queue">
            {queue.length === 0 ? (
              <p className="empty">
                Відкритих звернень немає.
                <br />
                Напишіть боту з роли користувача — і розмова з’явиться тут.
              </p>
            ) : (
              queue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === activeId ? "qitem active" : "qitem"}
                  onClick={() => pick(item.id)}
                >
                  <div className="qtop">
                    <strong>{item.userId}</strong>
                    <span className={`tag ${item.status === "closed" ? "closed" : item.mode}`}>
                      {item.status === "closed" ? "Закрито" : MODE_TAG[item.mode]}
                    </span>
                    <small>{shortTime(item.lastMessageAt ?? item.createdAt)}</small>
                  </div>
                  {item.escalationReason ? (
                    <span className="tag reason">↗ {reasonLabel(item.escalationReason)}</span>
                  ) : null}
                  <p className="qtext">{item.lastText || "—"}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="pane" aria-label="Розмова">
          <div className="panehead">
            <div className="avatar human" style={{ width: 38, height: 38, fontSize: 17 }}>
              M
            </div>
            <strong>
              {conversation ? `Звернення ${conversation.userId}` : "Оберіть звернення"}
            </strong>
            <span className="who">{agent?.name ?? agentId}</span>
          </div>

          {conversation ? (
            <div className="deskchat">
              <div className="deskbar">
                <span className={`tag ${closed ? "closed" : conversation.mode}`}>
                  {closed ? "Закрито" : MODE_TAG[conversation.mode]}
                </span>
                {conversation.escalationReason ? (
                  <span className="tag reason">↗ {reasonLabel(conversation.escalationReason)}</span>
                ) : null}
                <span className="grow" />
                <button
                  className="act"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    post("summary", { conversationId: conversation.id, agentId })
                  }
                >
                  {busy ? "…" : "Самарайз"}
                </button>
                <button
                  className="act warn"
                  type="button"
                  disabled={busy || closed}
                  onClick={() =>
                    post("close", { conversationId: conversation.id, closedBy: agentId })
                  }
                >
                  Завершити чат
                </button>
              </div>

              {summary ? <Summary markdown={summary} /> : null}

              <main className="chat" ref={chatRef} aria-live="polite">
                <div className="date">
                  Звернення від {shortTime(conversation.createdAt)}
                </div>
                <MessageList messages={messages} showDeviation />
                {error ? (
                  <div className="row">
                    <div className="mini system">·</div>
                    <div className="bubble failed">{error}</div>
                  </div>
                ) : null}
              </main>

              {closed ? (
                <div className="deskcompose">
                  <div className="closed" style={{ flex: 1 }}>
                    Звернення закрито
                    {conversation.closedBy ? ` (${conversation.closedBy})` : ""}
                  </div>
                </div>
              ) : (
                <form
                  className="deskcompose"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = draft.trim();
                    if (!text || busy) return;
                    setDraft("");
                    void post("agent-reply", {
                      conversationId: conversation.id,
                      agentId,
                      text,
                    });
                  }}
                >
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Відповідь користувачу…"
                    aria-label="Відповідь користувачу"
                    maxLength={2000}
                    disabled={busy}
                  />
                  <button className="act solid" type="submit" disabled={busy || !draft.trim()}>
                    Надіслати
                  </button>
                </form>
              )}
            </div>
          ) : (
            <p className="empty">
              Оберіть звернення в черзі, щоб побачити діалог, вижимку й відповісти.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Вижимка приходить готовим markdown із воркфлоу `pairly-handoff-summary`.
 *
 * Розбираємо тут рівно те, що воркфлоу й генерує: `## Заголовок`, `- пункт`,
 * `**жирний:**` і порожні рядки. Повний парсер markdown тут був би зайвим —
 * джерело одне, формат наш, і будь-що інше в ньому означало б, що воркфлоу
 * змінився, а не що користувач написав щось хитре.
 */
function Summary({ markdown }: { markdown: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flush();
      blocks.push(<h2 key={`h-${blocks.length}`}>{line.slice(3)}</h2>);
    } else if (line.startsWith("- ")) {
      list.push(line.slice(2));
    } else if (line.startsWith("_") && line.endsWith("_") && line.length > 2) {
      flush();
      blocks.push(<p key={`e-${blocks.length}`}><em>{line.slice(1, -1)}</em></p>);
    } else if (line.trim()) {
      flush();
      blocks.push(<p key={`p-${blocks.length}`}>{inline(line)}</p>);
    }
  }
  flush();

  return <div className="summary">{blocks}</div>;
}

/** Лише `**жирний**` — рівно те, що ставить воркфлоу у таблиці фактів. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
  );
}
