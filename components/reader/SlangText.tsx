"use client";

import { useMemo, type ReactNode } from "react";

import { INLINE_RE } from "@/components/ui/Markdown";
import { findSlangSpans, type SlangIndex } from "@/lib/slang-client";

/**
 * Репліка чату: інлайновий markdown плюс підкреслені терміни словника.
 *
 * ЧОМУ НЕ КОМПОНЕНТ `Markdown`. Модель відповідає розміткою (`**juiced**`), і
 * без розбору людина бачить зірочки — це те, що й було видно в чаті. Але
 * готовий рендерер тут не годиться: терміни треба шукати ВСЕРЕДИНІ вже
 * розібраних вузлів, бо сленгове слово частіше за все саме й виділене жирним.
 * Тому розмітку розбираємо тим самим `INLINE_RE`, що й статті, а всередині
 * кожного текстового прогону вже шукаємо словник.
 *
 * ЧОМУ НЕ `dangerouslySetInnerHTML`. Текст приходить від моделі, тобто це
 * недовірений рядок. Тут він лишається текстом: React сам його екранує, а
 * підкреслення робиться розбиттям на вузли за зміщеннями символів.
 *
 * Блокову розмітку (заголовки, справжні списки) свідомо не робимо: у вікні
 * бота це три речення, і `##` там означало б, що модель порушила промпт.
 * Маркер списку приводимо до «•» — рівно щоб на екрані не було дефісів
 * посеред тексту.
 */

/** `- пункт` / `* пункт` на початку рядка -> «• пункт». */
const BULLET_RE = /^([ \t]*)[-*+][ \t]+/gm;

/** Заголовок у репліці чату — помилка моделі, але решітки показувати гірше. */
const HEADING_RE = /^#{1,6}[ \t]+/gm;

function tidy(text: string): string {
  return text.replace(BULLET_RE, "$1• ").replace(HEADING_RE, "");
}

/** Текстовий прогін: підкреслює знайдені терміни, решту лишає текстом. */
function renderRun(
  text: string,
  keyPrefix: string,
  index: SlangIndex | null,
  onLookup: (key: string) => void,
): ReactNode[] {
  if (!index || !text) return [text];
  const spans = findSlangSpans(text, index);
  if (!spans.length) return [text];

  const out: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, position) => {
    if (span.start > cursor) out.push(text.slice(cursor, span.start));
    const entry = index.byKey.get(span.key);
    out.push(
      <button
        key={`${keyPrefix}-${span.key}-${position}`}
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
}

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
    const source = tidy(text);
    // split із групою, що захоплює, лишає розділювачі в масиві — так один
    // прохід дає і розмітку, і текст між нею.
    //
    // Тип віддачі вказаний явно: без нього TS зводить гілки до
    // `Element[] | ReactNode[]`, а `flatMap` такого не приймає — текстові
    // прогони повертають рядки, а не елементи.
    return source.split(INLINE_RE).flatMap<ReactNode>((token, position): ReactNode[] => {
      if (!token) return [];
      const key = `t${position}`;
      const inner = (value: string) => renderRun(value, key, index, onLookup);

      if (
        (token.startsWith("**") && token.endsWith("**") && token.length > 4) ||
        (token.startsWith("__") && token.endsWith("__") && token.length > 4)
      ) {
        return [<strong key={key}>{inner(token.slice(2, -2))}</strong>];
      }
      if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
        return [<code key={key}>{token.slice(1, -1)}</code>];
      }
      if (
        ((token.startsWith("*") && token.endsWith("*")) ||
          (token.startsWith("_") && token.endsWith("_"))) &&
        token.length > 2
      ) {
        return [<em key={key}>{inner(token.slice(1, -1))}</em>];
      }

      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (link) {
        return [
          <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener">
            {link[1]}
          </a>,
        ];
      }

      return inner(token);
    });
  }, [text, index, onLookup]);

  return <>{parts}</>;
}
