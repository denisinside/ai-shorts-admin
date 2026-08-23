"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/ui";
import { FACET_LABELS, type ReaderFacet } from "@/lib/reader";
import {
  FIXED_WINDOWS,
  windowMeta,
  type WindowId,
  type WindowState,
} from "./DesktopWindow";

/**
 * Панель завдань. Робить те саме, що робить справжня: тримає меню «Пуск»,
 * показує, які вікна відкриті, і має трей.
 *
 * У треї свідомо лише те, що можна прочитати НАСПРАВДІ — заряд, мережа,
 * годинник, кількість чернеток. Регулятор звуку, який нічого не регулює, був би
 * тією ж намальованою цифрою, від якої ми позбулися на ярликах.
 */

/* ------------------------------------------------------------------ годинник
   Годинник — зовнішнє джерело даних, а не стан React: часу клієнта на сервері
   не існує, тож відрендерений там він давав би розбіжність гідратації на
   кожному завантаженні. Снапшот кешується в модулі, бо `getSnapshot` мусить
   повертати те саме значення між тиками — інакше React зациклює рендери.
   -------------------------------------------------------------------------- */
const CLOCK_TICK_MS = 20_000;

type ClockSnapshot = { time: string; date: string; stamp: number };

const SERVER_CLOCK: ClockSnapshot = { time: "--:--", date: "", stamp: 0 };

let clockSnapshot: ClockSnapshot = SERVER_CLOCK;

function readClock(): ClockSnapshot {
  const now = new Date();
  return {
    time: now.toLocaleTimeString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: now.toLocaleDateString("uk-UA"),
    stamp: now.getTime(),
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

/* -------------------------------------------------------------------- мережа */
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// Примітив, тому кешувати нічого: значення стабільне між подіями
const getOnline = () => navigator.onLine;
const getServerOnline = () => true;

/* ------------------------------------------------------------------ батарея */
type BatteryReading = { level: number; charging: boolean };

type BatteryManager = EventTarget & { level: number; charging: boolean };

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManager>;
};

/**
 * Battery Status API є не всюди (Safari і Firefox його не дають), тому вікно
 * заряду просто не малюється, якщо читати нічого. Показувати вигаданий
 * відсоток було б гірше, ніж не показувати нічого.
 */
function useBattery(): BatteryReading | null {
  const [reading, setReading] = useState<BatteryReading | null>(null);

  useEffect(() => {
    const nav = navigator as NavigatorWithBattery;
    if (!nav.getBattery) return;

    let battery: BatteryManager | null = null;
    let cancelled = false;

    // setState живе в колбеку події, а не в тілі ефекту: це саме той випадок,
    // для якого ефекти й призначені — підписка на зовнішню систему
    const update = () => {
      if (!cancelled && battery) {
        setReading({ level: battery.level, charging: battery.charging });
      }
    };

    nav.getBattery().then((manager) => {
      if (cancelled) return;
      battery = manager;
      manager.addEventListener("levelchange", update);
      manager.addEventListener("chargingchange", update);
      update();
    });

    return () => {
      cancelled = true;
      battery?.removeEventListener("levelchange", update);
      battery?.removeEventListener("chargingchange", update);
    };
  }, []);

  return reading;
}

/* ------------------------------------------------------------------ календар */
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function Calendar({ stamp }: { stamp: number }) {
  if (!stamp) return null;

  const today = new Date(stamp);
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() віддає 0 для неділі, а тиждень тут починається з понеділка
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;

  return (
    <div className="tray-popup" role="dialog" aria-label="Календар">
      <p className="tray-popup__title">
        {today.toLocaleDateString("uk-UA", { month: "long", year: "numeric" })}
      </p>
      <div className="calendar">
        {WEEKDAYS.map((day) => (
          <small key={day}>{day}</small>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          return (
            <span
              key={day}
              aria-current={day === today.getDate() ? "date" : undefined}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ таскбар */

const START_FACETS: ReaderFacet[] = ["all", "ready", "draft", "demo", "saved"];

export default function Taskbar({
  windows,
  facet,
  draftCount,
  onOpenWindow,
  onToggleWindow,
  onCloseAll,
  onFacet,
}: {
  windows: Record<WindowId, WindowState | undefined>;
  facet: ReaderFacet;
  /** Скільки чернеток чекає на рішення — це і є «сповіщення» в треї. */
  draftCount: number;
  onOpenWindow: (id: WindowId) => void;
  onToggleWindow: (id: WindowId) => void;
  onCloseAll: () => void;
  onFacet: (facet: ReaderFacet) => void;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const barRef = useRef<HTMLElement | null>(null);

  const clock = useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnline,
    getServerOnline,
  );
  const battery = useBattery();

  // Клік поза панеллю і Esc закривають обидві поповки — як у справжньому меню,
  // яке не лишається висіти після того, як ти пішов працювати далі
  useEffect(() => {
    if (!startOpen && !trayOpen) return;

    const close = () => {
      setStartOpen(false);
      setTrayOpen(false);
    };

    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [startOpen, trayOpen]);

  // Плитки в меню «Пуск» — лише постійні вікна: словникові з'являються від
  // кліку по слову, і місця під них у меню бути не може.
  const fixedIds = FIXED_WINDOWS as readonly WindowId[];
  // У рядку запущених — постійні плюс ті словникові, які зараз відкриті:
  // таскбар мусить уміти згорнути й відновити будь-яке вікно на столі.
  const runningIds = [
    ...fixedIds,
    ...Object.keys(windows).filter(
      (id) => !fixedIds.includes(id) && windows[id]?.open,
    ),
  ];
  const batteryPercent = battery ? Math.round(battery.level * 100) : null;

  return (
    <footer className="taskbar glass-panel" aria-label="Панель завдань" ref={barRef}>
      <button
        className={cn("start-button", startOpen && "is-active")}
        onClick={() => {
          setStartOpen((open) => !open);
          setTrayOpen(false);
        }}
        aria-expanded={startOpen}
        aria-label="Меню «Пуск»"
      >
        ✦
      </button>

      {startOpen && (
        <div className="start-menu glass-panel" role="dialog" aria-label="Меню">
          <p className="start-menu__title">
            WAIT, WHAT? <span aria-hidden="true">✨</span>
          </p>

          <div className="start-menu__grid">
            {fixedIds.map((id) => (
              <button
                key={id}
                onClick={() => {
                  onOpenWindow(id);
                  setStartOpen(false);
                }}
              >
                <span aria-hidden="true">{windowMeta(id).icon}</span>
                {windowMeta(id).label}
                {windows[id]?.open && (
                  <b aria-label="відкрито" title="відкрито" />
                )}
              </button>
            ))}
          </div>

          <p className="start-menu__label">Показати у стрічці</p>
          <div className="start-menu__facets">
            {START_FACETS.map((item) => (
              <button
                key={item}
                onClick={() => {
                  onFacet(item);
                  setStartOpen(false);
                }}
                aria-pressed={facet === item}
              >
                {FACET_LABELS[item]}
              </button>
            ))}
          </div>

          <button
            className="start-menu__quit"
            onClick={() => {
              onCloseAll();
              setStartOpen(false);
            }}
          >
            Закрити всі вікна
          </button>
        </div>
      )}

      {/* Кнопки вікон: підкреслення означає «відкрито», клік згортає й
          відновлює — рівно як у панелі справжньої системи */}
      <div className="task-apps">
        {runningIds.map((id) => (
          <button
            key={id}
            className={cn(windows[id]?.open && "is-running")}
            onClick={() => onToggleWindow(id)}
            aria-pressed={Boolean(windows[id]?.open)}
            title={
              windows[id]?.open
                ? `Згорнути «${windowMeta(id).label}»`
                : `Відкрити «${windowMeta(id).label}»`
            }
          >
            <span aria-hidden="true">{windowMeta(id).icon}</span>
            {windowMeta(id).label}
          </button>
        ))}
      </div>

      <div className="system-tray">
        {/* Чернетки — це і є сповіщення: рядки, по яких рішення ще немає */}
        <button
          className="tray-item"
          onClick={() => onFacet("draft")}
          title={
            draftCount
              ? `${draftCount} чернеток чекає на рішення`
              : "Чернеток немає"
          }
          aria-label={`Чернетки: ${draftCount}`}
        >
          <span aria-hidden="true">◔</span>
          {draftCount > 0 && <i className="tray-badge">{draftCount}</i>}
        </button>

        <span
          className={cn("tray-item", "tray-net", !online && "is-offline")}
          title={online ? "Мережа: онлайн" : "Мережа: офлайн"}
          role="status"
        >
          <span aria-hidden="true">{online ? "⇅" : "⚠"}</span>
        </span>

        {batteryPercent !== null && (
          <span
            className="tray-item"
            title={`Заряд ${batteryPercent}%${battery?.charging ? ", заряджається" : ""}`}
            role="status"
          >
            <span
              className={cn("tray-battery", battery?.charging && "is-charging")}
              style={{ "--level": `${batteryPercent}%` } as CSSProperties}
              aria-hidden="true"
            />
          </span>
        )}

        <button
          className="tray-clock"
          onClick={() => {
            setTrayOpen((open) => !open);
            setStartOpen(false);
          }}
          aria-expanded={trayOpen}
          aria-label="Календар"
        >
          <time>
            {clock.time}
            <br />
            <small>{clock.date}</small>
          </time>
        </button>

        {trayOpen && <Calendar stamp={clock.stamp} />}
      </div>
    </footer>
  );
}
