"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PairlyConversation, PairlyMessage, PairlyUserOption } from "@/lib/pairly";
import {
  EMOJI,
  MODE_DOT,
  MODE_LABEL,
  PAIRLY_POLL_MS,
  STARTERS,
  STICKERS,
  bubbleTime,
  stickerStyle,
} from "@/lib/pairly-ui";

import { MessageList } from "./MessageList";

/**
 * Чат користувача. Верстка — макет `docs/Pairly_support_bot.html` один в один:
 * рамка телефона, шпалери, картка привітання, дві постійні кнопки, чипси
 * підказок, панель емодзі й стікерів.
 *
 * ЧИМ ЦЕ ВІДРІЗНЯЄТЬСЯ ВІД МАКЕТА. У макеті чат був деревом рішень: кнопка
 * «Скасувати підписку» вела на зашиту гілку із заздалегідь написаною
 * відповіддю. Тут жодної зашитої відповіді немає — кожне повідомлення йде в
 * чатфлоу `pairly-support-agent`, і те, що приходить назад, малюється як є.
 * Тому й підказки перетворилися з гілок дерева на швидкий набір: кнопка
 * НАДСИЛАЄ текст, а не показує заготовку.
 *
 * Два елементи макета лишилися дією, а не текстом, і теж не ходять у Dify:
 * «Покликати людину» і «Завершити діалог». Явне прохання людини — не судження,
 * а факт, і його місце в коді (`/api/pairly/request-human`), а не в промпті.
 */
export function UserChat({ userId }: { userId: string }) {
  const [user, setUser] = useState<PairlyUserOption | null>(null);
  const [conversation, setConversation] = useState<PairlyConversation | null>(null);
  const [messages, setMessages] = useState<PairlyMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [panel, setPanel] = useState<"" | "emoji" | "stickers">("");
  const [error, setError] = useState("");

  const chatRef = useRef<HTMLElement>(null);
  const closed = conversation?.status === "closed";
  const mode = conversation?.mode ?? "bot";

  // Початковий стан теж забирає клієнт, а не серверний компонент: розмови й
  // акаунти лежать під RLS без політик, і `lib/supabase-admin.ts` не виходить
  // за межі `app/api/pairly/**`. Продовжуємо ОСТАННЮ ВІДКРИТУ розмову, а не
  // починаємо нову — інакше перезавантаження сторінки губило б контекст, на
  // якому тримається правило повтору.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`/api/pairly/stream?userId=${userId}`, {
          cache: "no-store",
        });
        if (!response.ok || !alive) return;
        const data = (await response.json()) as {
          user: PairlyUserOption | null;
          conversation: PairlyConversation | null;
          messages: PairlyMessage[];
        };
        if (!alive) return;
        setUser(data.user);
        setConversation(data.conversation);
        setMessages(data.messages);
      } catch {
        if (alive) setError("не дістаюся до сервера — перезавантажте сторінку");
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      const node = chatRef.current;
      if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(scrollDown, [messages.length, pending, panel, scrollDown]);

  // Опитування: поки чекає на людину або людина вже відповідає, нові ходи
  // приходять не від нас. Коли говорить бот, тикати нема сенсу — відповідь
  // приходить прямо у відповідь на POST.
  useEffect(() => {
    if (!conversation || closed || mode === "bot") return;
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch(
          `/api/pairly/stream?conversationId=${conversation.id}`,
          { cache: "no-store" },
        );
        if (!response.ok || !alive) return;
        const data = (await response.json()) as {
          conversation: PairlyConversation;
          messages: PairlyMessage[];
        };
        if (!alive) return;
        setConversation(data.conversation);
        setMessages(data.messages);
      } catch {
        // Тиха невдача: наступний тик спробує знову. Показувати помилку
        // опитування людині, у якої чат працює, — шум.
      }
    };
    const timer = setInterval(tick, PAIRLY_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [conversation, closed, mode]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || pending || closed) return;
    setPanel("");
    setError("");
    setDraft("");
    setPending(true);
    try {
      const response = await fetch("/api/pairly/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          conversationId: conversation?.id ?? "",
          text: value,
        }),
      });
      const data = (await response.json()) as {
        conversationId?: string;
        messages?: PairlyMessage[];
        error?: string;
      };
      if (data.messages) setMessages(data.messages);
      if (data.error) setError(data.error);
      if (data.conversationId && data.conversationId !== conversation?.id) {
        await refresh(data.conversationId);
      } else if (conversation) {
        await refresh(conversation.id);
      }
    } catch {
      setError("не дістаюся до сервера, спробуйте ще раз");
    } finally {
      setPending(false);
    }
  }

  async function refresh(id: string) {
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
  }

  async function action(path: string) {
    if (!conversation || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/pairly/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          closedBy: userId,
        }),
      });
      const data = (await response.json()) as {
        conversation?: PairlyConversation;
        messages?: PairlyMessage[];
        error?: string;
      };
      if (data.conversation) setConversation(data.conversation);
      if (data.messages) setMessages(data.messages);
      if (data.error) setError(data.error);
    } catch {
      setError("не дістаюся до сервера, спробуйте ще раз");
    } finally {
      setPending(false);
    }
  }

  /**
   * Стікер надсилає свій ПІДПИС як звичайне повідомлення.
   *
   * Картинка при цьому не зберігається, і це свідомо: у `pairly_messages`
   * лежить текст ходу, а не вкладення, і намальований локально стікер зник би
   * після перезавантаження — тобто показував би те, чого в розмові немає.
   * Підпис же доїжджає і в базу, і в транскрипт для живого агента.
   */
  function sendSticker(index: number) {
    setPanel("");
    void send(STICKERS[index].caption);
  }

  const started = messages.length > 0;
  const greeting = ready && !started;

  return (
    <div className="stage">
      <section className="phone" aria-label="Чат підтримки Pairly">
        <div className="demo">
          <span className={closed ? "dot off" : MODE_DOT[mode]} />
          {closed
            ? "Розмову завершено"
            : `Демо · акаунт ${userId}${user ? ` · ${user.plan ?? "Free"} · ${user.billingPlatform ?? "без білінгу"}` : ""}`}
        </div>

        <header>
          <a className="icon" href="/support" aria-label="Змінити роль" title="Змінити роль">
            ‹
          </a>
          <div className={mode === "human" ? "avatar human" : "avatar"}>
            {mode === "human" ? "M" : "P"}
          </div>
          <div className="title">
            <strong>Pairly Support</strong>
            <span>{closed ? "розмову завершено" : MODE_LABEL[mode]}</span>
          </div>
          <button className="icon" type="button" disabled aria-label="Дзвінок" title="У демо недоступно">
            ☎
          </button>
        </header>

        <div className="persistent">
          <button
            className="persist"
            type="button"
            onClick={() => action("request-human")}
            disabled={!conversation || closed || pending || mode !== "bot"}
          >
            <span className="picon">👩‍💼</span>
            <span className="pcopy">
              <strong>Покликати людину</strong>
              <small>
                {mode === "bot" ? "У будь-який момент" : "Уже передано менеджеру"}
              </small>
            </span>
          </button>
          <button
            className="persist end"
            type="button"
            onClick={() => action("close")}
            disabled={!conversation || closed || pending}
          >
            <span className="picon">🌷</span>
            <span className="pcopy">
              <strong>Завершити діалог</strong>
              <small>{closed ? "Завершено" : "Закрити звернення"}</small>
            </span>
          </button>
        </div>

        <main className="chat" ref={chatRef} aria-live="polite">
          <div className="date">Сьогодні</div>
          <div className="privacy">
            🔒 Не надсилайте пароль, коди підтвердження або повні дані картки.
          </div>

          <GreetingCard />

          {greeting ? (
            <div className="row">
              <div className="mini">P</div>
              <div className="bubble">
                Добрий день! Я поруч і готова допомогти з підпискою, акаунтом і функціями
                Pairly. Напишіть питання своїми словами — або оберіть підказку нижче.
                <time>{bubbleTime(new Date().toISOString())}</time>
              </div>
            </div>
          ) : null}

          <MessageList messages={messages} pending={pending} />

          {closed ? <GreetingCard end /> : null}

          {error ? (
            <div className="row">
              <div className="mini system">·</div>
              <div className="bubble failed">
                <div className="status">
                  <b>!</b>
                  Повідомлення не дійшло
                </div>
                {error}
                <time>{bubbleTime(new Date().toISOString())}</time>
              </div>
            </div>
          ) : null}

          {!closed && !pending ? (
            <div className="suggestions">
              {(started ? STARTERS.slice(0, 3) : STARTERS).map((item) => (
                <button
                  key={item.text}
                  type="button"
                  className={item.primary && !started ? "primary" : ""}
                  onClick={() => send(item.text)}
                >
                  <span>{item.icon}</span>
                  {item.text}
                </button>
              ))}
            </div>
          ) : null}

          {panel === "emoji" ? (
            <div className="panel emoji-panel">
              {EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setDraft((value) => (value ? `${value} ${emoji}` : emoji))}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}

          {panel === "stickers" ? (
            <div className="panel">
              <div className="panelhead">
                <strong>Стікери</strong>
                <span>Надсилає підпис як повідомлення</span>
              </div>
              <div className="sticker-grid">
                {STICKERS.map((sticker, index) => (
                  <button
                    key={sticker.caption}
                    type="button"
                    className="stickbtn"
                    onClick={() => sendSticker(index)}
                  >
                    <span className="art" style={stickerStyle(sticker)} />
                    <strong>{sticker.caption}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </main>

        <footer>
          {closed ? (
            <div className="closed">
              Звернення закрито
              {conversation?.closedBy ? ` (${conversation.closedBy})` : ""}.{" "}
              <a href="/support">Обрати акаунт</a>
            </div>
          ) : (
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft);
              }}
            >
              <button
                className={panel === "emoji" ? "cbtn active" : "cbtn"}
                type="button"
                aria-label="Емодзі"
                onClick={() => setPanel((value) => (value === "emoji" ? "" : "emoji"))}
              >
                ☺
              </button>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Напишіть повідомлення…"
                aria-label="Повідомлення"
                maxLength={1000}
                disabled={pending}
              />
              <button
                className={panel === "stickers" ? "cbtn active" : "cbtn"}
                type="button"
                aria-label="Стікери"
                onClick={() => setPanel((value) => (value === "stickers" ? "" : "stickers"))}
              >
                ▢
              </button>
              <button className="send" type="submit" disabled={pending || !draft.trim()} aria-label="Надіслати">
                ➤
              </button>
            </form>
          )}
        </footer>
      </section>
    </div>
  );
}

function GreetingCard({ end = false }: { end?: boolean }) {
  return (
    <div className="row">
      <div className={end ? "card endcard" : "card"}>
        <div className="cardcopy">
          <strong>{end ? "Гарного дня!" : "Добрий день!"}</strong>
          <span>{end ? "Дякую, що звернулися до Pairly" : "Pairly Support 🌷"}</span>
        </div>
        <time>{bubbleTime(new Date().toISOString())}</time>
      </div>
    </div>
  );
}
