"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  FACET_LABELS,
  matchesFacet,
  type ReaderArticle,
  type ReaderFacet,
} from "@/lib/reader";
import { cn } from "@/lib/ui";
import ArticleWindow from "./ArticleWindow";
import DesktopWindow, {
  WINDOW_META,
  type WindowId,
  type WindowState,
} from "./DesktopWindow";
import Taskbar from "./Taskbar";
import { AboutBody, FeedBody, GlossaryBody } from "./ToolWindows";

/**
 * Робочий стіл «Wait, What?» — інтерактивна частина читалки.
 *
 * Чому один клієнтський компонент, а не дерево серверних: усе тут — один стан
 * (фасет, пошук, збережене, які вікна відкриті, яка стаття читається), і стрічка
 * мусить перефільтровуватися без походу на сервер. Дані приходять уже плоскими
 * (`ReaderArticle`), тому серверна частина лишається запитом до бази.
 *
 * Ярлики й пункти меню з макета навмисно НЕ декоративні: замість «12 items»
 * вони показують справжні лічильники й працюють як фасети стрічки. Намальована
 * цифра на сторінці, під'єднаній до бази, — це просто неправда.
 */

/**
 * Репліка, поки Dify думає. Випадковість — тут, а не в моделі: у пісочниці
 * Dify немає `Math.random`, а сама температура дає варіації тону, але не
 * структури, і за десяток реплік це читається як шаблон.
 */
const THINKING = [
  "ща гляну…",
  "секунду, гортаю словник",
  "о, цікаве. дивлюсь",
  "тримай думку, зараз буде",
  "ммм окей, думаю",
] as const;

/** Максимум пар «питання-відповідь» у вікні. Далі старе прокручується геть:
 *  сама розмова живе в Dify, лог тут — лише те, що видно. */
const CHAT_LIMIT = 8;

type ChatTurn = { role: "user" | "bot"; text: string; kind?: "pending" | "error" };

// По одній на кожну гілку воркфлоу: пояснити слово, розібрати фразу зі
// сленгом, перекласти НА зумерську.
const BOT_PROMPTS = [
  "ЩО ТАКЕ RIZZ",
  "HE HAS NO RIZZ FR FR",
  "ПЕРЕКЛАДИ: ВІН ДУЖЕ ВПЕВНЕНИЙ У СОБІ, ХОЧА ПІДСТАВ НЕМА",
];

/** Фасети в тому порядку, в якому вони стоять у меню топбара. */
const NAV_FACETS: ReaderFacet[] = ["all", "ready", "draft", "demo"];

const TOAST_MS = 2200;

/** Найнижчий шар вікна. Нижче — стрічка (9), вище — топбар (30). */
const WINDOW_Z_BASE = 12;

const INITIAL_WINDOWS: Record<WindowId, WindowState> = {
  welcome: { open: true, max: false, x: 0, y: 0, z: WINDOW_Z_BASE },
  waitbot: { open: true, max: false, x: 0, y: 0, z: WINDOW_Z_BASE + 1 },
  glossary: { open: false, max: false, x: 0, y: 0, z: WINDOW_Z_BASE + 2 },
  feed: { open: false, max: false, x: 0, y: 0, z: WINDOW_Z_BASE + 3 },
  about: { open: false, max: false, x: 0, y: 0, z: WINDOW_Z_BASE + 4 },
};

export default function ReaderDesktop({
  articles,
  initialArticleId,
}: {
  articles: ReaderArticle[];
  /** Стаття з `?article=` — так у читалку веде кнопка «Почитати» в панелі. */
  initialArticleId: string | null;
}) {
  const [facet, setFacet] = useState<ReaderFacet>("all");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(initialArticleId);
  const [hiddenCards, setHiddenCards] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [windows, setWindows] =
    useState<Record<WindowId, WindowState>>(INITIAL_WINDOWS);
  const [toast, setToast] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [botInput, setBotInput] = useState("");
  const [botBusy, setBotBusy] = useState(false);
  // conversation_id носить клієнт, а не сервер: розмова прив'язана до вкладки,
  // і Dify не треба питати про історію окремим запитом, як це робить /aislop.
  const conversationRef = useRef("");
  const userRef = useRef("");
  const logRef = useRef<HTMLDivElement | null>(null);

  // ------------------------------------------------------------------ тост
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // ------------------------------------------------------------------ вікна
  const patchWindow = useCallback(
    (id: WindowId, patch: Partial<WindowState>) => {
      setWindows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    },
    [],
  );

  /**
   * Піднімає вікно над рештою. Шари ПЕРЕНУМЕРОВУЮТЬСЯ, а не інкрементуються:
   * лічильник, що тільки росте, за двадцять кліків переліз би топбар (30) і
   * вікно почало б накривати навігацію.
   */
  const focusWindow = useCallback((id: WindowId) => {
    setWindows((prev) => {
      const below = (Object.keys(prev) as WindowId[])
        .filter((key) => key !== id)
        .sort((a, b) => prev[a].z - prev[b].z);

      const next = { ...prev };
      [...below, id].forEach((key, index) => {
        next[key] = { ...prev[key], z: WINDOW_Z_BASE + index };
      });
      return next;
    });
  }, []);

  const openWindow = useCallback(
    (id: WindowId) => {
      patchWindow(id, { open: true });
      focusWindow(id);
    },
    [focusWindow, patchWindow],
  );

  /** Клік по кнопці в таскбарі: згортає відкрите, відновлює згорнуте. */
  const toggleWindow = useCallback(
    (id: WindowId) => {
      if (windows[id].open) patchWindow(id, { open: false });
      else openWindow(id);
    },
    [openWindow, patchWindow, windows],
  );

  /**
   * Закриття, на відміну від згортання, скидає геометрію: згорнуте вікно
   * повертається туди, де стояло, а закрите — на своє місце на столі.
   */
  const closeWindow = useCallback(
    (id: WindowId) => {
      patchWindow(id, { open: false, max: false, x: 0, y: 0 });
    },
    [patchWindow],
  );

  const closeAllWindows = useCallback(() => {
    setWindows((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(prev) as WindowId[]) {
        next[key] = { ...prev[key], open: false, max: false, x: 0, y: 0 };
      }
      return next;
    });
  }, []);

  // -------------------------------------------------------- URL відкритої
  // Посилання на статтю має бути можливо кинути в чат, тому `?article=` завжди
  // відповідає відкритому вікну. Пишемо через history, а не router: перерендер
  // сервера тут не потрібен — усі дані вже на клієнті.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set("article", openId);
    else url.searchParams.delete("article");
    window.history.replaceState(null, "", url);
  }, [openId]);

  // ----------------------------------------------------------- лічильники
  const counts = useMemo(
    () => ({
      all: articles.length,
      ready: articles.filter((item) => !item.demo && item.approved).length,
      draft: articles.filter((item) => !item.demo && !item.approved).length,
      demo: articles.filter((item) => item.demo).length,
      saved: saved.size,
    }),
    [articles, saved],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (hiddenCards.has(article.id)) return false;
      if (!matchesFacet(article, facet, saved)) return false;
      if (!needle) return true;
      const haystack = [
        article.title,
        article.category,
        ...(article.seo?.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [articles, facet, hiddenCards, query, saved]);

  const openArticle = openId
    ? (articles.find((article) => article.id === openId) ?? null)
    : null;

  // ------------------------------------------------------------- карусель
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [track, setTrack] = useState({
    atStart: true,
    atEnd: true,
    page: 0,
    pages: 1,
  });

  const measure = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    const pages = Math.max(
      1,
      Math.ceil(node.scrollWidth / Math.max(1, node.clientWidth)),
    );
    setTrack({
      // 2px допуску: дробові ширини карток дають scrollLeft на кшталт 0.5
      atStart: node.scrollLeft <= 2,
      atEnd: node.scrollLeft >= max - 2,
      page: max > 0 ? Math.round((node.scrollLeft / max) * (pages - 1)) : 0,
      pages,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Фільтр змінює склад доріжки: скидаємо її на початок, інакше після звуження
  // стрічка лишалася б прокрученою в порожнє місце.
  useEffect(() => {
    trackRef.current?.scrollTo({ left: 0 });
    measure();
  }, [facet, query, visible.length, measure]);

  const scrollByPage = (direction: 1 | -1) => {
    const node = trackRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth, behavior: "smooth" });
  };

  const scrollToPage = (page: number) => {
    const node = trackRef.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    const share = track.pages > 1 ? page / (track.pages - 1) : 0;
    node.scrollTo({ left: max * share, behavior: "smooth" });
  };

  // ---------------------------------------------------------------- дії
  const applyFacet = (next: ReaderFacet) => {
    setFacet(next);
    setQuery("");
    setHiddenCards(new Set());
  };

  const searchFor = (term: string) => {
    setFacet("all");
    setQuery(term);
    setHiddenCards(new Set());
    showToast(`Шукаю «${term}»`);
  };

  const toggleSaved = (id: string) => {
    // Тост — поза апдейтером: React має право викликати його двічі, і тоді
    // повідомлення показалося б двічі за один клік.
    const wasSaved = saved.has(id);
    setSaved((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(id);
      else next.add(id);
      return next;
    });
    showToast(wasSaved ? "Прибрано зі збереженого" : "Збережено на потім");
  };

  /**
   * Питає WaitBot. Уся логіка — матчер словника, два різні пошуки й вибір
   * гілки — живе у воркфлоу Dify; сторінка лише показує репліки, тому нове
   * вміння бота не потребує деплою панелі.
   */
  const askBot = async (message: string) => {
    const text = message.trim();
    if (!text || botBusy) return;

    if (!userRef.current) {
      userRef.current =
        globalThis.crypto?.randomUUID?.() ?? String(Date.now());
    }
    const thinking = THINKING[Math.floor(Math.random() * THINKING.length)];
    setChat((current) =>
      [...current, { role: "user" as const, text },
       { role: "bot" as const, text: thinking, kind: "pending" as const }]
        .slice(-CHAT_LIMIT * 2),
    );
    setBotInput("");
    setBotBusy(true);

    let reply: ChatTurn = {
      role: "bot",
      text: "не дістаюся до себе самого 😵 спробуй ще раз",
      kind: "error",
    };
    try {
      const response = await fetch("/api/waitbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          user: userRef.current,
          conversationId: conversationRef.current,
        }),
      });
      const body = (await response.json()) as {
        answer?: string;
        conversationId?: string;
        error?: string;
      };
      if (response.ok && body.answer) {
        reply = { role: "bot", text: body.answer };
        conversationRef.current = body.conversationId ?? "";
      } else if (body.error) {
        reply = { role: "bot", text: body.error, kind: "error" };
        // Застаріла розмова: наступне питання має початися з чистого аркуша,
        // інакше Dify відповідатиме тією самою помилкою вічно.
        if (response.status === 502) conversationRef.current = "";
      }
    } catch {
      // reply уже містить текст помилки
    }

    // Замінюємо саме «думаю», а не останній елемент: поки чекали відповідь,
    // користувач міг нічого не додати, але припущення тут дешевше не робити.
    setChat((current) => {
      const next = [...current];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].kind === "pending") {
          next[i] = reply;
          return next;
        }
      }
      return [...next, reply];
    });
    setBotBusy(false);
  };

  // Лог росте вниз, тому після кожної репліки прокручуємо в кінець: інакше
  // відповідь з'являється за межею видимої частини вікна.
  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chat]);

  /** Спільні пропси хрому вікна — щоб не повторювати п'ять однакових рядків. */
  const chromeFor = (id: WindowId) => ({
    state: windows[id],
    onFocus: () => focusWindow(id),
    onMinimize: () => patchWindow(id, { open: false }),
    onClose: () => closeWindow(id),
    onToggleMax: () => {
      patchWindow(id, { max: !windows[id].max });
      focusWindow(id);
    },
    onMove: (x: number, y: number) => patchWindow(id, { x, y }),
  });

  return (
    <main className="desktop-shell">
      <a className="skip-link" href="#articles">
        До статей
      </a>

      {/* ------------------------------------------------------------ топбар */}
      <header className="topbar glass-panel">
        <button
          className="brand"
          onClick={() => {
            openWindow("welcome");
            applyFacet("all");
          }}
          aria-label="Wait, What? — на початок"
        >
          WAIT, WHAT? <span aria-hidden="true">✨</span>
        </button>

        <nav aria-label="Основна навігація">
          {NAV_FACETS.map((item) => (
            <button
              key={item}
              onClick={() => applyFacet(item)}
              aria-pressed={facet === item}
            >
              {FACET_LABELS[item]}
            </button>
          ))}
          <button
            onClick={() => openWindow("glossary")}
            aria-pressed={windows.glossary.open}
          >
            Глосарій
          </button>
        </nav>

        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Пошук по статтях"
            aria-label="Пошук по статтях"
          />
        </label>
      </header>

      <section className="desktop-area" aria-label="Робочий стіл Wait, What?">
        {/* ------------------------------------------------------------ герой */}
        {windows.welcome.open && (
          <DesktopWindow
            className="hero-window"
            labelledBy="hero-title"
            title={<span>{WINDOW_META.welcome.file}</span>}
            {...chromeFor("welcome")}
          >
            <div className="hero-content">
              <div className="hero-sparkles" aria-hidden="true">
                ✦<span>✦</span>
              </div>
              <p className="eyebrow">Довідник по поколіннях</p>
              <h1 id="hero-title">
                GEN Z,
                <br />
                БЕЗ ПЕРЕКЛАДАЧА
              </h1>
              <p>
                Тренди, робота, стосунки й сучасна культура — зрозуміло для
                міленіалів.
              </p>
              <button
                className="primary-button"
                onClick={() =>
                  document
                    .getElementById("articles")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                ПОЧАТИ ЧИТАТИ <span aria-hidden="true">↗</span>
              </button>
            </div>
          </DesktopWindow>
        )}

        {/* ---------------------------------------------------------- waitbot */}
        {windows.waitbot.open && (
          <DesktopWindow
            className="bot-window"
            labelledBy="bot-title"
            title={<strong id="bot-title">ЗАПИТАЙ WAITBOT</strong>}
            {...chromeFor("waitbot")}
          >
            <div className="bot-content">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="waitbot-avatar"
                src="/waitwhat/waitbot.webp"
                alt="WaitBot — дружня жовта світна кулька"
              />
              <div className="bot-greeting">
                Привіт! Я <strong>WAITBOT ✨</strong>
                <br />
                Твій гід у світі Gen Z.
              </div>

              {/* Порожній лог не малюємо: він забирав сотню пікселів висоти й
                  підсовував вікно бота під стрічку статей */}
              {chat.length > 0 && (
                <div className="chat-log" aria-live="polite" ref={logRef}>
                  {chat.map((turn, index) => (
                    <p
                      key={index}
                      className={cn(
                        "chat-message",
                        turn.role,
                        turn.kind === "pending" && "pending",
                        turn.kind === "error" && "error",
                      )}
                    >
                      {turn.text}
                    </p>
                  ))}
                </div>
              )}

              <form
                className="bot-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void askBot(botInput);
                }}
              >
                <input
                  value={botInput}
                  onChange={(event) => setBotInput(event.target.value)}
                  placeholder="Слово, фраза або «переклади на зумерську»"
                  aria-label="Запитати WaitBot про сленг"
                  maxLength={500}
                  disabled={botBusy}
                />
                <button aria-label="Надіслати" disabled={botBusy}>
                  {botBusy ? "…" : "↑"}
                </button>
              </form>

              <p className="try-label">Спробуй запитати:</p>
              <div className="suggestion-row">
                {BOT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={botBusy}
                    onClick={() => askBot(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </DesktopWindow>
        )}

        {/* --------------------------------------------------------- глосарій */}
        {windows.glossary.open && (
          <DesktopWindow
            className="tool-window win-glossary"
            labelledBy="glossary-title"
            title={<strong id="glossary-title">ГЛОСАРІЙ</strong>}
            {...chromeFor("glossary")}
          >
            <GlossaryBody articles={articles} onPick={searchFor} />
          </DesktopWindow>
        )}

        {/* ------------------------------------------------------------ свіже */}
        {windows.feed.open && (
          <DesktopWindow
            className="tool-window win-feed"
            labelledBy="feed-title"
            title={<strong id="feed-title">СВІЖЕ</strong>}
            {...chromeFor("feed")}
          >
            <FeedBody articles={articles} onOpen={setOpenId} />
          </DesktopWindow>
        )}

        {/* ------------------------------------------------------ про студію */}
        {windows.about.open && (
          <DesktopWindow
            className="tool-window win-about"
            labelledBy="about-title"
            title={<strong id="about-title">ПРО СТУДІЮ</strong>}
            {...chromeFor("about")}
          >
            <AboutBody counts={counts} />
          </DesktopWindow>
        )}

        {/* ----------------------------------------------------------- ярлики */}
        <section className="desktop-shortcuts" aria-label="Теки на столі">
          <Shortcut
            icon="📁"
            iconClass=""
            label="Усі матеріали"
            hint={`${counts.all} статей`}
            active={facet === "all"}
            onClick={() => applyFacet("all")}
          />
          <Shortcut
            icon="♥"
            iconClass="shortcut-saved"
            label="Збережене"
            hint={`${counts.saved} у теці`}
            active={facet === "saved"}
            onClick={() => {
              setFacet("saved");
              setQuery("");
              showToast(
                counts.saved
                  ? `${counts.saved} збережених`
                  : "У теці поки порожньо — збережи щось із вікна статті",
              );
            }}
          />
          <Shortcut
            icon="📂"
            iconClass="shortcut-trending"
            label="Готові"
            hint={`${counts.ready} затверджених`}
            active={facet === "ready"}
            onClick={() => applyFacet("ready")}
          />
          <Shortcut
            icon="✦"
            iconClass="shortcut-glossary"
            label="Глосарій"
            hint="терміни статей"
            active={windows.glossary.open}
            onClick={() => openWindow("glossary")}
          />
          <Shortcut
            icon="◈"
            iconClass="shortcut-about"
            label="Про студію"
            hint="як це працює"
            active={windows.about.open}
            onClick={() => openWindow("about")}
          />
        </section>

        {/* -------------------------------------------------- стрічка-карусель */}
        <section
          className="article-strip"
          id="articles"
          aria-label="Стрічка статей"
        >
          <div className="strip-head">
            <p>
              {FACET_LABELS[facet]} <b>{visible.length}</b>
            </p>
            {track.pages > 1 && (
              <div className="strip-nav">
                <button
                  onClick={() => scrollByPage(-1)}
                  disabled={track.atStart}
                  aria-label="Попередні статті"
                >
                  ‹
                </button>
                <button
                  onClick={() => scrollByPage(1)}
                  disabled={track.atEnd}
                  aria-label="Наступні статті"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          <div className="strip-track" ref={trackRef} onScroll={measure}>
            {visible.length === 0 ? (
              <button
                className="empty-window app-window"
                onClick={() => applyFacet("all")}
              >
                Тут порожньо. Показати всі статті ↗
              </button>
            ) : (
              visible.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onOpen={() => setOpenId(article.id)}
                  onHide={() =>
                    setHiddenCards((current) =>
                      new Set(current).add(article.id),
                    )
                  }
                />
              ))
            )}
          </div>

          {track.pages > 1 && (
            <div className="strip-dots">
              {Array.from({ length: track.pages }, (_, page) => (
                <button
                  key={page}
                  onClick={() => scrollToPage(page)}
                  aria-current={track.page === page}
                  aria-label={`Сторінка ${page + 1}`}
                />
              ))}
            </div>
          )}
        </section>
      </section>

      <Taskbar
        windows={windows}
        facet={facet}
        draftCount={counts.draft}
        onOpenWindow={openWindow}
        onToggleWindow={toggleWindow}
        onCloseAll={closeAllWindows}
        onFacet={applyFacet}
      />

      {openArticle && (
        <ArticleWindow
          article={openArticle}
          saved={saved.has(openArticle.id)}
          onToggleSave={() => toggleSaved(openArticle.id)}
          onClose={() => setOpenId(null)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function Shortcut({
  icon,
  iconClass,
  label,
  hint,
  active,
  onClick,
}: {
  icon: string;
  iconClass: string;
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className="desktop-shortcut" onClick={onClick} aria-pressed={active}>
      <span className={cn("shortcut-icon", iconClass)} aria-hidden="true">
        {icon}
      </span>
      <strong>{label}</strong>
      <small>{hint}</small>
    </button>
  );
}

function ArticleCard({
  article,
  onOpen,
  onHide,
}: {
  article: ReaderArticle;
  onOpen: () => void;
  onHide: () => void;
}) {
  return (
    <article
      className="article-card app-window"
      style={{ "--article-accent": article.accent } as CSSProperties}
    >
      <div className="article-titlebar">
        <span className="mini-folder" aria-hidden="true">
          ▰
        </span>
        <span>{article.category}</span>
        <div className="mini-controls">
          <button onClick={onHide} aria-label="Згорнути картку">
            −
          </button>
          <button onClick={onHide} aria-label="Закрити картку">
            ×
          </button>
        </div>
      </div>

      <button className="article-open" onClick={onOpen}>
        {article.cover ? (
          // Обкладинки приходять із Supabase Storage довільним хостом, тому
          // звичайний <img>: next/image вимагав би remotePatterns на кожен бакет
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.cover} alt="" />
        ) : (
          <span className="cover-blank" aria-hidden="true">
            ✦
          </span>
        )}
        <span className="article-copy">
          <strong>{article.title}</strong>
          <small>
            <span>◷ {article.minutes} хв</span>
            {article.demo ? (
              <span className="card-flag card-flag--demo">демо</span>
            ) : (
              !article.approved && (
                <span className="card-flag card-flag--draft">чернетка</span>
              )
            )}
          </small>
        </span>
      </button>
    </article>
  );
}
