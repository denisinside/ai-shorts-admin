export const PLATFORMS = ["tiktok", "reels", "shorts"] as const;
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

export const STATUS_STYLES: Record<Status, string> = {
  created: "bg-gray-100 text-gray-600",
  researched: "bg-blue-50 text-blue-600",
  planned: "bg-amber-50 text-amber-700",
  produced: "bg-violet-50 text-violet-700",
  rendered: "bg-green-50 text-green-700",
};
