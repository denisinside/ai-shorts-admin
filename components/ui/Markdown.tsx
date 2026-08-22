import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

/**
 * Мінімальний рендерер markdown під `day3_article.sections[].body_md`.
 *
 * Чому свій, а не бібліотека: воркфлоу пише рівно те підмножину, яку описує
 * контракт (§5) — абзаци, `###` підрозділи, списки, жирний, посилання. Тягнути
 * заради цього react-markdown з ремарком означало б +300 КБ у бандл і власну
 * конфігурацію санітизації. HTML тут не рендериться взагалі: усе, що прийшло з
 * пайплайну, лишається текстом, тому вставити розмітку в базу й отримати її на
 * сторінці неможливо.
 *
 * Свідомо НЕ підтримується: таблиці, зображення в тексті (картинка розділу —
 * окрема колонка), блоки коду, вкладені списки. Якщо таке зʼявиться в даних —
 * побачимо як звичайний текст, а не як зламану сторінку.
 */

/** `**жирний**`, `*курсив*`, `` `код` ``, `[текст](url)` — один прохід. */
const INLINE_RE =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE_RE).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!token) return null;

    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("__") && token.endsWith("__")) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.8125rem]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      return (
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
    if (link) {
      // Зовнішні посилання з пайплайну: rel обовʼязковий, бо URL приходить
      // із джерел Дня 1, а не з нашого домену.
      return (
        <a
          key={key}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-arc underline decoration-arc/40 underline-offset-2 transition-colors hover:decoration-arc"
        >
          {link[1]}
        </a>
      );
    }

    return <span key={key}>{token}</span>;
  });
}

const BULLET_RE = /^\s*[-*+]\s+/;
const ORDERED_RE = /^\s*\d+[.)]\s+/;

export function Markdown({
  children,
  className,
}: {
  children: string | null | undefined;
  className?: string;
}) {
  const source = (children ?? "").trim();
  if (!source) return null;

  // Абзац — це блок, розділений порожнім рядком. Переноси всередині блоку
  // markdown вважає одним абзацом, і моделі пишуть саме так.
  const blocks = source.split(/\n{2,}/);

  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-ink-muted", className)}>
      {blocks.map((block, blockIndex) => {
        const key = `b${blockIndex}`;
        const lines = block.split("\n").filter((line) => line.trim());
        if (lines.length === 0) return null;

        // Підрозділ розділу. `##` теж ловимо: другий рівень зайнятий колонкою
        // h2, тож якщо він приїхав у тексті — це помилка пайплайну, але
        // показати заголовок краще, ніж рядок із решітками.
        const heading = /^(#{2,4})\s+(.*)$/.exec(lines[0]);
        if (heading && lines.length === 1) {
          return (
            <h4 key={key} className="pt-1 text-base font-semibold text-ink">
              {renderInline(heading[2], key)}
            </h4>
          );
        }

        if (lines.every((line) => BULLET_RE.test(line))) {
          return (
            <ul key={key} className="space-y-1.5 pl-1">
              {lines.map((line, index) => (
                <li key={`${key}-${index}`} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                  <span>{renderInline(line.replace(BULLET_RE, ""), `${key}-${index}`)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (lines.every((line) => ORDERED_RE.test(line))) {
          return (
            <ol key={key} className="space-y-1.5 pl-1">
              {lines.map((line, index) => (
                <li key={`${key}-${index}`} className="flex gap-2.5">
                  <span className="tabular shrink-0 text-ink-faint">
                    {index + 1}.
                  </span>
                  <span>{renderInline(line.replace(ORDERED_RE, ""), `${key}-${index}`)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (lines.every((line) => line.trimStart().startsWith(">"))) {
          return (
            <blockquote
              key={key}
              className="border-l-2 border-arc/40 pl-3 text-ink-muted italic"
            >
              {renderInline(
                lines.map((line) => line.replace(/^\s*>\s?/, "")).join(" "),
                key,
              )}
            </blockquote>
          );
        }

        return <p key={key}>{renderInline(lines.join(" "), key)}</p>;
      })}
    </div>
  );
}
