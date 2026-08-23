import type { ArticleSection } from "./day-tables";
import type { ReaderArticle } from "./reader";

/**
 * Демонстраційні статті з макета `Wait-What-Homepage-2.html`.
 *
 * Навіщо вони лишилися: справжніх статей у базі поки одиниці, а стрічка з
 * двома картками не показує ні каруселі, ні задуманої щільності сторінки.
 * Тому реальні статті йдуть першими, а ці — хвостом, і кожна помічена
 * `demo: true`: картка з макета мусить бути видимо іншою, інакше за тиждень
 * ніхто не згадає, що за нею немає рядка в базі.
 *
 * Тексти англійською — як заголовки й анотації в макеті. Це його вміст, а не
 * наш контент: перекласти половину означало б зробити статтю двомовною.
 *
 * Структура повторює `day3_article`: вступ без власного заголовка, розділи з
 * `###` підрозділами, висновок окремо від розділів. Так вікно статті показує
 * ту саму верстку, що й для рядка з бази, а не спрощену гілку.
 *
 * `source_urls` тут порожні навмисно: вигадане посилання виглядало б як
 * справжнє джерело. Ланцюг чесності Дня 1 → 2 → 3 демонструють реальні
 * статті, у яких Tavily справді щось знайшов.
 */

/** Слів на хвилину — та сама константа, що й для статей із бази. */
const WORDS_PER_MINUTE = 200;

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

type DemoSeed = {
  title: string;
  category: string;
  accent: string;
  cover: string;
  excerpt: string;
  intro: string;
  sections: { h2: string; body: string }[];
  conclusionH2: string;
  conclusion: string;
  cta: string;
  slug: string;
  keywords: string[];
};

const SEEDS: DemoSeed[] = [
  {
    title: "Why Doesn’t Gen Z Like Phone Calls?",
    category: "Relationships",
    accent: "#ff63a8",
    cover: "/waitwhat/mock-1.webp",
    excerpt:
      "For many Gen Zers, an unexpected call feels like an interruption, while a message gives them time to think, respond, and keep a record of the conversation.",
    intro: `An unannounced call lands differently depending on when you grew up. If the phone was the only way to reach a friend, ringing was simply how conversation started. If you grew up with a device that carries twenty other channels, a ring is one option out of many — and the only one that demands you drop everything right now.

That is the whole disagreement in one sentence. Older colleagues read a quick call as efficient and warm. Younger ones read the same call as an interruption that arrived without asking. Neither reading is wrong, and neither is really about the telephone.`,
    sections: [
      {
        h2: "The call is not the problem — the ambush is",
        body: `Ask a twenty-three-year-old why they let a call ring out and you rarely hear "I hate talking." You hear that they were mid-task, or on a bus, or with someone else, and that answering would have meant performing attentiveness they did not have. A message asks for a reply. A call asks for a reply *immediately*, in a voice, with no preparation.

### Synchronous by default versus by agreement

Most of what younger workers do all day is asynchronous. Documents get comments, threads get replies, and nobody expects an answer inside ten seconds. Against that background a call is not simply another channel — it is a channel that overrides all the others. The objection is to the override, not to the conversation.

This is why "can I call you in five?" changes the mood so completely. The call still happens, the conversation is still voice, but consent moved to the front. Almost every generational complaint about phone calls dissolves once the call is scheduled instead of sprung.

### The cost of being caught unprepared

Voice leaves no draft. There is no chance to check a number, soften a sentence, or reread what you just committed to. For anyone who grew up editing before sending, that feels less like intimacy and more like being asked to improvise in public.`,
      },
      {
        h2: "Text keeps a record, and records are useful",
        body: `The second reason is boring and practical: writing leaves evidence. A deadline agreed in a message can be reread. A deadline agreed on a call has to be remembered, and remembered identically by two people who are both slightly distracted.

### Memory that does not depend on goodwill

Younger workers have generally been trained — by group chats, by shared docs, by a few bad experiences — to put anything that matters in writing. When a manager says "just give me a ring and we'll sort it out," the reflex is not defiance. It is the reasonable thought that a sorted-out thing which exists only in two heads is not really sorted out.

### Search, not recall

There is also retrieval. A written thread can be searched months later for the one detail that turns out to matter. Voice cannot. For a generation used to finding anything in seconds, a conversation with no searchable trace feels like work that has to be done twice.`,
      },
      {
        h2: "What actually works across the gap",
        body: `The useful move is not to insist that everyone learn to love ringing phones. It is to name which channel a given conversation deserves, and to say so out loud.

### Match the channel to the stakes

Anything sensitive, ambiguous, or emotionally loaded is better in voice — text flattens tone and invites the worst available reading. Anything factual, numeric, or scheduling-related is better in writing, where it can be checked. Most friction between generations at work comes from putting the wrong conversation in the wrong container.

### Small courtesies that cost nothing

Send a line before you call, so the call arrives expected. Say roughly how long it will take. After a substantive call, drop two sentences in writing about what was decided — the person who wanted text and the person who wanted voice both get what they needed. That is the entire fix, and it is cheaper than a generational theory.`,
      },
    ],
    conclusionH2: "Not phone-phobia, just different defaults",
    conclusion: `Gen Z is not afraid of the telephone. They grew up with a default of asking before interrupting, and with an assumption that important things get written down. A ringing phone breaks both defaults at once, which is why it reads as rude rather than efficient — and why announcing the call in advance fixes almost all of it.

Read the reluctance as a preference about consent and record-keeping and it stops looking like a character flaw. It starts looking like something you can work with in about two sentences.`,
    cta: "Sending this to a colleague who still calls unannounced? Try scheduling the next one and see what changes.",
    slug: "why-gen-z-avoids-phone-calls",
    keywords: [
      "phone calls",
      "gen z communication",
      "async work",
      "workplace norms",
    ],
  },
  {
    title: "What Does “Delulu” Mean?",
    category: "Glossary",
    accent: "#38a9ff",
    cover: "/waitwhat/mock-2.webp",
    excerpt:
      "Delulu began as shorthand for delusional and became a playful way to describe wildly optimistic confidence: sometimes ironic, sometimes genuinely motivating.",
    intro: `"Delulu" is a clipped, sing-song version of *delusional*, and it has travelled a long way from the insult it started as. Today it is mostly said with affection, often about oneself, and usually about believing something improbable on purpose.

The word is a good example of how internet slang works now: a term gets shortened, the shortening makes it sound softer, and the softer sound lets it carry a meaning the original never could.`,
    sections: [
      {
        h2: "Where the word came from",
        body: `Delulu surfaced in online fandom spaces, where it described fans convinced that an idol was secretly in love with them or that two celebrities were secretly together. It was mocking, but gently — the kind of mockery aimed at people you share a group chat with.

### From fandom to everyday speech

The jump to general use happened when people started applying it to themselves. Saying "I'm delulu about this job application" is not a confession of madness; it is a way of admitting the odds are bad while refusing to act like they are. The self-directed version is now far more common than the original accusation.

### Why the shortening matters

*Delusional* is clinical and heavy. *Delulu* is four syllables of nonsense that sound like a nursery rhyme. That tonal shift is the whole point: it lets a speaker gesture at irrationality without claiming anything serious about their mental state.`,
      },
      {
        h2: "The motivational turn",
        body: `A second, sincerer usage grew alongside the joke. "Delulu is the solulu" — delusion is the solution — became a half-ironic slogan for acting as if a good outcome is already certain.

### Manifesting, with the embarrassment removed

Stripped of the rhyme, this is ordinary self-belief: apply for the role you are underqualified for, ask for the raise, send the message. Framing it as delusion gives people permission to try without sounding earnest, which is often the actual barrier.

### Where it stops being useful

The obvious failure mode is treating confidence as a substitute for preparation. Being delulu about a marathon you have not trained for is not optimism, and the slang does nothing to change that. Most fluent users of the word know this and deploy it for low-stakes gambles, not for decisions that need evidence.`,
      },
      {
        h2: "How to read it in the wild",
        body: `Context does almost all the work. The same four syllables can be a tease, a boast, or a small act of courage.

### Three quick readings

Aimed at someone else, in a group chat, it is usually teasing and affectionate. Aimed at oneself before an attempt, it is a shrug at the odds. Attached to a plan with real consequences, it is often a genuine warning dressed as a joke — the speaker knows the plan is thin.

### Using it without sounding like a tourist

The tone is light and self-aware; delivered seriously it lands badly. If you are older than the word and want to use it, aim it at yourself and keep the stakes small. That is how most people use it anyway.`,
      },
    ],
    conclusionH2: "A soft word for a hard feeling",
    conclusion: `Delulu survives because it names something that had no comfortable label: choosing to believe an unlikely thing, while knowing it is unlikely. Calling that delusion is too harsh, calling it hope is too sincere, and the nonsense word sits neatly between the two.

Like most successful slang, it is less about the definition than about the permission it grants. It lets people try things out loud.`,
    cta: "Come across a term you cannot place? Search the glossary — it is built from the keywords of every article here.",
    slug: "what-does-delulu-mean",
    keywords: ["delulu", "gen z slang", "glossary", "manifesting"],
  },
  {
    title: "How TikTok Changed Search",
    category: "Technology",
    accent: "#5b84ff",
    cover: "/waitwhat/mock-3.webp",
    excerpt:
      "Younger users increasingly look for firsthand demonstrations, comments, and visual context instead of opening a traditional list of blue links.",
    intro: `For a long time, looking something up meant typing words into a box and reading a list of links. That habit is not gone, but for a large group of people it is no longer the first move. The first move is a video.

The shift is not really about one app beating another. It is about what counts as a satisfying answer — and for a lot of questions, a stranger showing you the thing beats a page describing it.`,
    sections: [
      {
        h2: "The questions video answers better",
        body: `Search engines are excellent at facts with a single correct answer: dates, spellings, conversions, opening hours. They are weaker at questions where the real answer is *what does this look like when it goes right*.

### Show me, do not tell me

"How do I fold a fitted sheet" is a demonstration, not a paragraph. So is "does this jacket look boxy on someone my height," "is this restaurant actually loud," and "what happens if I skip this step." Video answers those in fifteen seconds with no reading and no ambiguity.

### Judgement questions

There is a second category: questions where the honest answer is a matter of taste. Whether a haircut suits round faces, whether a game is worth the money, whether a city is walkable. Here people are not looking for a fact but for a sample of opinions from people who seem like them — which is closer to browsing than to searching.`,
      },
      {
        h2: "Comments as the real result",
        body: `A quietly important part of this behaviour is that the video is often not the destination. The comments are.

### Crowd-sourced fact-checking

Experienced users open a video and scroll straight past it. The comments say whether the recipe actually works, whether the product broke after a month, whether the creator was paid to say this. It functions as a rough, fast peer review — unreliable in individual cases, surprisingly useful in aggregate.

### Trust in people over pages

Underneath is a shift in where trust sits. A ranked page is trusted because a system put it first. A comment is trusted because a person with nothing to gain wrote it. Anyone who has waded through pages of near-identical listicles understands the appeal of the second option, whatever its flaws.`,
      },
      {
        h2: "What it changes for anyone publishing",
        body: `If part of your audience starts inside a video app, the old assumptions about how they arrive stop holding.

### Answer the question in the first seconds

Video-native search rewards the opposite of a long windup. The claim goes first, the reasoning follows. That instinct transfers to text: a page that answers in its first two sentences does better with readers arriving from this habit than one that builds slowly to a conclusion.

### Two habits, not a replacement

It is worth being precise: nobody has stopped using search engines. People run both habits, choosing by question type — facts in the box, demonstrations and opinions in the feed. Planning for one and ignoring the other loses half the audience either way.`,
      },
    ],
    conclusionH2: "A second habit, not a funeral",
    conclusion: `Search did not die and get replaced. It gained a competitor that is better at a specific class of question — the ones where seeing beats reading and where a crowd of opinions beats a single authoritative page.

The practical takeaway is unglamorous. Know which of your questions are facts and which are demonstrations, and stop being surprised when people take the second kind somewhere else.`,
    cta: "Curious how these articles get written? The About window explains the four-day pipeline behind them.",
    slug: "how-tiktok-changed-search",
    keywords: ["search behaviour", "tiktok", "discovery", "seo"],
  },
  {
    title: "Quiet Quitting Without the Panic",
    category: "Work",
    accent: "#6c8cff",
    cover: "/waitwhat/mock-4.webp",
    excerpt:
      "Quiet quitting usually means protecting the boundaries of a role—not abandoning work. The useful question is what changed in expectations, recognition, and trust.",
    intro: `Few workplace phrases have been misread as thoroughly as "quiet quitting." It sounds like sabotage and it is usually the opposite: doing the job as described, on the hours agreed, and declining the unpaid extras that had quietly become mandatory.

Which means the interesting question is not how to stop it. It is why the described job and the actual job drifted so far apart that returning to the first one registers as a protest.`,
      sections: [
      {
        h2: "What the phrase actually describes",
        body: `Strip away the branding and quiet quitting is a withdrawal of discretionary effort — the work nobody assigned and nobody counted: covering weekends, answering messages at midnight, absorbing a departed colleague's tasks indefinitely.

### The role versus the accretion

Almost every job accumulates. A favour becomes a habit, a habit becomes an expectation, and eighteen months later that expectation is in nobody's job description but everybody's assumptions. Quiet quitting is the moment someone rolls that accretion back to the written role.

### Not the same as disengagement

This distinction matters for anyone managing. A genuinely disengaged employee does the job badly. A quiet quitter usually does the job well and stops there. Treating the second as the first is the fastest way to turn it into the first.`,
      },
      {
        h2: "Why the extras stopped feeling worth it",
        body: `Discretionary effort is a trade. People give it when they believe it is noticed and eventually returned. The behaviour changes when that belief breaks.

### The exchange rate moved

If two years of extra hours produced no promotion, no raise beyond inflation, and no visible acknowledgement, the trade has been tested and found wanting. Nothing about that conclusion is irrational, and no amount of messaging about culture will argue someone out of arithmetic they have already done.

### Visibility cuts both ways

Remote and hybrid work made the invisible extras genuinely invisible. Staying late in an office is seen; staying online is not. When effort stops being observable, the incentive to volunteer it quietly disappears — often before anyone notices it has.`,
      },
      {
        h2: "What to do instead of panicking",
        body: `If several people on a team have drawn the same line at once, that is information about the team, not a coincidence of character.

### Ask what the job actually became

Compare the written role to the real week. The gap is usually the whole story, and it is often filled with work left behind by someone who left. Either resource it properly or formally drop it, but stop relying on goodwill to hide it.

### Make the return visible

Recognition does not have to mean money, but it has to be specific and it has to arrive. Named credit, protected time, a genuine say over priorities. Where people can see the extras counted, they generally keep offering them — which was always the actual mechanism, long before anyone gave it a name.`,
      },
    ],
    conclusionH2: "A boundary, read as a betrayal",
    conclusion: `Quiet quitting is the least dramatic thing its name suggests: people doing their jobs and declining to do more for free. It spread because the extras had grown large and the returns had grown thin, not because a generation stopped caring about work.

Read as feedback it is genuinely useful — a precise, unsigned report on the gap between the role you wrote and the one you are relying on.`,
    cta: "Managing a team where this feels familiar? Start by writing down what the job has actually become.",
    slug: "quiet-quitting-without-the-panic",
    keywords: ["quiet quitting", "work boundaries", "management", "engagement"],
  },
];

function toSections(seed: DemoSeed): ArticleSection[] {
  return seed.sections.map((section, index) => ({
    h2: section.h2,
    body_md: section.body,
    // Ілюстрацій у демо немає: чотири картинки з макета вже стоять
    // обкладинками, а вигадувати нові немає з чого
    image_url: "",
    image_prompt: "",
    image_alt: "",
    // Довжину рахує код — так само, як її рахує воркфлоу Дня 3
    words: countWords(section.body),
    source_urls: [],
    plan_index: index,
  }));
}

export const READER_DEMO: ReaderArticle[] = SEEDS.map((seed, index) => {
  const sections = toSections(seed);
  const words =
    countWords(seed.intro) +
    countWords(seed.conclusion) +
    sections.reduce((sum, section) => sum + (section.words ?? 0), 0);

  return {
    id: `demo-${index + 1}`,
    title: seed.title,
    category: seed.category,
    excerpt: seed.excerpt,
    // Хвилини теж рахуються, а не беруться з макета: намальоване «7 min read»
    // над реальним текстом було б неправдою
    minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    cover: seed.cover,
    accent: seed.accent,

    intro: seed.intro,
    sections,
    conclusionH2: seed.conclusionH2,
    conclusion: seed.conclusion,
    cta: seed.cta,
    seo: {
      slug: seed.slug,
      meta_description: seed.excerpt,
      keywords: seed.keywords,
    },

    demo: true,
    pipeline: null,
    variant: null,
    approved: false,
    needsReview: false,
    createdAt: null,
    projectId: null,
    words,
  };
});
