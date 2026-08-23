"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  FACET_LABELS,
  matchesFacet,
  type ReaderArticle,
  type ReaderFacet,
} from "@/lib/reader";
import ArticleWindow from "./ArticleWindow";

/**
 * Робочий стіл «Wait, What?» — інтерактивна частина читалки.
 *
 * Чому один великий клієнтський компонент, а не дерево серверних: усе тут —
 * один стан (фасет, пошук, збережене, відкрита стаття), і стрічка мусить
 * перефільтровуватися без походу на сервер. Дані приходять уже плоскими
 * (`ReaderArticle`), тому серверна частина лишається запитом до бази й нічим
 * більше.
 *
 * Ярлики й пункти меню з макета навмисно НЕ декоративні: замість «12 items»
 * вони показують справжні лічильники й працюють як фасети стрічки. Намальована
 * цифра на сторінці, під'єднаній до бази, — це просто неправда.
 */

/** Що WaitBot умів у макеті. Це демо-довідник, а не запит до моделі. */
const BOT_ANSWERS: Record<string, string> = {
  rizz: "Rizz — це харизма й уміння фліртувати. Коротко: чарівність, перезібрана інтернетом.",
  corecore:
    "Corecore — відеоестетика-колаж: уривки інтернету, змонтовані так, щоб передати перевантаження й відчуженість сучасного життя.",
  "gen z на роботі":
    "Gen Z цінує чіткі очікування, частий фідбек, гнучкість і докази, що заявлені цінності компанії справжні.",
};

const BOT_PROMPTS = ["RIZZ", "CORECORE", "GEN Z НА РОБОТІ"];

/** Фасети в тому порядку, в якому вони стоять у меню й на ярликах. */
const NAV_FACETS: ReaderFacet[] = ["all", "ready", "draft", "demo"];

const TOAST_MS = 2200;

/* ------------------------------------------------------------------ годинник
   Годинник у системному треї — зовнішнє джерело даних, а не стан React: на
   сервері часу клієнта не існує, тому відрендерений там він гарантовано не
   збігся б із клієнтським і давав розбіжність гідратації на кожному
   завантаженні. `useSyncExternalStore` для цього й придуманий: серверний
   снапшот — заглушка, а далі значення оновлює підписка.

   Снапшот кешується в модулі навмисно: `getSnapshot` мусить повертати те саме
   значення між тиками, інакше React вважає стор нестабільним і зациклює
   рендери. Тому час перечитує саме підписка, а не гетер.
   -------------------------------------------------------------------------- */
const CLOCK_TICK_MS = 30_000;

type ClockSnapshot = { time: string; date: string };

const SERVER_CLOCK: ClockSnapshot = { time: "--:--", date: "" };

let clockSnapshot: ClockSnapshot = SERVER_CLOCK;

function readClock(): ClockSnapshot {
  const now = new Date();
  return {
    time: now.toLocaleTimeString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: now.toLocaleDateString("uk-UA"),
  };
}

function subscribeClock(onChange: () => void) {
  clockSnapshot = readClock();
  onChange();

  const timer = setInterval(() => {
    clockSnapshot = readClock();
    onChange();
  }, CLOCK_TICK_MS);

  return () => clearInterval(timer);
}

const getClockSnapshot = () => clockSnapshot;
const getServerClockSnapshot = () => SERVER_CLOCK;

/**
 * Перетягування вікна за титульний рядок. Зсув живе в стані, а не в
 * `style.transform` напряму, щоб мобільна медіазапит-скидка
 * (`transform: none !important`) лишалася єдиним джерелом істини про розкладку
 * на вузьких екранах.
 */
function useWindowDrag() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const from = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Нижче 900px вікна лежать у потоці — тягати там нічого
    if (window.innerWidth < 900) return;
    // Кнопки згортання живуть у самому титульному рядку: клік по них не тягне
    if ((event.target as HTMLElement).closest("button")) return;

    from.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!from.current) return;
    setOffset({
      x: from.current.ox + event.clientX - from.current.x,
      y: from.current.oy + event.clientY - from.current.y,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    from.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* захоплення могло не відбутися — відпускати нічого */
    }
  };

  return {
    style: { transform: `translate(${offset.x}px, ${offset.y}px)` },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

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
  const [heroOpen, setHeroOpen] = useState(true);
  const [botOpen, setBotOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [chat, setChat] = useState<{ user: string; bot: string } | null>(null);
  const [botInput, setBotInput] = useState("");

  const heroDrag = useWindowDrag();
  const botDrag = useWindowDrag();

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

  // ------------------------------------------------------------ годинник
  const clock = useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );

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

  const askBot = (message: string) => {
    const text = message.trim();
    if (!text) return;
    setChat({
      user: text,
      bot:
        BOT_ANSWERS[text.toLowerCase()] ??
        "Це я ще вчу. Спробуй RIZZ, CORECORE або GEN Z НА РОБОТІ.",
    });
    setBotInput("");
  };

  const resetDesktop = () => {
    setHeroOpen(true);
    setBotOpen(true);
    applyFacet("all");
  };

  return (
    <main className="desktop-shell">
      <a className="skip-link" href="#articles">
        До статей
      </a>

      {/* ------------------------------------------------------------ топбар */}
      <header className="topbar glass-panel">
        <button
          className="brand"
          onClick={resetDesktop}
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
        {heroOpen && (
          <section
            className="hero-window app-window"
            style={heroDrag.style}
            aria-labelledby="hero-title"
          >
            <div className="titlebar drag-handle" {...heroDrag.handlers}>
              <span>waitwhat://welcome</span>
              <div className="window-controls">
                <button
                  onClick={() => setHeroOpen(false)}
                  aria-label="Згорнути вікно"
                >
                  −
                </button>
                <button aria-label="Розгорнути вікно">□</button>
                <button
                  onClick={() => setHeroOpen(false)}
                  aria-label="Закрити вікно"
                >
                  ×
                </button>
              </div>
            </div>
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
          </section>
        )}

        {/* ---------------------------------------------------------- waitbot */}
        {botOpen && (
          <aside
            className="bot-window app-window"
            style={botDrag.style}
            aria-labelledby="bot-title"
          >
            <div className="titlebar drag-handle" {...botDrag.handlers}>
              <strong id="bot-title">ЗАПИТАЙ WAITBOT</strong>
              <div className="window-controls">
                <button
                  onClick={() => setBotOpen(false)}
                  aria-label="Згорнути вікно"
                >
                  −
                </button>
                <button aria-label="Розгорнути вікно">□</button>
                <button
                  onClick={() => setBotOpen(false)}
                  aria-label="Закрити вікно"
                >
                  ×
                </button>
              </div>
            </div>
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

              <div className="chat-log" aria-live="polite">
                {chat && (
                  <>
                    <p className="chat-message user">{chat.user}</p>
                    <p className="chat-message bot">{chat.bot}</p>
                  </>
                )}
              </div>

              <form
                className="bot-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  askBot(botInput);
                }}
              >
                <input
                  value={botInput}
                  onChange={(event) => setBotInput(event.target.value)}
                  placeholder="Який тренд хочеш зрозуміти?"
                  aria-label="Запитати WaitBot про тренд"
                />
                <button aria-label="Надіслати">↑</button>
              </form>

              <p className="try-label">Спробуй запитати:</p>
              <div className="suggestion-row">
                {BOT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => askBot(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </aside>
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
            label="Демо"
            hint={`${counts.demo} з макета`}
            active={facet === "demo"}
            onClick={() => applyFacet("demo")}
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

      {/* ---------------------------------------------------------- таскбар */}
      <footer className="taskbar glass-panel" aria-label="Панель завдань">
        <button
          className="start-button"
          onClick={resetDesktop}
          aria-label="Відкрити все"
        >
          ✦
        </button>
        <div className="task-apps">
          <button onClick={() => setHeroOpen(true)} aria-pressed={heroOpen}>
            <span aria-hidden="true">📁</span> Головна
          </button>
          <button onClick={() => applyFacet("all")} aria-pressed={facet === "all"}>
            <span aria-hidden="true">📂</span> Статті
          </button>
          <button
            onClick={() => applyFacet("ready")}
            aria-pressed={facet === "ready"}
          >
            <span aria-hidden="true">▣</span> Готові
          </button>
          <button
            onClick={() => {
              setFacet("saved");
              setQuery("");
            }}
            aria-pressed={facet === "saved"}
          >
            <span aria-hidden="true">🔖</span> Збережене
          </button>
          <button onClick={() => setBotOpen(true)} aria-pressed={botOpen}>
            <span aria-hidden="true">✨</span> WaitBot
          </button>
        </div>
        <div className="system-tray">
          <span aria-hidden="true">⌃</span>
          <span aria-hidden="true">◔</span>
          <span aria-hidden="true">◖</span>
          <time>
            {clock.time}
            <br />
            <small>{clock.date}</small>
          </time>
        </div>
      </footer>

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
    <button
      className="desktop-shortcut"
      onClick={onClick}
      aria-pressed={active}
    >
      <span className={`shortcut-icon ${iconClass}`} aria-hidden="true">
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
