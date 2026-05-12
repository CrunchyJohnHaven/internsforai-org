// Cloudflare Pages Functions env bindings for InternsForAI.
// See wrangler.toml + Cloudflare dashboard for the corresponding values.

export interface Env {
  DB: D1Database;
  ADMIN_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  ADMIN_EMAIL: string;
  SITE_ORIGIN: string;
}

export type Track =
  | "mechanical"
  | "light_judgment"
  | "heavy_judgment"
  | "specialized"
  | "domain_expert";

export const TRACKS: readonly Track[] = [
  "mechanical",
  "light_judgment",
  "heavy_judgment",
  "specialized",
  "domain_expert",
] as const;

export const TRACK_LABELS: Record<Track, string> = {
  mechanical: "Mechanical (data entry, transcription)",
  light_judgment: "Light judgment (proofreading, QA, classification)",
  heavy_judgment: "Heavy judgment (copy-edit, translation, research)",
  specialized: "Specialized (code review, technical writing, design)",
  domain_expert: "Domain expert (legal, medical, finance)",
};

export const TRACK_HOURLY_BANDS: Record<Track, string> = {
  mechanical: "$3-6/hr",
  light_judgment: "$4-8/hr",
  heavy_judgment: "$8-15/hr",
  specialized: "$15-30/hr",
  domain_expert: "$30-75/hr",
};

export type ApplicantStatus =
  | "pending"
  | "shortlist"
  | "hired"
  | "disqualified"
  | "inactive";

export type Verdict = "pass" | "shortlist" | "fail";

export interface ApplicantRow {
  id: string;
  email: string;
  display_name: string;
  country: string;
  timezone: string;
  native_language: string | null;
  other_languages: string | null;
  tracks: string;
  pitch: string;
  thoughtful_catch: string;
  sample_url: string | null;
  availability_hours: number;
  pay_method: string;
  pay_address: string;
  status: ApplicantStatus;
  session_token: string;
  magic_token: string | null;
  magic_expires_at: number | null;
  reputation: number;
  admin_notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface TestAttemptRow {
  id: string;
  applicant_id: string;
  track: Track;
  answers: string;
  per_question_scores: string | null;
  ai_feedback: string | null;
  score_total: number;
  verdict: Verdict;
  duration_seconds: number | null;
  created_at: number;
}
