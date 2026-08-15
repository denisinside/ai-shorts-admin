// blog додано слідом за реальними даними: скіл blog-trends-research пише
// platform='blog', і без цього значення <select> у формі редагування мовчки
// перемикав такий проєкт на tiktok при першому ж збереженні.
export const PLATFORMS = ["tiktok", "reels", "shorts", "blog"] as const;
export const STATUSES = [
  "created",
  "researched",
  "planned",
  "produced",
  "rendered",
] as const;

export type Platform = (typeof PLATFORMS)[number];
export type Status = (typeof STATUSES)[number];

export type Project = {
  id: string;
  niche: string;
  platform: Platform;
  status: Status;
  created_at: string;
  updated_at: string;
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  reels: "Reels",
  shorts: "Shorts",
  blog: "Блог",
};

export const STATUS_LABELS: Record<Status, string> = {
  created: "Створено",
  researched: "Дослідження",
  planned: "План",
  produced: "Продакшн",
  rendered: "Готово",
};

// Кожен статус — свій токен із теми, а не окремий колір. Заливка 14%,
// обвідка 30%: достатньо, щоб бейдж читався поверх скла, і не настільки,
// щоб таблиця перетворилася на світлофор.
export const STATUS_STYLES: Record<Status, string> = {
  created: "text-ink-muted bg-white/6 ring-white/12",
  researched: "text-arc bg-arc/14 ring-arc/30",
  planned: "text-warn bg-warn/14 ring-warn/30",
  produced: "text-plum bg-plum/14 ring-plum/30",
  rendered: "text-ok bg-ok/14 ring-ok/30",
};

/** Токен кольору статусу — для амбієнтного фону сторінки проєкту. */
export const STATUS_TINTS: Record<Status, string> = {
  created: "var(--color-ink-faint)",
  researched: "var(--color-arc)",
  planned: "var(--color-warn)",
  produced: "var(--color-plum)",
  rendered: "var(--color-ok)",
};

export function isStatus(value: string | undefined): value is Status {
  return (
    typeof value === "string" && (STATUSES as readonly string[]).includes(value)
  );
}
