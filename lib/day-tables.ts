// Trend objects can come from two shapes depending on where they were
// produced: the live Dify pipeline (title/format/hashtags/hook_idea/
// description) or the legacy workshop seed data (format_name/why_it_works/
// example_topic/avg_length_sec/source_url). All fields are optional so the
// UI can render whichever shape actually shows up.
export type Trend = {
  // Dify pipeline shape
  title?: string;
  format?: string;
  hashtags?: string[];
  hook_idea?: string;
  description?: string;
  // Legacy seed shape
  format_name?: string;
  why_it_works?: string;
  example_topic?: string;
  avg_length_sec?: number;
  source_url?: string;
};

export type Day1Trends = {
  id: string;
  project_id: string;
  run_id: string;
  trends: Trend[] | null;
  sources: unknown;
};

export type Day2Plan = {
  id: string;
  project_id: string;
  run_id: string;
  hook_formats: unknown;
  approved: boolean;
  approved_by: string | null;
  fallback_used: boolean;
};

export type Day3Assets = {
  id: string;
  project_id: string;
  run_id: string;
  script: string | null;
  hook_variants: unknown;
  thumbnail_url: string | null;
};

export type Day4Video = {
  id: string;
  project_id: string;
  run_id: string;
  shotlist: unknown;
  video_url: string | null;
  voiceover_url: string | null;
  knowledge_refs: unknown;
  status: string | null;
};
