// Client du pilote automatique des Reels (fonction serveur `reel-automation`, route /admin) et de la landing publique
// « Visiter un club » (fonction `visit`). Les garde-fous sont appliqués côté serveur ; l'interface affiche leur état.
import { apiUrl } from "./api-config";
import { getAccessToken } from "./supabase";
import type { Calibration, CriterionKey, ReviewReport, StorySpec } from "@/domain/social/reel-story";

export const isAutopilotConfigured = Boolean(apiUrl);

async function post<T>(path: string, body: Record<string, unknown>, auth: boolean): Promise<T> {
  if (!apiUrl) throw new Error("Backend non configuré (NEXT_PUBLIC_BEE_API_URL) : le pilotage a besoin du serveur BeeMarketing.");
  const token = auth ? await getAccessToken() : null;
  const res = await fetch(`${apiUrl}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? `Erreur serveur (${res.status})`) as Error & { status?: number; fields?: Record<string, string> };
    err.status = res.status; err.fields = data.fields;
    throw err;
  }
  return data as T;
}

export type ReelStatus = "planned" | "to_review" | "ready_to_render" | "rendering" | "ready" | "publishing" | "published" | "to_verify" | "failed" | "skipped";
export type PilotSettings = {
  mode: "brouillon" | "auto"; paused: boolean; test_content_id: string | null; slot_rule: { days: number[]; time: string; tz: string };
  production_lead_hours: number; max_per_week: number; autopilot_granted_at: string | null; autopilot_until: string | null;
  last_tick_at: string | null; last_tick_summary: unknown;
  learned_rules: LearnedRule[]; dm_keywords: string[];
};
export type LearnedRule = { id: string; text: string; by: string; at: string };
export type HumanReview = { scores: Record<CriterionKey, number>; comment: string; by: string; at: string };
export type ReelItem = {
  id: string; slot_at: string | null; source: string; example_key?: string | null; pillar: string | null; title: string; caption?: string | null;
  status: ReelStatus; video_url: string | null; render_id?: string | null; last_error: string | null; spec?: StorySpec | null;
  ig_media_id?: string | null; ig_permalink?: string | null; published_at?: string | null;
  production_attempts?: number; render_attempts?: number; publication_attempts?: number;
  critique?: (ReviewReport & { arbitrated?: { by: string; at: string; decision: string } }) | null; human_review?: HumanReview | null;
};
export type JobIssue = { id: string; content_id: string; stage: string; attempt: number; status: string; error: string | null; created_at: string; finished_at: string | null; is_test: boolean };
export type VisitRow = {
  id: string; created_at: string; first_name: string; last_name: string; email: string; company: string; club_name: string; club_city: string | null;
  status: string; utm: Record<string, string>; confirmation_status: string; notification_status: string; responsible_user_id: string | null;
};
type LastJob = { status: string; finished_at: string; error: string | null } | null;
export type Connections = {
  cron: { verified: boolean; detail: string }; claude: { configured: boolean; last: LastJob }; heygen: { configured: boolean; last: LastJob };
  make: { configured: boolean; last: LastJob }; storage: { verified: boolean }; brevo: { configured: boolean }; manychat: { verified: boolean; detail: string };
};
export type Quality = { calibration: Calibration; critic: { configured: boolean; independent: boolean; provider?: "chatgpt" | "claude" | null }; landing: string | null };
export type Overview = { settings: PilotSettings; quality?: Quality; upcoming: ReelItem[]; recent: ReelItem[]; problems: JobIssue[]; visits: VisitRow[]; connections: Connections };

export const pilot = {
  overview: () => post<Overview>("reel-automation/admin", { action: "overview" }, true),
  checkConnections: () => post<{ heygen: { ok: boolean; detail: string }; app: { ok: boolean; detail: string }; checkedAt: string }>("reel-automation/admin", { action: "check-connections" }, true),
  updateSettings: (patch: Partial<{ paused: boolean; mode: "brouillon"; slotRule: { days: number[]; time: string }; maxPerWeek: number; leadHours: number; dmKeywords: string[] }>) =>
    post<{ settings: PilotSettings }>("reel-automation/admin", { action: "update-settings", ...patch }, true),
  grantAutopilot: (days: 30 | 90 | 180, confirm: string) => post<{ settings: PilotSettings }>("reel-automation/admin", { action: "grant-autopilot", days, confirm }, true),
  revokeAutopilot: () => post<{ settings: PilotSettings }>("reel-automation/admin", { action: "revoke-autopilot" }, true),
  setTest: (contentId: string | null) => post<{ settings: PilotSettings }>("reel-automation/admin", { action: "set-test", contentId }, true),
  publishTestNow: () => post<{ outcome: string }>("reel-automation/admin", { action: "publish-test-now" }, true),
  studioCreate: (p: { title: string; hook: string; duration: number; motion?: "discret" | "dynamique" }) =>
    post<{ id: string; slotAt: string; uploadUrl: string; method: "PUT"; headers: Record<string, string> }>("reel-automation/admin", { action: "studio-create", ...p }, true),
  studioUploaded: (id: string) => post<{ ok: true }>("reel-automation/admin", { action: "studio-uploaded", id }, true),
  rules: (op: "add" | "remove", value: string) => post<{ settings: PilotSettings }>("reel-automation/admin", { action: "rules", op, ...(op === "add" ? { text: value } : { id: value }) }, true),
  content: (id: string, op: "skip" | "retry" | "verified-published" | "verified-not-published" | "edit" | "approve-review" | "rewrite" | "rate", extra: Record<string, unknown> = {}) =>
    post<{ ok: true }>("reel-automation/admin", { action: "content", id, op, ...extra }, true),
};

export type VisitClub = { ref: string; name: string; city: string | null };
export const visit = {
  clubs: () => post<{ clubs: VisitClub[] }>("visit", { action: "list-clubs" }, false),
  submit: (payload: Record<string, unknown>) => post<{ ok: true; status: "received"; confirmation: "sent" | "not_sent"; duplicate?: boolean }>("visit", { action: "submit", ...payload }, false),
};

export const STATUS_LABEL: Record<ReelStatus, string> = {
  planned: "À rédiger", to_review: "À arbitrer", ready_to_render: "À rendre", rendering: "Rendu en cours", ready: "Prêt à publier", publishing: "Publication en cours",
  published: "Publié", to_verify: "À vérifier", failed: "Échec", skipped: "Ignoré",
};
