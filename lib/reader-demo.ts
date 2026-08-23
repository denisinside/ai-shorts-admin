import type { ReaderArticle } from "./reader";

/**
 * Демонстраційні картки з макета `Wait-What-Homepage-2.html`.
 *
 * Навіщо вони лишилися: справжніх статей у базі поки одиниці, а стрічка з
 * двома картками не показує ні каруселі, ні задуманої щільності сторінки.
 * Тому реальні статті йдуть першими, а ці — хвостом, і кожна помічена
 * `demo: true`: картка з макета мусить бути видимо іншою, інакше за тиждень
 * ніхто не згадає, що за нею немає рядка в базі.
 *
 * Тексти лишені як у макеті (англійською) навмисно — це його вміст, а не наш
 * контент. Перекласти їх означало б вдавати, що це справжні матеріали.
 */

const DEMO_COVERS = [
  "/waitwhat/mock-1.webp",
  "/waitwhat/mock-2.webp",
  "/waitwhat/mock-3.webp",
  "/waitwhat/mock-4.webp",
] as const;

type DemoSeed = {
  title: string;
  category: string;
  minutes: number;
  excerpt: string;
  accent: string;
};

const SEEDS: DemoSeed[] = [
  {
    title: "Why Doesn’t Gen Z Like Phone Calls?",
    category: "Relationships",
    minutes: 7,
    excerpt:
      "For many Gen Zers, an unexpected call feels like an interruption, while a message gives them time to think, respond, and keep a record of the conversation.",
    accent: "#ff63a8",
  },
  {
    title: "What Does “Delulu” Mean?",
    category: "Glossary",
    minutes: 6,
    excerpt:
      "Delulu began as shorthand for delusional and became a playful way to describe wildly optimistic confidence: sometimes ironic, sometimes genuinely motivating.",
    accent: "#38a9ff",
  },
  {
    title: "How TikTok Changed Search",
    category: "Technology",
    minutes: 8,
    excerpt:
      "Younger users increasingly look for firsthand demonstrations, comments, and visual context instead of opening a traditional list of blue links.",
    accent: "#5b84ff",
  },
  {
    title: "Quiet Quitting Without the Panic",
    category: "Work",
    minutes: 6,
    excerpt:
      "Quiet quitting usually means protecting the boundaries of a role—not abandoning work. The useful question is what changed in expectations, recognition, and trust.",
    accent: "#6c8cff",
  },
];

/**
 * У макета в картки був лише анотація — жодних розділів. Тому вікно статті
 * показує вступ і зупиняється: домальовувати демо-картці фальшиві розділи
 * означало б навчити сторінку показувати текст, якого ніхто не писав.
 */
export const READER_DEMO: ReaderArticle[] = SEEDS.map((seed, index) => ({
  id: `demo-${index + 1}`,
  title: seed.title,
  category: seed.category,
  excerpt: seed.excerpt,
  minutes: seed.minutes,
  cover: DEMO_COVERS[index],
  accent: seed.accent,

  intro: seed.excerpt,
  sections: [],
  conclusionH2: null,
  conclusion: null,
  cta: null,
  seo: null,

  demo: true,
  pipeline: null,
  variant: null,
  approved: false,
  needsReview: false,
  createdAt: null,
  projectId: null,
  words: seed.minutes * 200,
}));
