"use client";

import { useEffect, useMemo, useState } from "react";

import type { SlangEntry, SlangIndexEntry } from "@/lib/slang";
import { loadSlangEntry, type SlangIndex } from "@/lib/slang-client";
import { cn } from "@/lib/ui";

/**
 * Вміст двох словникових вікон: статті одного слова і загального словника.
 *
 * Вигляд статті знято зі вбудованого словника macOS: гасло великим засічковим
 * шрифтом, грамата курсивом одразу під ним, значення суцільним абзацом,
 * приклади курсивом із відступом. Хром вікна лишається ретро-системним
 * (`DesktopWindow`) — контраст навмисний: стіл із дев'яностих, а всередині
 * сучасна словникова панель.
 *
 * Чому вміст тут, а не в `ReaderDesktop`: там уже 700 рядків стану робочого
 * столу, і словник до цього стану не має стосунку. Так само живуть
 * `ToolWindows`.
 */

const REGISTER_HINT: Record<string, string> = {
  нейтральний: "звичайне слово, доречне майже де завгодно",
  схвальний: "похвала",
  іронічний: "з підколкою",
  зневажливий: "з осудом",
  образливий: "образа",
  вульгарний: "груба лексика",
  дитячий: "мова молодших підлітків",
};

const SOURCE_LABEL: Record<string, string> = {
  gabb: "Gabb",
  axis: "Axis",
  simplified: "Simplified",
};

/* ------------------------------------------------------------ стаття слова */

export function DictionaryEntryBody({
  entryKey,
  fallback,
  onLookup,
}: {
  entryKey: string;
  /** Рядок індексу: показуємо гасло й короткий опис, поки їде повна стаття. */
  fallback: SlangIndexEntry | undefined;
  onLookup: (key: string) => void;
}) {
  // Результат тримається РАЗОМ із ключем, а не окремим станом «завантажую»:
  // інакше скидати прапорець довелося б синхронно в ефекті, а це і зайвий
  // рендер, і те, на що справедливо свариться react-hooks.
  const [result, setResult] = useState<{ key: string; entry: SlangEntry | null } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    loadSlangEntry(entryKey).then((loaded) => {
      if (alive) setResult({ key: entryKey, entry: loaded });
    });
    return () => {
      alive = false;
    };
  }, [entryKey]);

  const ready = result?.key === entryKey;
  const entry = ready ? result.entry : null;
  const failed = ready && !result.entry;

  const headword = entry?.term ?? fallback?.term ?? entryKey;
  const grammar = entry?.partOfSpeech ?? fallback?.partOfSpeech ?? "";
  const register = entry?.register ?? fallback?.register ?? "";
  const short = entry?.short ?? fallback?.short ?? "";

  return (
    <div className="dict-body">
      <article className="dict-entry">
        <h3 className="dict-headword">{headword}</h3>
        {(grammar || register) && (
          <p className="dict-grammar">
            <em>{grammar}</em>
            {register && (
              <>
                {" · "}
                <span title={REGISTER_HINT[register] ?? ""}>{register}</span>
              </>
            )}
          </p>
        )}

        {short && <p className="dict-sense">{short}</p>}

        {entry ? (
          <>
            <p className="dict-text">{entry.explanation}</p>

            {entry.ukEquivalents.length > 0 && (
              <p className="dict-line">
                <span className="dict-label">українською</span>{" "}
                {entry.ukEquivalents.join(", ")}
              </p>
            )}

            {entry.examples.length > 0 && (
              <ol className="dict-examples">
                {entry.examples.map((example, position) => (
                  <li key={position}>
                    <span className="dict-example-en">{example.en}</span>
                    <span className="dict-example-uk">{example.uk}</span>
                  </li>
                ))}
              </ol>
            )}

            {entry.aka.length > 0 && (
              <p className="dict-line">
                <span className="dict-label">також пишуть</span> {entry.aka.join(", ")}
              </p>
            )}

            {(entry.enSynonyms.length > 0 || entry.related.length > 0) && (
              <p className="dict-line">
                <span className="dict-label">поруч</span>{" "}
                {[...entry.enSynonyms, ...entry.related].map((word, position) => (
                  <span key={`${word}-${position}`}>
                    {position > 0 && ", "}
                    <button
                      type="button"
                      className="dict-jump"
                      onClick={() => onLookup(word.toLowerCase())}
                    >
                      {word}
                    </button>
                  </span>
                ))}
              </p>
            )}

            {(entry.sources.length > 0 || entry.urbanPermalinks.length > 0) && (
              <footer className="dict-sources">
                <span className="dict-label">звідки</span>{" "}
                {entry.sources.map((source, position) => (
                  <span key={source.url}>
                    {position > 0 && " · "}
                    <a href={source.url} target="_blank" rel="noreferrer noopener">
                      {SOURCE_LABEL[source.source] ?? source.source}
                    </a>
                  </span>
                ))}
                {entry.urbanPermalinks[0] && (
                  <>
                    {entry.sources.length > 0 && " · "}
                    <a
                      href={entry.urbanPermalinks[0]}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Urban Dictionary
                    </a>
                  </>
                )}
              </footer>
            )}
          </>
        ) : failed ? (
          <p className="dict-text dict-muted">
            Не дістав повну статтю. Спробуй закрити й відкрити ще раз.
          </p>
        ) : (
          <p className="dict-text dict-muted">гортаю словник…</p>
        )}
      </article>
    </div>
  );
}

/* --------------------------------------------------------- увесь словник */

const GROUP_OTHER = "#";

/** Літера, під якою слово стоїть у списку. Цифри й символи — в одну купу. */
function groupOf(entry: SlangIndexEntry): string {
  const first = entry.key.charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : GROUP_OTHER;
}

export function SlangBookBody({
  index,
  onLookup,
}: {
  index: SlangIndex | null;
  onLookup: (key: string) => void;
}) {
  const [query, setQuery] = useState("");

  const all = useMemo(
    () => (index ? [...index.byKey.values()] : []),
    [index],
  );

  const found = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    // Шукаємо і по написаннях, і по українських відповідниках у короткому
    // описі: людина частіше приходить із «як сказати брехня», ніж із «cap».
    return all.filter(
      (entry) =>
        entry.key.includes(needle) ||
        entry.term.toLowerCase().includes(needle) ||
        entry.short.toLowerCase().includes(needle) ||
        entry.aka.some((form) => form.toLowerCase().includes(needle)),
    );
  }, [all, query]);

  const groups = useMemo(() => {
    const map = new Map<string, SlangIndexEntry[]>();
    for (const entry of found) {
      const letter = groupOf(entry);
      const bucket = map.get(letter);
      if (bucket) bucket.push(entry);
      else map.set(letter, [entry]);
    }
    // Цифри й символи — в кінець списку, як у будь-якому словнику
    return [...map.entries()].sort(([a], [b]) => {
      if (a === GROUP_OTHER) return 1;
      if (b === GROUP_OTHER) return -1;
      return a.localeCompare(b);
    });
  }, [found]);

  if (!index) {
    return (
      <div className="dict-body">
        <p className="dict-text dict-muted">гортаю словник…</p>
      </div>
    );
  }

  return (
    <div className="dict-body slangbook">
      <div className="slangbook-search">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Слово або значення"
          aria-label="Пошук у словнику"
        />
        {/* Лічильник справжній, а не намальований: у цій читалці намальована
            цифра на сторінці, під'єднаній до бази, — це просто неправда */}
        <span className="slangbook-count">
          {found.length === all.length
            ? `${all.length} слів`
            : `${found.length} з ${all.length}`}
        </span>
      </div>

      {groups.length === 0 && (
        <p className="dict-text dict-muted">Нічого не знайшлося. Спробуй інакше.</p>
      )}

      <div className="slangbook-list">
        {groups.map(([letter, entries]) => (
          <section key={letter} className="slangbook-group">
            <h4 className="slangbook-letter">{letter}</h4>
            <ul>
              {entries.map((entry) => (
                <li key={entry.key}>
                  <button type="button" onClick={() => onLookup(entry.key)}>
                    <span className="slangbook-term">{entry.term}</span>
                    <span
                      className={cn(
                        "slangbook-short",
                        entry.ambiguous && "is-ambiguous",
                      )}
                      title={
                        entry.ambiguous
                          ? "Це слово є і звичайним англійським — у чаті воно не підкреслюється"
                          : undefined
                      }
                    >
                      {entry.short}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
