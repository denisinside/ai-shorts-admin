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

export type WindowId = "welcome" | "waitbot" | "glossary" | "feed" | "about";

/**
 * Опис вікон в одному місці: за ним будуються і кнопки в таскбарі, і плитки в
 * меню «Пуск», і титульні рядки. Додати вікно — це рядок тут плюс вміст у
 * `ToolWindows`, а не правки в трьох файлах.
 */
export const WINDOW_META: Record<
  WindowId,
  { label: string; icon: string; file: string }
> = {
  welcome: { label: "Головна", icon: "📁", file: "waitwhat://welcome" },
  waitbot: { label: "WaitBot", icon: "✨", file: "waitwhat://waitbot" },
  glossary: { label: "Глосарій", icon: "▣", file: "waitwhat://glossary" },
  feed: { label: "Свіже", icon: "📂", file: "waitwhat://feed" },
  about: { label: "Про студію", icon: "◈", file: "waitwhat://about" },
};

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
  } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    onFocus();
    // Розгорнуте вікно тягати нікуди, а нижче 900px вікна лежать у потоці
    if (state.max || window.innerWidth < 900) return;
    // Кнопки живуть у самому титульному рядку: клік по них не тягне вікно
    if ((event.target as HTMLElement).closest("button")) return;

    from.current = {
      px: event.clientX,
      py: event.clientY,
      ox: state.x,
      oy: state.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!from.current) return;
    onMove(
      from.current.ox + event.clientX - from.current.px,
      from.current.oy + event.clientY - from.current.py,
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
