"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/ui";
import { Markdown } from "@/components/ui/Markdown";
import type { ReaderArticle } from "@/lib/reader";

/**
 * Вікно статті — те саме модальне вікно з макета, але всередині нього повна
 * структура з `supabase/day3-article-contract.md`:
 *
 *   H1 → обкладинка → вступ
 *   розділ: H2 → текст (підрозділи через ###) → джерела → ілюстрація
 *   висновок: H2 → текст → CTA
 *
 * «Ілюстрація в кінці розділу» — правило верстки, у даних порядку немає:
 * `sections[]` несе `image_url` звичайним полем. Тому подачу можна змінити тут,
 * не чіпаючи ні воркфлоу, ні базу — рівно як у `ArticleView` панелі.
 *
 * Висновок навмисно НЕ елемент `sections[]`: у нього інша форма (без картинки
 * й підрозділів), і саме тому він приходить окремими колонками.
 */

/** Домен замість повного URL: у стрічці джерел важливо ХТО, а не яка сторінка. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    // Пайплайн міг покласти не-URL — показуємо як є, а не ховаємо
    return url;
  }
}

function Cover({ article }: { article: ReaderArticle }) {
  if (article.cover) {
    // Довільні зовнішні URL із Supabase Storage: next/image вимагав би вносити
    // кожен хост у remotePatterns, а бакет може змінитися разом із проєктом
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={article.cover} alt="" />;
  }

  return (
    <div
      className="cover-blank"
      aria-hidden="true"
      style={{ "--article-accent": article.accent } as CSSProperties}
    >
      ✦
    </div>
  );
}

function SectionSources({ urls }: { urls?: string[] }) {
  const links = urls?.filter((url) => url.trim());
  if (!links?.length) return null;

  return (
    <ul className="article-sources">
      {links.map((url) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {hostOf(url)} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function ArticleWindow({
  article,
  saved,
  onToggleSave,
  onClose,
}: {
  article: ReaderArticle;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}) {
  const windowRef = useRef<HTMLElement | null>(null);
  // Довгу статтю читати у вікні на 820px незручно, тому «на весь екран» тут
  // не декорація: воно розтягує вікно майже на весь стіл.
  const [maxed, setMaxed] = useState(false);

  // Esc закриває вікно, а фокус їде в нього при відкритті: інакше після кліку
  // по картці читач з клавіатурою лишався б у стрічці під оверлеєм.
  useEffect(() => {
    windowRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const fileName = article.seo?.slug
    ? `waitwhat://${article.seo.slug}`
    : "waitwhat://article";

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        // Клік по підкладці закриває, клік у вікні — ні
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        ref={windowRef}
        tabIndex={-1}
        className={cn("article-modal app-window", maxed && "is-wide")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="article-modal-title"
      >
        <div className="titlebar" onDoubleClick={() => setMaxed((on) => !on)}>
          <span>{fileName}</span>
          <div className="window-controls">
            <button onClick={onClose} aria-label="Згорнути вікно">
              −
            </button>
            <button
              onClick={() => setMaxed((on) => !on)}
              aria-pressed={maxed}
              aria-label={maxed ? "Відновити розмір" : "Розгорнути на весь стіл"}
            >
              {maxed ? "❐" : "□"}
            </button>
            <button onClick={onClose} aria-label="Закрити вікно">
              ×
            </button>
          </div>
        </div>

        <Cover article={article} />

        <div className="modal-copy">
          <p className="eyebrow modal-meta">
            <span>{article.category}</span>
            <span aria-hidden="true">·</span>
            <span>{article.minutes} хв читання</span>
            {article.demo ? (
              <span className="card-flag card-flag--demo">демо</span>
            ) : (
              !article.approved && (
                <span className="card-flag card-flag--draft">чернетка</span>
              )
            )}
          </p>

          <h2 id="article-modal-title">{article.title}</h2>

          {/* Походження рядка читач мусить бачити: демо-текст і незатверджена
              чернетка виглядають як опублікований матеріал, якщо про це не
              сказати прямо. */}
          {article.demo ? (
            <p className="article-note article-note--demo">
              Демонстраційна стаття з макета: текст написаний як приклад
              верстки. За нею немає ні рядка в базі, ні прогону Дня 3 — тому
              немає й посилань на джерела.
            </p>
          ) : (
            !article.approved && (
              <p className="article-note article-note--draft">
                Чернетка: рішення по цій статті ще не ухвалене. Затверджує її
                людина — кнопкою в Discord або в адмінпанелі.
              </p>
            )
          )}

          <div className="article-body">
            {/* Вступ без власного заголовка: H1 уже вище окремою колонкою */}
            <Markdown variant="reader">{article.intro}</Markdown>

            {article.sections.map((section, index) => (
              <section key={index}>
                <h3>{section.h2 ?? `Розділ ${index + 1}`}</h3>
                <Markdown variant="reader">{section.body_md}</Markdown>
                <SectionSources urls={section.source_urls} />

                {/* Ілюстрація — у кінці розділу. Порожньої рамки читачеві не
                    показуємо: у реальних даних image_url часто порожній рядок,
                    і «немає картинки» — діагностика для панелі, не для нього. */}
                {section.image_url?.trim() && (
                  <figure className="article-figure">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={section.image_url}
                      alt={section.image_alt ?? ""}
                    />
                    {section.image_alt && (
                      <figcaption>{section.image_alt}</figcaption>
                    )}
                  </figure>
                )}
              </section>
            ))}

            {article.conclusion && (
              <section>
                <h3>{article.conclusionH2 ?? "Висновок"}</h3>
                <Markdown variant="reader">{article.conclusion}</Markdown>
                {article.cta && <p className="article-cta">{article.cta}</p>}
              </section>
            )}
          </div>

          <div className="article-footer">
            <button
              className={saved ? "save-button saved" : "save-button"}
              onClick={onToggleSave}
              aria-pressed={saved}
            >
              {saved ? "✓ ЗБЕРЕЖЕНО" : "♡ ЗБЕРЕГТИ"}
            </button>

            {/* Дорога назад у панель: читалку відкривають саме звідти, і
                перевірити метрики прогону хочеться на тому ж рядку */}
            {article.projectId && (
              <a
                className="panel-link"
                href={`/projects/${article.projectId}?article=${article.id}#day-3`}
              >
                Відкрити в панелі ↗
              </a>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
