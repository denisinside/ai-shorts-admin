import type { Metadata } from "next";
import { createClient } from "@/lib/supabase";
import { READER_DEMO } from "@/lib/reader-demo";
import {
  isUuid,
  toReaderArticle,
  type ArticleRow,
  type ReaderArticle,
} from "@/lib/reader";
import ReaderDesktop from "@/components/reader/ReaderDesktop";

/**
 * «Wait, What?» — читацька сторінка блогу.
 *
 * Показує справжні статті Дня 3 з `day3_article`, а хвостом стрічки —
 * демонстраційні картки з макета: справжніх статей поки одиниці, і стрічка з
 * двох карток не показує ні каруселі, ні задуманої щільності сторінки.
 *
 * Дедуплікації по `day2_plan_id` тут навмисно НЕ робимо: у Дня 3 рядків на
 * проєкт багато за задумом (baseline / optimized / opt-vN), і кожен — окремий
 * прогін. Приховати частину означало б, що глибоке посилання з панелі веде на
 * картку, якої в стрічці немає. Замість цього кожна картка помічена своїм
 * походженням.
 */

/**
 * Скільки рядків тягнемо у стрічку. Стеля потрібна, бо `select("*")` несе
 * повний текст статей: без ліміту сторінка з часом почала б тягнути мегабайти.
 */
const ARTICLE_LIMIT = 24;

async function loadArticles(requestedId: string | undefined) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("day3_article")
    .select("*, projects(niche)")
    .order("created_at", { ascending: false })
    // Один прогін пише рядки з однаковим created_at до мікросекунди, тож без
    // вторинного ключа порядок стрічки був би недетермінований
    .order("id", { ascending: false })
    .limit(ARTICLE_LIMIT)
    .returns<ArticleRow[]>();

  if (error) throw new Error(error.message);

  let rows = data ?? [];

  // Кнопка «Почитати» в панелі веде на конкретний рядок, і він може бути
  // старішим за останні ARTICLE_LIMIT. Тоді доносимо його окремим запитом:
  // інакше посилання з панелі відкривало б сторінку без обіцяної статті.
  if (isUuid(requestedId) && !rows.some((row) => row.id === requestedId)) {
    const { data: single, error: singleError } = await supabase
      .from("day3_article")
      .select("*, projects(niche)")
      .eq("id", requestedId)
      .returns<ArticleRow[]>()
      .maybeSingle();

    if (singleError) throw new Error(singleError.message);
    if (single) rows = [single, ...rows];
  }

  return rows.map(toReaderArticle);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ article?: string }>;
}): Promise<Metadata> {
  const { article } = await searchParams;
  if (!article) return {};

  // Демо-картка теж має свій заголовок — вона просто живе в коді, а не в базі
  const demo = READER_DEMO.find((item) => item.id === article);
  if (demo) {
    return { title: demo.title, description: demo.excerpt };
  }

  if (!isUuid(article)) return {};

  const supabase = createClient();
  const { data } = await supabase
    .from("day3_article")
    .select("title, seo")
    .eq("id", article)
    .returns<{ title: string; seo: unknown }[]>()
    .maybeSingle();

  if (!data) return {};

  // SEO Дня 3 для цього й пишеться: seo_title — для видачі, title — H1 для
  // читача. У <title> сторінки має піти саме перший.
  const seo = (data.seo ?? {}) as {
    seo_title?: string;
    meta_description?: string;
    og_title?: string;
    og_description?: string;
  };

  return {
    title: seo.seo_title ?? data.title,
    description: seo.meta_description,
    openGraph: {
      title: seo.og_title ?? seo.seo_title ?? data.title,
      description: seo.og_description ?? seo.meta_description,
    },
  };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ article?: string }>;
}) {
  const { article: requested } = await searchParams;
  const real = await loadArticles(requested);

  // Справжні статті першими, демо — хвостом. Порядок тут, а не в компоненті:
  // компонент лише фільтрує те, що йому дали.
  const articles: ReaderArticle[] = [...real, ...READER_DEMO];

  // Невідомий id мовчки лишає сторінку без відкритого вікна: параметр міг
  // протухнути разом із видаленим рядком, і падати через це нема за чим.
  const initialArticleId =
    requested && articles.some((item) => item.id === requested)
      ? requested
      : null;

  return (
    <ReaderDesktop articles={articles} initialArticleId={initialArticleId} />
  );
}
