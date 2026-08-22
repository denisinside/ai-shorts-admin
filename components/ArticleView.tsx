import {
  toSections,
  type ArticleSection,
  type Day3Article,
} from "@/lib/day-tables";
import { Markdown } from "./ui/Markdown";
import { Badge } from "./ui/Badge";
import { ExternalIcon, WarningIcon } from "./ui/icons";

/**
 * Стаття так, як її побачить читач: вступ (H1 → обкладинка → текст), розділи
 * (H2 → текст → картинка), висновок (H2 → текст → CTA).
 *
 * Порядок «картинка в кінці розділу» — правило верстки, у даних його немає:
 * `sections[]` несе `image_url` як звичайне поле. Тому змінити подачу можна
 * тут, не чіпаючи ні воркфлоу, ні базу.
 */

function SectionImage({
  url,
  alt,
  prompt,
}: {
  url?: string | null;
  alt?: string | null;
  prompt?: string | null;
}) {
  if (!url) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-white/4 text-xs text-ink-faint ring-1 ring-inset ring-white/8">
        Ілюстрації немає
        {prompt ? " — промпт є, генерація не дійшла" : ""}
      </div>
    );
  }

  return (
    <figure className="space-y-2">
      {/* Довільні зовнішні URL із пайплайну — next/image тут вимагав би
          вносити кожен хост у remotePatterns */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt ?? ""}
        className="w-full rounded-xl object-cover ring-1 ring-inset ring-white/10"
      />
      {alt && (
        <figcaption className="text-xs text-ink-faint">{alt}</figcaption>
      )}
    </figure>
  );
}

function SourceList({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
      {urls.map((url) => {
        let host = url;
        try {
          host = new URL(url).host.replace(/^www\./, "");
        } catch {
          /* пайплайн міг покласти не-URL — показуємо як є */
        }
        return (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-arc"
            >
              <ExternalIcon className="h-3 w-3" />
              {host}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Section({
  section,
  index,
}: {
  section: ArticleSection;
  index: number;
}) {
  // plan_index приходить із воркфлоу і може розійтися з фактичним порядком,
  // якщо розділ загубився. Мовчати про це не можна: саме так «стаття за
  // планом» тихо перестає бути статтею за планом.
  const drifted =
    typeof section.plan_index === "number" && section.plan_index !== index;

  return (
    <section className="space-y-3 border-t border-white/6 pt-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-lg font-semibold text-ink">
          {section.h2 ?? `Розділ ${index + 1}`}
        </h3>
        {typeof section.words === "number" && (
          <span className="tabular text-xs text-ink-faint">
            {section.words} слів
          </span>
        )}
        {drifted && (
          <Badge className="bg-warn/14 text-warn ring-warn/30">
            <WarningIcon className="h-3 w-3" />
            план №{section.plan_index}
          </Badge>
        )}
      </div>

      <Markdown>{section.body_md}</Markdown>
      <SourceList urls={section.source_urls} />
      <SectionImage
        url={section.image_url}
        alt={section.image_alt}
        prompt={section.image_prompt}
      />
    </section>
  );
}

export default function ArticleView({ article }: { article: Day3Article }) {
  const sections = toSections(article.sections);

  return (
    <article className="space-y-5">
      {/* ---- блок вступу ---- */}
      <header className="space-y-3">
        <h2 className="text-xl font-semibold leading-snug text-ink">
          {article.title}
        </h2>
        <SectionImage url={article.thumbnail_url} alt="Обкладинка статті" />
        <Markdown>{article.intro}</Markdown>
      </header>

      {/* ---- розділи ---- */}
      {sections.length === 0 ? (
        <p className="rounded-lg bg-warn/8 px-3 py-2 text-xs text-warn ring-1 ring-inset ring-warn/20">
          Розділів немає — стаття складається лише зі вступу й висновку
        </p>
      ) : (
        sections.map((section, index) => (
          <Section key={index} section={section} index={index} />
        ))
      )}

      {/* ---- висновок: без картинки й підрозділів, це його форма ---- */}
      <section className="space-y-3 border-t border-white/6 pt-5">
        <h3 className="text-lg font-semibold text-ink">
          {article.conclusion_h2}
        </h3>
        <Markdown>{article.conclusion}</Markdown>
        {article.cta && (
          <p className="rounded-xl bg-arc/10 px-3.5 py-2.5 text-sm font-medium text-arc ring-1 ring-inset ring-arc/25">
            {article.cta}
          </p>
        )}
      </section>
    </article>
  );
}
