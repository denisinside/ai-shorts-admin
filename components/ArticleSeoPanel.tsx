import { cn } from "@/lib/ui";
import {
  criterionFlag,
  criterionNumber,
  qualityCriterion,
  toMetrics,
  toSections,
  toSeo,
  type Day3Article,
} from "@/lib/day-tables";
import { Badge } from "./ui/Badge";
import { CheckIcon, CloseIcon } from "./ui/icons";

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
      {children}
    </p>
  );
}

/**
 * Позначка «так / ні / рубрика цього не сказала». Живе тут, а не в `ui`, бо
 * зʼявилася заради цієї секції; розклад рубрики в `Day3Versions` бере ту саму,
 * щоб «пройдено» виглядало однаково в обох місцях.
 */
export function PassMark({ pass }: { pass: boolean | null }) {
  if (pass == null) {
    return <span className="text-xs text-ink-faint">—</span>;
  }
  const Icon = pass ? CheckIcon : CloseIcon;
  return (
    <>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", pass ? "text-ok" : "text-warn")} />
      <span className="sr-only">{pass ? "так" : "ні"}</span>
    </>
  );
}

/** Порівнюємо заголовки нормалізовано: «Заголовок» і «заголовок » — це дубль. */
function normalize(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function TextSlot({
  label,
  value,
  duplicate,
  hint,
  warnLength,
}: {
  label: string;
  value: string | undefined;
  /** З чим саме цей рядок збігається — назва поля, а не просто «дубль». */
  duplicate?: string;
  hint?: string;
  warnLength?: boolean;
}) {
  const text = (value ?? "").trim();

  return (
    <div className="min-w-0 rounded-xl bg-white/4 p-3 ring-1 ring-inset ring-white/8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubHeading>{label}</SubHeading>
        {duplicate && (
          <Badge className="bg-warn/14 text-warn ring-warn/30">
            дубль: {duplicate}
          </Badge>
        )}
      </div>
      <p
        className={cn(
          "mt-1.5 text-sm leading-relaxed",
          text ? "text-ink" : "text-ink-faint italic",
        )}
      >
        {text || "порожнє"}
      </p>
      <p
        className={cn(
          "tabular mt-1.5 text-xs",
          warnLength ? "text-warn" : "text-ink-faint",
        )}
      >
        {text.length} символів{hint ? ` · ${hint}` : ""}
      </p>
    </div>
  );
}

/** Пара «підпис — значення» для рядків, де важлива саме цифра. */
function Stat({
  label,
  children,
  bad,
}: {
  label: string;
  children: React.ReactNode;
  bad?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ring-1 ring-inset",
        bad
          ? "bg-warn/10 text-warn ring-warn/25"
          : "bg-white/4 text-ink-muted ring-white/8",
      )}
    >
      {label}
      <span className="tabular font-medium">{children}</span>
    </span>
  );
}

/**
 * SEO-частина картки Дня 3. Існує тому, що всі мета-поля тепер пише окремий
 * агент останнім проходом, а панель показувала з них три — і людина
 * затверджувала статтю, не бачачи того, за що цей агент відповідає.
 *
 * Головне тут не список полів, а ПОРІВНЯННЯ: три заголовки поруч і два описи
 * поруч, бо найчастіша помилка проходу — однаковий рядок у кількох полях, і
 * поодинці кожне з них виглядає бездоганно.
 */
export default function ArticleSeoPanel({ article }: { article: Day3Article }) {
  const seo = toSeo(article.seo);
  const metrics = toMetrics(article.metrics);
  const hygiene = qualityCriterion(metrics, "seo_hygiene");
  const depth = qualityCriterion(metrics, "seo_depth");
  const style = qualityCriterion(metrics, "style_compliance");
  const sectionsTotal = toSections(article.sections).length;

  const keywords = (seo?.keywords ?? []).filter(
    (word) => typeof word === "string" && word.trim().length > 0,
  );

  // Порожнє поле не має ховати сусіднє заповнене — саме через це раніше
  // зникала вся секція, коли агент не написав мета-опис.
  const filledFields = [
    seo?.seo_title,
    seo?.meta_description,
    seo?.slug,
    seo?.og_title,
    seo?.og_description,
  ].filter((value) => typeof value === "string" && value.trim().length > 0);
  const hasSeo = filledFields.length > 0 || keywords.length > 0;

  // Хто з трьох заголовків із кимось збігається. H1 у порівнянні бере участь
  // на рівних: він теж заголовок сторінки, і дубль із ним такий самий дубль.
  const titles = [
    { key: "h1", label: "H1 статті", value: article.title },
    { key: "seo", label: "seo_title", value: seo?.seo_title },
    { key: "og", label: "og_title", value: seo?.og_title },
  ];
  const duplicateOf = (index: number): string | undefined => {
    const own = normalize(titles[index].value);
    if (!own) return undefined;
    const twin = titles.find(
      (other, otherIndex) =>
        otherIndex !== index && normalize(other.value) === own,
    );
    return twin?.label;
  };

  const meta = (seo?.meta_description ?? "").trim();
  const ogDescription = (seo?.og_description ?? "").trim();
  const ogDuplicatesMeta =
    Boolean(ogDescription) && normalize(ogDescription) === normalize(meta);

  // internal_links лежить окремо від рубрики (він факт про статтю, а не
  // оцінка), але в seo_depth є копія — читаємо обидва, бо в старих рядках
  // могло не бути жодного з них.
  const linksApplied =
    metrics?.internal_links?.applied ??
    (depth ? criterionNumber(depth, "internal_links") : null);
  const linkCandidates =
    metrics?.internal_links?.candidates ??
    (depth ? criterionNumber(depth, "link_candidates") : null);
  const altCovered = depth ? criterionNumber(depth, "alt_covered") : null;
  const imagesTotal = depth ? criterionNumber(depth, "images_total") : null;
  const h2Count = hygiene ? criterionNumber(hygiene, "h2_count") : null;
  const keywordsAbsent = depth
    ? criterionNumber(depth, "keywords_absent_in_text")
    : null;
  const keywordsDuplicated = depth
    ? criterionNumber(depth, "keywords_duplicated")
    : null;

  // Нуль порушень — норма, а не досягнення, тому «погано» тут лише не-нуль.
  // Виноси й списки читаються навпаки: виносів має бути стільки ж, скільки
  // розділів, а списків — не більше одного на розділ.
  const styleSections = style ? criterionNumber(style, "sections_total") : null;
  const takeaways = style ? criterionNumber(style, "takeaway_lines") : null;
  const worstLists = style
    ? criterionNumber(style, "lists_worst_section")
    : null;
  const styleCounters: Array<{ label: string; value: number; bad: boolean }> =
    [];
  const pushCounter = (label: string, value: number | null, limit = 0) => {
    if (value == null) return;
    styleCounters.push({ label, value, bad: value > limit });
  };
  if (style) {
    pushCounter("підсилювачі", criterionNumber(style, "intensifiers"));
    pushCounter("звертань на «ви»", criterionNumber(style, "formal_address"));
    pushCounter("двокрапок у заголовках", criterionNumber(style, "colon_headings"));
    pushCounter("пунктів «**Слово:**»", criterionNumber(style, "bullet_colon"));
    if (styleSections != null && takeaways != null) {
      pushCounter("розділів без рядка-виносу", styleSections - takeaways);
    }
    pushCounter("найбільше списків у розділі", worstLists, 1);
    pushCounter("порожнє відкриття вступу", criterionNumber(style, "banned_opener"));
  }

  return (
    <div className="space-y-3 border-t border-white/6 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubHeading>SEO</SubHeading>
        {seo?.slug ? (
          <p className="tabular font-mono text-xs text-arc">/{seo.slug}</p>
        ) : (
          <p className="text-xs text-warn">slug не заданий</p>
        )}
      </div>

      {!hasSeo && (
        <p className="rounded-lg bg-warn/8 px-3 py-2 text-xs leading-relaxed text-warn ring-1 ring-inset ring-warn/20">
          SEO-агент не заповнив поля — стаття піде у видачу з тим, що вирахує
          сама сторінка
        </p>
      )}

      {/* Три заголовки поруч: дубль видно оком, а не звірянням двох екранів */}
      <div className="grid gap-2 sm:grid-cols-3">
        {titles.map((title, index) => (
          <TextSlot
            key={title.key}
            label={title.label}
            value={title.value}
            duplicate={duplicateOf(index)}
          />
        ))}
      </div>

      {/* 140–160 — межа, за якою рубрика вже не ставить pass за гігієну, тому
          довжина мусить бути видна біля самого тексту, а не лише в рубриці */}
      <div className="grid gap-2 sm:grid-cols-2">
        <TextSlot
          label="meta_description"
          value={meta}
          hint="норма 140–160"
          warnLength={Boolean(meta) && (meta.length < 140 || meta.length > 160)}
        />
        <TextSlot
          label="og_description"
          value={ogDescription}
          duplicate={ogDuplicatesMeta ? "meta_description" : undefined}
        />
      </div>

      {keywords.length > 0 && (
        <div className="space-y-1.5">
          <SubHeading>Ключові слова</SubHeading>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((word, index) => (
              <span
                key={`${word}-${index}`}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs",
                  // Перше ключове — головне: під нього писався весь текст, і
                  // решта в рубриці міряється відносно нього
                  index === 0
                    ? "bg-arc/14 font-medium text-arc ring-1 ring-inset ring-arc/30"
                    : "bg-white/6 text-ink-muted",
                )}
              >
                {word}
              </span>
            ))}
          </div>
          {(keywordsAbsent ?? 0) > 0 && (
            <p className="text-xs text-warn">
              немає в тексті: {keywordsAbsent}
              {(keywordsDuplicated ?? 0) > 0
                ? ` · переформулювань: ${keywordsDuplicated}`
                : ""}
            </p>
          )}
        </div>
      )}

      {(hygiene || depth) && (
        <div className="space-y-1.5">
          <SubHeading>Ключове слово в розмітці</SubHeading>
          <div className="flex flex-wrap items-center gap-1.5">
            {hygiene && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/4 px-2 py-1 text-xs text-ink-muted ring-1 ring-inset ring-white/8">
                  H1
                  <PassMark pass={criterionFlag(hygiene, "h1")} />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/4 px-2 py-1 text-xs text-ink-muted ring-1 ring-inset ring-white/8">
                  перший абзац
                  <PassMark pass={criterionFlag(hygiene, "first_para")} />
                </span>
              </>
            )}
            {h2Count != null && (
              <Stat label="у H2" bad={h2Count < 2}>
                {h2Count}/{sectionsTotal}
              </Stat>
            )}
            {/* Кандидатів нуль — це перша стаття проєкту: посилатися нема на
                що, і нуль вставлених тут не докір */}
            {linksApplied != null && linkCandidates != null && (
              <Stat
                label="внутрішніх посилань"
                bad={linkCandidates > 0 && linksApplied === 0}
              >
                {linksApplied}/{linkCandidates}
              </Stat>
            )}
            {altCovered != null && imagesTotal != null && (
              <Stat label="alt" bad={altCovered < imagesTotal}>
                {altCovered}/{imagesTotal}
              </Stat>
            )}
          </div>
        </div>
      )}

      {styleCounters.length > 0 && (
        <div className="space-y-1.5">
          <SubHeading>Редакційний стандарт</SubHeading>
          <div className="flex flex-wrap gap-1.5">
            {styleCounters.map((counter) => (
              <Stat
                key={counter.label}
                label={counter.label}
                bad={counter.bad}
              >
                {counter.value}
              </Stat>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
