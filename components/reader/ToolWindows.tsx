"use client";

import { glossaryTerms, type ReaderArticle } from "@/lib/reader";

/**
 * Вміст трьох вікон, які відкриваються так само, як «Welcome» і WaitBot.
 *
 * Спільне правило: вікно має показувати ДАНІ, а не декор. Глосарій зібраний із
 * `seo.keywords` реальних статей, «Свіже» — зі справжніх дат, «Про студію»
 * розповідає про пайплайн, який ці статті й пише. Вікно з намальованими
 * цифрами не варте того, щоб його відкривати.
 */

/* ------------------------------------------------------------------ глосарій */

export function GlossaryBody({
  articles,
  onPick,
}: {
  articles: ReaderArticle[];
  onPick: (term: string) => void;
}) {
  const terms = glossaryTerms(articles);

  return (
    <div className="tool-content">
      <p className="tool-note">
        {terms.length} термінів — зібрано з ключових слів усіх статей. Клік
        шукає термін у стрічці.
      </p>
      {terms.length === 0 ? (
        <p className="tool-empty">
          Термінів ще немає: їх дає SEO-блок статті, а він з’являється разом із
          першим прогоном Дня 3.
        </p>
      ) : (
        <div className="tool-body term-cloud">
          {terms.map((entry) => (
            <button
              key={entry.term}
              onClick={() => onPick(entry.term)}
              title={`Знайти «${entry.term}»`}
            >
              {entry.term}
              {entry.count > 1 && <b>{entry.count}</b>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- свіже */

export function FeedBody({
  articles,
  onOpen,
}: {
  articles: ReaderArticle[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="tool-content">
      <p className="tool-note">
        Найновіше зверху. Дата — коли пайплайн записав статтю в базу.
      </p>
      <div className="tool-body">
        <ul className="feed-list">
          {articles.map((article) => (
            <li key={article.id}>
              <button onClick={() => onOpen(article.id)}>
                <span
                  className="feed-dot"
                  aria-hidden="true"
                  style={{ background: article.accent }}
                />
                <span className="feed-text">
                  <strong>{article.title}</strong>
                  <small>
                    {article.category} · {article.minutes} хв
                    {article.createdAt
                      ? ` · ${new Date(article.createdAt).toLocaleDateString("uk-UA")}`
                      : " · демо"}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- про студію */

export function AboutBody({
  counts,
}: {
  counts: { all: number; ready: number; draft: number; demo: number };
}) {
  return (
    <div className="tool-content">
      <p className="tool-note">
        Це не редакція. Статті тут пише конвеєр із чотирьох днів, а людина
        вирішує, що з них піде далі.
      </p>
      <div className="tool-body">
        <ol className="pipeline-list">
          <li>
            <b>День 1</b>
            <span>
              Про що писати. Пошук трендів і сирих джерел — далі людина
              затверджує тему.
            </span>
          </li>
          <li>
            <b>День 2</b>
            <span>
              Яку тему беремо і як будуємо: одна тема, структура розділів і
              гачки. Теж із затвердженням.
            </span>
          </li>
          <li>
            <b>День 3</b>
            <span>
              Текст під готовий план: вступ, розділи з ілюстраціями, висновок,
              SEO. Саме ці рядки ви й читаєте.
            </span>
          </li>
          <li>
            <b>День 4</b>
            <span>Відео за статтею: шотлист, озвучка, рендер.</span>
          </li>
        </ol>

        <dl className="about-stats">
          <div>
            <dt>у стрічці</dt>
            <dd>{counts.all}</dd>
          </div>
          <div>
            <dt>затверджено</dt>
            <dd>{counts.ready}</dd>
          </div>
          <div>
            <dt>чернеток</dt>
            <dd>{counts.draft}</dd>
          </div>
          <div>
            <dt>з макета</dt>
            <dd>{counts.demo}</dd>
          </div>
        </dl>

        <p className="tool-fine">
          «Чернетка» означає, що рішення по статті ще не ухвалене — вона видима,
          але не затверджена. «Демо» — картка з макета, за нею немає рядка в
          базі.
        </p>
      </div>
    </div>
  );
}
