/**
 * Sous-ensemble « réseaux sociaux » du client API de BeeMarketing (`src/lib/api.ts`, bee-marketing-agent@6ab3914).
 * Appelle les Edge Functions déployées sur le projet Supabase BeeMarketing (décision du 2026-11-02 : base partagée).
 * Seules les fonctions utilisées par l'interface sociale sont reprises ; le reste du fichier source n'est pas porté.
 */
import { getAccessToken } from "./supabase";
import { apiUrl as API } from "./api-config";

export const isBackendConfigured = Boolean(API);

export type ChatMsg = { role: "user" | "assistant"; content: string };

export async function chatStream(
  agentId: string,
  messages: ChatMsg[],
  agentName: string,
  onDelta: (chunk: string) => void
): Promise<string> {
  if (!API) {
    const demo =
      `— (démo) ${agentName} répondrait ici en s'appuyant sur la mémoire BeeRecos ` +
      `(charte, offres, objectifs) et le format BEE. Configure NEXT_PUBLIC_BEE_API_URL ` +
      `pour un vrai échange en streaming.`;
    for (const word of demo.split(" ")) {
      await new Promise((r) => setTimeout(r, 18));
      onDelta(word + " ");
    }
    return demo;
  }

  const res = await fetch(`${API}/bee-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ agentId, messages }),
  });
  if (!res.ok || !res.body) throw new Error(`Backend ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onDelta(chunk);
  }
  return full;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export {
  listDeliverables, listEditorialDeliverables, getDeliverable, createDeliverable,
  updateDeliverable, setDeliverableStatus, generateEditorialText, transferStudioMedia, listEditorialAccounts,
} from "./editorial-api";
export type { Deliverable, DeliverableStatus, DeliverableInput, DeliverablePatch, EditorialMedia, StudioSource } from "./editorial-api";

export type ClubWorkspace = {
  id: string;
  name: string;
  kind: string;
  external_ref: string | null;
  parent_id: string | null;
};

// Clubs d'exemple du mode démo (BeeMarketing `src/lib/demo-data.ts`).
export const DEMO_CLUBS: ClubWorkspace[] = [
  { id: "demo-club-bayonne", name: "BeeRecos Bayonne (exemple)", kind: "club", external_ref: null, parent_id: null },
  { id: "demo-club-anglet", name: "BeeRecos Anglet (exemple)", kind: "club", external_ref: null, parent_id: null },
];

async function professionsCall<T>(payload: Record<string, unknown>): Promise<T> {
  if (!API) throw new Error("Backend requis : définis NEXT_PUBLIC_BEE_API_URL (Edge Functions déployées).");
  const res = await fetch(`${API}/professions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ? `${data.error}${data.reason ? " : " + data.reason : ""}` : `Backend ${res.status}`);
  return data as T;
}
export async function listClubWorkspaces(): Promise<{ items: ClubWorkspace[]; demo: boolean }> {
  // Mode démo (2026-09-09) : clubs d'exemple plutôt qu'une liste vide, pour que Fichier et
  // Prospection téléphonique restent utilisables sans backend configuré — cf. demo-data.ts.
  if (!API) return { demo: true, items: DEMO_CLUBS };
  const d = await professionsCall<{ workspaces: ClubWorkspace[] }>({ action: "list-workspaces", kind: "club" });
  return { demo: false, items: d.workspaces };
}
export type Campaign = {
  id: string;
  workspace_id: string | null;
  template_key: string;
  campaign_type?: "CLUB_FILL" | "CLUB_LAUNCH" | "BEESCHOOL_TRAINING" | null;
  name: string;
  objective: string | null;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  target_city: string | null;
  target_date: string | null;
  target_location?: string | null;
  target_animator?: string | null;
  email_context?: Record<string, unknown> | null; // EmailContext côté BeeMarketing (non porté : hors périmètre social)
  target_member_count: number | null;
  created_at: string;
  // Emailing façon Brevo (2026-09-10) : destinataires par liste importée + contenu propre à la
  // campagne — cf. supabase/migrations/0028_campaign_email_audience.sql.
  audience_list_name?: string | null;
  email_template_id?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  email_deliverable_id?: string | null;
  email_deliverable_version?: number | null;
  // Bouton CTA de marque (éditeur d'email, migration 0053).
  email_cta_label?: string | null;
  email_cta_url?: string | null;
  // LOT 5 : rattachement à un objectif commercial + contribution attendue (cf. migration 0046).
  objective_id?: string | null;
  target_contribution?: number | null;
};
async function campaignsCall<T>(payload: Record<string, unknown>): Promise<T> {
  if (!API) throw new Error("Backend requis : définis NEXT_PUBLIC_BEE_API_URL (Edge Functions déployées).");
  const res = await fetch(`${API}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ? `${data.error}${data.reason ? " : " + data.reason : ""}` : `Backend ${res.status}`);
  return data as T;
}
export async function listCampaigns(workspaceId?: string): Promise<{ items: Campaign[]; demo: boolean }> {
  if (!API) return { demo: true, items: [] };
  const d = await campaignsCall<{ campaigns: Campaign[] }>({ action: "list-campaigns", workspaceId });
  return { demo: false, items: d.campaigns };
}
async function socialCall<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API}/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ? String(data.error) : `Backend ${res.status}`);
  return data as T;
}
export type PublicationStatusApi = "brouillon" | "genere" | "a_valider" | "valide" | "programme" | "publie" | "archive";
export type SocialPublicationRow = {
  composition?: unknown;
  id: string;
  template_key: string;
  channel: string;
  workspace_id: string | null;
  event_id: string | null;
  contact_id: string | null;
  title: string | null;
  status: PublicationStatusApi;
  caption: string | null;
  cta: string | null;
  hashtags: string[];
  link: string | null;
  ratios: string[];
  scheduled_at: string | null;
  deliverable_id: string | null;
  missing: string[];
  created_at: string;
  updated_at: string;
};
export type SavePublicationInput = {
  id?: string; expectedVersion?: string;
  templateKey: string;
  channel?: "instagram" | "linkedin";
  workspaceId?: string | null;
  eventId?: string | null;
  contactId?: string | null;
  title?: string;
  composition: unknown;
  caption?: string;
  cta?: string;
  hashtags?: string[];
  link?: string | null;
  ratios?: string[];
  missing?: string[];
  status?: "brouillon" | "genere" | "a_valider";
};
export async function getPublication(id: string): Promise<SocialPublicationRow> {
  if (!API) throw new Error("Backend requis pour retrouver la composition.");
  return (await socialCall<{ publication: SocialPublicationRow }>("get-publication", { id })).publication;
}
export async function listPublications(status?: PublicationStatusApi): Promise<SocialPublicationRow[]> {
  if (!API) return [];
  return (await socialCall<{ publications: SocialPublicationRow[] }>("list-publications", { status })).publications;
}
export async function savePublication(input: SavePublicationInput): Promise<SocialPublicationRow> {
  if (!API) throw new Error("Backend requis (NEXT_PUBLIC_BEE_API_URL) pour enregistrer la publication.");
  return (await socialCall<{ ok: true; publication: SocialPublicationRow }>("save-publication", input as unknown as Record<string, unknown>)).publication;
}

export type MediaSourceApi = "user" | "event" | "club" | "member" | "library";
export type MediaLogoSlot = "logo_beerecos" | "logo_club" | "logo_partenaire" | "logo_lieu" | "logo_evenement";
export type MediaKindApi = "photo" | "logo" | "background";
export type MediaAssetRow = {
  id: string;
  kind: MediaKindApi;
  source: MediaSourceApi;
  workspace_id: string | null;
  event_id: string | null;
  contact_id: string | null;
  logo_slot: MediaLogoSlot | null;
  storage_path: string | null;
  url: string | null;
  title: string | null;
  alt_text: string | null;
  status: string;
  created_at: string;
};
export type MediaUploadInput = {
  kind: MediaKindApi;
  source: MediaSourceApi;
  base64: string;
  contentType: string;
  workspaceId?: string | null;
  eventId?: string | null;
  contactId?: string | null;
  logoSlot?: MediaLogoSlot | null;
  title?: string | null;
  altText?: string | null;
};
async function mediaCall<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ? String(data.error) : `Backend ${res.status}`);
  return data as T;
}
export async function listMedia(filter: { workspaceId?: string; eventId?: string; contactId?: string; kind?: MediaKindApi } = {}): Promise<MediaAssetRow[]> {
  if (!API) return [];
  return (await mediaCall<{ items: MediaAssetRow[] }>("list-media", filter)).items ?? [];
}
export async function uploadMedia(input: MediaUploadInput): Promise<MediaAssetRow> {
  if (!API) throw new Error("Backend requis (NEXT_PUBLIC_BEE_API_URL) pour l'upload média.");
  return (await mediaCall<{ ok: true; item: MediaAssetRow }>("upload-media", input as unknown as Record<string, unknown>)).item;
}
export async function deleteMedia(id: string): Promise<void> {
  if (!API) return;
  await mediaCall<{ ok: true }>("delete-media", { id });
}
