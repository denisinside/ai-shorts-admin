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

/**
 * Той самий парсер обслуговує дві сторінки з різними системами кольору, тому
 * класи вийняті в тему. `panel` — темне скло адмінки на Tailwind, `reader` —
 * світла читалка, де верстку робить `reader.css` дескриптивними селекторами,
 * і теґу достатньо самого себе.
 *
 * Дублювати парсер на дві копії було б дорожче за цю таблицю: правило «`##` у
 * тексті — це помилка пайплайну, але показати заголовок краще, ніж решітки»
 * мусить жити в одному місці.
 */
export type MarkdownVariant = "panel" | "reader";

type MarkdownTheme = {
  root: string;
  strong: string;
  code: string;
  em: string;
  link: string;
  heading: string;
  list: string;
  item: string;
  dot: string;
  num: string;
  quote: string;
};

const VARIANTS: Record<MarkdownVariant, MarkdownTheme> = {
  panel: {
    root: "space-y-3 text-sm leading-relaxed text-ink-muted",
    strong: "font-semibold text-ink",
    code: "rounded bg-white/8 px-1 py-0.5 font-mono text-[0.8125rem]",
    em: "italic",
    link: "text-arc underline decoration-arc/40 underline-offset-2 transition-colors hover:decoration-arc",
    heading: "pt-1 text-base font-semibold text-ink",
    list: "space-y-1.5 pl-1",
    item: "flex gap-2.5",
    dot: "mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint",
    num: "tabular shrink-0 text-ink-faint",
    quote: "border-l-2 border-arc/40 pl-3 text-ink-muted italic",
  },
  reader: {
    root: "ww-md",
    strong: "",
    code: "",
    em: "",
    link: "",
    heading: "ww-md__h",
    list: "",
    item: "",
    dot: "ww-md__dot",
    num: "ww-md__num",
    quote: "",
  },
};

/** `**жирний**`, `*курсив*`, `` `код` ``, `[текст](url)` — один прохід. */
const INLINE_RE =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

function renderInline(
  text: string,
  keyPrefix: string,
  theme: MarkdownTheme,
): ReactNode[] {
  return text.split(INLINE_RE).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!token) return null;

    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={key} className={theme.strong || undefined}>
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("__") && token.endsWith("__")) {
      return (
        <strong key={key} className={theme.strong || undefined}>
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={key} className={theme.code || undefined}>
          {token.slice(1, -1)}
        </code>
      );
    }
    if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      return (
        <em key={key} className={theme.em || undefined}>
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
          className={theme.link || undefined}
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

/**
 * Підрозділ розділу. `##` теж ловимо: другий рівень зайнятий колонкою `h2`,
 * тож якщо він приїхав у тексті — це помилка пайплайну, але показати заголовок
 * краще, ніж рядок із решітками.
 */
const HEADING_RE = /^(#{2,4})\s+(.*)$/;

/**
 * Ріже текст на блоки. Порожній рядок — межа абзацу, але воркфлоу Дня 3
 * регулярно пише підрозділ і його текст ОДНИМ блоком:
 *
 *     ### Коротка хронологія змін
 *     Еволюція роздач пройшла кілька етапів…
 *
 * Тому рядок-заголовок завжди виноситься в окремий блок. Без цього на сторінці
 * зʼявлялося літеральне «### Коротка хронологія змін» усередині абзацу — рівно
 * так виглядали справжні статті в базі, бо порожнього рядка після заголовка
 * модель не ставить.
 */
function toBlocks(source: string): string[] {
  const blocks: string[] = [];

  for (const chunk of source.split(/\n{2,}/)) {
    let paragraph: string[] = [];

    for (const line of chunk.split("\n")) {
      if (HEADING_RE.test(line)) {
        if (paragraph.length > 0) blocks.push(paragraph.join("\n"));
        blocks.push(line);
        paragraph = [];
      } else {
        paragraph.push(line);
      }
    }

    if (paragraph.length > 0) blocks.push(paragraph.join("\n"));
  }

  return blocks.filter((block) => block.trim().length > 0);
}

export function Markdown({
  children,
  className,
  variant = "panel",
}: {
  children: string | null | undefined;
  className?: string;
  variant?: MarkdownVariant;
}) {
  const theme = VARIANTS[variant];
  const source = (children ?? "").trim();
  if (!source) return null;

  const blocks = toBlocks(source);

  return (
    <div className={cn(theme.root, className)}>
      {blocks.map((block, blockIndex) => {
        const key = `b${blockIndex}`;
        const lines = block.split("\n").filter((line) => line.trim());
        if (lines.length === 0) return null;

        // Заголовок після toBlocks завжди сам у своєму блоці
        const heading = HEADING_RE.exec(lines[0]);
        if (heading && lines.length === 1) {
          return (
            <h4 key={key} className={theme.heading || undefined}>
              {renderInline(heading[2], key, theme)}
            </h4>
          );
        }

        if (lines.every((line) => BULLET_RE.test(line))) {
          return (
            <ul key={key} className={theme.list || undefined}>
              {lines.map((line, index) => (
                <li key={`${key}-${index}`} className={theme.item || undefined}>
                  <span aria-hidden="true" className={theme.dot} />
                  <span>
                    {renderInline(
                      line.replace(BULLET_RE, ""),
                      `${key}-${index}`,
                      theme,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        if (lines.every((line) => ORDERED_RE.test(line))) {
          return (
            <ol key={key} className={theme.list || undefined}>
              {lines.map((line, index) => (
                <li key={`${key}-${index}`} className={theme.item || undefined}>
                  <span className={theme.num}>{index + 1}.</span>
                  <span>
                    {renderInline(
                      line.replace(ORDERED_RE, ""),
                      `${key}-${index}`,
                      theme,
                    )}
                  </span>
                </li>
              ))}
            </ol>
          );
        }

        if (lines.every((line) => line.trimStart().startsWith(">"))) {
          return (
            <blockquote key={key} className={theme.quote || undefined}>
              {renderInline(
                lines.map((line) => line.replace(/^\s*>\s?/, "")).join(" "),
                key,
                theme,
              )}
            </blockquote>
          );
        }

        return (
          <p key={key}>{renderInline(lines.join(" "), key, theme)}</p>
        );
      })}
    </div>
  );
}
