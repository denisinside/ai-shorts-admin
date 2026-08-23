"use client";

import { useRef, type ReactNode, type PointerEvent } from "react";
import { cn } from "@/lib/ui";

/**
 * Хром вікна на робочому столі: титульний рядок, три кнопки, перетягування,
 * розгортання на весь екран.
 *
 * Чому спільний компонент, а не копія в кожному вікні: кнопок три, і кожна з
 * них мусить робити те саме в п'яти вікнах. Коли «на весь екран» жило в розмітці
 * кожного вікна окремо, воно не працювало ніде — саме тому воно тут одне.
 *
 * Геометрія (зсув, розгорнутість, порядок шарів) живе в БАТЬКІВСЬКОМУ стані, а
 * не тут: таскбар мусить відновлювати вікно, яке згорнули, а згорнуте вікно
 * розмонтоване й власного стану вже не має.
 */

/**
 * Id вікна — рядок, а не union із п'яти назв.
 *
 * ЧОМУ ТАК. Вікна словника відкриваються НА СЛОВО: скільком словам людина
 * захотіла подивитися значення, стільком і бути вікнам. Такий id виглядає як
 * `lookup:rizz`, і саме він дає правило «одне вікно на одне слово, різні
 * слова — різні вікна» безкоштовно: повторне відкриття того самого слова
 * знаходить наявний стан і просто піднімає вікно нагору.
 */
export type WindowId = string;

/** Постійні вікна: вони є завжди й мають плитку в меню «Пуск». */
export const FIXED_WINDOWS = [
  "welcome",
  "waitbot",
  "slangbook",
  "glossary",
  "feed",
  "about",
] as const;

export type FixedWindowId = (typeof FIXED_WINDOWS)[number];

export type WindowMeta = { label: string; icon: string; file: string };

/**
 * Опис вікон в одному місці: за ним будуються і кнопки в таскбарі, і плитки в
 * меню «Пуск», і титульні рядки. Додати вікно — це рядок тут плюс вміст у
 * `ToolWindows`, а не правки в трьох файлах.
 */
export const WINDOW_META: Record<FixedWindowId, WindowMeta> = {
  welcome: { label: "Головна", icon: "📁", file: "waitwhat://welcome" },
  waitbot: { label: "WaitBot", icon: "✨", file: "waitwhat://waitbot" },
  slangbook: { label: "Словник", icon: "📖", file: "waitwhat://slang" },
  glossary: { label: "Глосарій", icon: "▣", file: "waitwhat://glossary" },
  feed: { label: "Свіже", icon: "📂", file: "waitwhat://feed" },
  about: { label: "Про студію", icon: "◈", file: "waitwhat://about" },
};

/** Префікси динамічних вікон: стаття словника й мем на весь зріст. */
export const LOOKUP_PREFIX = "lookup:";
export const MEME_PREFIX = "meme:";

/**
 * Скільки лишати видимим, щоб вікно завжди можна було закрити.
 *
 * Топбар фіксований і лежить ВИЩЕ вікон (z-index 30 проти 12+), тож затягнуте
 * під нього вікно ховає власний титульний рядок разом із хрестиком — і стає
 * недосяжним. Те саме з таскбаром знизу й із краями екрана. Тому перетягування
 * обмежене: не «щоб було красиво», а щоб вікно не можна було втратити.
 *
 * Підняти вікна над топбаром замість цього не можна: топбар — це навігація,
 * і вікно, що накриває меню, ламає сторінку інакше, але так само.
 */
const GAP = 8;
/** Скільки титульного рядка лишається над таскбаром. */
const TITLEBAR_KEEP = 44;
/** Скільки вікна лишається в кадрі по горизонталі. */
const SIDE_KEEP = 120;

const clamp = (value: number, min: number, max: number) =>
  // max може виявитися меншим за min на вузькому екрані: тоді перемагає
  // верхня межа, бо вона про доступність кнопок, а не про естетику.
  Math.max(min, Math.min(max, value));

export const lookupWindowId = (key: string) => `${LOOKUP_PREFIX}${key}`;
export const memeWindowId = (key: string) => `${MEME_PREFIX}${key}`;

export const lookupKeyOf = (id: WindowId) =>
  id.startsWith(LOOKUP_PREFIX) ? id.slice(LOOKUP_PREFIX.length) : null;

export const memeKeyOf = (id: WindowId) =>
  id.startsWith(MEME_PREFIX) ? id.slice(MEME_PREFIX.length) : null;

/**
 * Динамічне вікно — будь-яке, якого немає в `WINDOW_META`. Перевірка по
 * двокрапці, а не перелік префіксів: наступний тип вікна (стаття? профіль?)
 * інакше довелося б дописувати в чотири місця, і одне з них забулося б.
 */
export const isDynamicWindow = (id: WindowId) => id.includes(":");

/**
 * Опис будь-якого вікна, у тому числі динамічного. Підпис словникового вікна —
 * саме слово: у таскбарі мусить бути видно, яке з п'яти відкритих вікон
 * котре, а «Словник» × 5 не відрізнити.
 */
export function windowMeta(id: WindowId, label?: string): WindowMeta {
  const key = lookupKeyOf(id);
  if (key !== null) {
    return {
      label: label ?? key,
      icon: "🔖",
      file: `waitwhat://slang/${key.replace(/\s+/g, "-")}`,
    };
  }
  const meme = memeKeyOf(id);
  if (meme !== null) {
    return { label: label ?? "мем", icon: "🖼", file: `waitwhat://meme/${meme}` };
  }
  return (
    WINDOW_META[id as FixedWindowId] ?? {
      label: id,
      icon: "▢",
      file: `waitwhat://${id}`,
    }
  );
}

export type WindowState = {
  open: boolean;
  /** Розгорнуте на весь стіл. Перетягування при цьому вимкнене. */
  max: boolean;
  x: number;
  y: number;
  /** Порядок шарів: клік по вікну піднімає його над рештою. */
  z: number;
};

export default function DesktopWindow({
  title,
  className,
  state,
  labelledBy,
  onFocus,
  onMinimize,
  onClose,
  onToggleMax,
  onMove,
  children,
}: {
  title: ReactNode;
  className: string;
  state: WindowState;
  labelledBy?: string;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onToggleMax: () => void;
  onMove: (x: number, y: number) => void;
  children: ReactNode;
}) {
  const from = useRef<{
    px: number;
    py: number;
    ox: number;
    oy: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    onFocus();
    // Розгорнуте вікно тягати нікуди, а нижче 900px вікна лежать у потоці
    if (state.max || window.innerWidth < 900) return;
    // Кнопки живуть у самому титульному рядку: клік по них не тягне вікно
    if ((event.target as HTMLElement).closest("button")) return;

    const win = event.currentTarget.closest(".app-window");
    const rect = (win ?? event.currentTarget).getBoundingClientRect();

    // Межі МІРЯЮТЬСЯ, а не задаються числом: топбар має `top: 24px` і висоту
    // 82px, але медіазапити це міняють, і зашитий літерал розійшовся б із
    // версткою мовчки. Таскбар так само: він фіксований і лежить вище вікон.
    const bar = document.querySelector(".topbar")?.getBoundingClientRect();
    const tray = document.querySelector(".taskbar")?.getBoundingClientRect();
    const limitTop = (bar ? bar.bottom : 0) + GAP;
    const limitBottom = (tray ? tray.top : window.innerHeight) - TITLEBAR_KEEP;

    // Обмежуємо зміщення, а не координати: `state.x/y` — це зсув поверх
    // позиції з CSS, тож переводимо дозволений діапазон екранних координат
    // у діапазон зсуву для цього конкретного вікна.
    from.current = {
      px: event.clientX,
      py: event.clientY,
      ox: state.x,
      oy: state.y,
      minX: state.x + (SIDE_KEEP - rect.right),
      maxX: state.x + (window.innerWidth - SIDE_KEEP - rect.left),
      minY: state.y + (limitTop - rect.top),
      maxY: state.y + (limitBottom - rect.top),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const at = from.current;
    if (!at) return;
    onMove(
      clamp(at.ox + event.clientX - at.px, at.minX, at.maxX),
      clamp(at.oy + event.clientY - at.py, at.minY, at.maxY),
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    from.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* захоплення могло не відбутися — відпускати нічого */
    }
  };

  return (
    <section
      className={cn("app-window", className, state.max && "is-maximized")}
      aria-labelledby={labelledBy}
      onPointerDownCapture={onFocus}
      style={{
        // Розгорнуте вікно позиціонує CSS, тому зсув перетягування скидаємо
        transform: state.max
          ? undefined
          : `translate(${state.x}px, ${state.y}px)`,
        zIndex: state.z,
      }}
    >
      <div
        className="titlebar drag-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onToggleMax}
      >
        {title}
        <div className="window-controls">
          <button onClick={onMinimize} aria-label="Згорнути вікно">
            −
          </button>
          <button
            onClick={onToggleMax}
            aria-pressed={state.max}
            aria-label={state.max ? "Відновити розмір" : "Розгорнути на весь стіл"}
          >
            {state.max ? "❐" : "□"}
          </button>
          <button onClick={onClose} aria-label="Закрити вікно">
            ×
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}
