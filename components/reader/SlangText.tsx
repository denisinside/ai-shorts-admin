"use client";

import { useMemo, type ReactNode } from "react";

import { findSlangSpans, type SlangIndex } from "@/lib/slang-client";

/**
 * Текст репліки, у якому терміни словника підкреслені й клікабельні.
 *
 * Чому не `dangerouslySetInnerHTML` з підставленими тегами: текст приходить
 * від моделі, тобто це недовірений рядок. Тут він лишається текстом — React
 * сам його екранує, а підкреслення робиться розбиттям на вузли за зміщеннями
 * символів, які повернув матчер.
 */
export default function SlangText({
  text,
  index,
  onLookup,
}: {
  text: string;
  index: SlangIndex | null;
  onLookup: (key: string) => void;
}) {
  const parts = useMemo<ReactNode[]>(() => {
    if (!index) return [text];
    const spans = findSlangSpans(text, index);
    if (!spans.length) return [text];

    const out: ReactNode[] = [];
    let cursor = 0;
    spans.forEach((span, position) => {
      if (span.start > cursor) out.push(text.slice(cursor, span.start));
      const entry = index.byKey.get(span.key);
      out.push(
        <button
          key={`${span.key}-${position}`}
          type="button"
          className="slang-term"
          onClick={() => onLookup(span.key)}
          title={entry ? `${entry.term} — ${entry.short}` : "Показати у словнику"}
        >
          {text.slice(span.start, span.end)}
        </button>,
      );
      cursor = span.end;
    });
    if (cursor < text.length) out.push(text.slice(cursor));
    return out;
  }, [text, index, onLookup]);

  return <>{parts}</>;
}
