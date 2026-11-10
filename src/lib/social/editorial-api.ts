import { apiUrl, isDemoMode } from "./api-config";
import { getAccessToken } from "./supabase";

export type DeliverableStatus = "draft" | "review" | "approved" | "published" | "archived";
export type EditorialMedia = { url: string; type: "image" | "video"; alt?: string; assetId?: string };
export type StudioSource = {
  sourceType: "montage" | "visual" | "reel"; sourceId: string; sourceVersion: string;
  renderReady: boolean; composition?: unknown; script?: string | null; keyword?: string | null; coverUrl?: string | null;
};
export type Deliverable = {
  studioSource?: StudioSource | null; publicationMode?: "standard" | "manual_studio";
  keyword?: string | null; accountIds?: string[];
  id: string; agentId: string | null; title: string | null; channel: string | null;
  status: DeliverableStatus; content: string | null; createdAt: string | null;
  updatedAt: string | null; workspaceId: string | null; campaignId: string | null;
  objective: string | null; cta: string | null; destinationUrl: string | null;
  attributionCode: string | null; scheduledAt: string | null;
  contentVersion: number; approvedVersion: number | null; media: EditorialMedia[];
};
export type DeliverableInput = {
  keyword?: string | null; accountIds?: string[];
  channel: string; content: string; title?: string | null;
  workspaceId?: string | null; campaignId?: string | null; objective?: string | null;
  cta?: string | null; destinationUrl?: string | null; scheduledAt?: string | null;
  media?: EditorialMedia[];
};
export type DeliverablePatch = Partial<DeliverableInput> & { expectedVersion: number };
export type EditorialFilters = {
  from?: string; to?: string; workspaceId?: string; campaignId?: string;
  channel?: string; status?: DeliverableStatus; unscheduled?: boolean;
  offset?: number; limit?: number;
};

function mapDeliverable(d: Record<string, unknown>): Deliverable {
  return {
    studioSource: (d.studio_source as StudioSource) ?? null, publicationMode: d.publication_mode === "manual_studio" ? "manual_studio" : "standard",
    keyword: d.keyword as string ?? null, accountIds: Array.isArray(d.account_ids) ? d.account_ids as string[] : [],
    id: String(d.id), agentId: d.agent_id as string ?? null, title: d.title as string ?? null,
    channel: d.channel as string ?? null, status: d.status as DeliverableStatus,
    content: d.content as string ?? null, createdAt: d.created_at as string ?? null,
    updatedAt: d.updated_at as string ?? null, workspaceId: d.workspace_id as string ?? null,
    campaignId: d.campaign_id as string ?? null, objective: d.objective as string ?? null,
    cta: d.cta as string ?? null, destinationUrl: d.destination_url as string ?? null,
    attributionCode: d.attribution_code as string ?? null, scheduledAt: d.scheduled_at as string ?? null,
    contentVersion: Number(d.content_version ?? 1), approvedVersion: d.approved_version as number ?? null,
    media: Array.isArray(d.media) ? d.media as EditorialMedia[] : [],
  };
}

async function editorialRequest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!apiUrl) throw new Error("Connexion au service requise. Aucune modification n’a été enregistrée.");
  const token = await getAccessToken();
  if (!token) throw new Error("Reconnecte-toi pour consulter ou modifier les contenus.");
  const res = await fetch(`${apiUrl}/deliverables`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.reason ?? data.error ?? `Service indisponible (${res.status})`);
  return data;
}

export async function listEditorialDeliverables(filters: EditorialFilters = {}): Promise<{
  items: Deliverable[]; demo: boolean; hasMore: boolean; total?: number;
}> {
  if (isDemoMode) return { items: [], demo: true, hasMore: false };
  const data = await editorialRequest({ action: "list", ...filters });
  if (!Array.isArray(data.deliverables)) throw new Error("Réponse calendrier invalide.");
  return { items: data.deliverables.map(mapDeliverable), demo: false, hasMore: Boolean(data.hasMore),
    total: typeof data.total === "number" ? data.total : undefined };
}
export async function listDeliverables(status?: DeliverableStatus) {
  return listEditorialDeliverables({ status, limit: 100 });
}
export async function getDeliverable(id: string): Promise<Deliverable> {
  const data = await editorialRequest({ action: "get", id });
  if (!data.deliverable) throw new Error("Contenu introuvable.");
  return mapDeliverable(data.deliverable as Record<string, unknown>);
}
export async function createDeliverable(input: DeliverableInput): Promise<Deliverable> {
  const data = await editorialRequest({ action: "create-deliverable", deliverable: input });
  if (!data.deliverable) throw new Error("La sauvegarde du contenu n’a pas été confirmée.");
  return mapDeliverable(data.deliverable as Record<string, unknown>);
}
export async function updateDeliverable(id: string, patch: DeliverablePatch): Promise<Deliverable> {
  const { expectedVersion, ...fields } = patch;
  const data = await editorialRequest({ action: "update", id, patch: fields, expectedVersion });
  if (!data.deliverable) throw new Error("La modification n’a pas été confirmée.");
  return mapDeliverable(data.deliverable as Record<string, unknown>);
}
export async function setDeliverableStatus(
  id: string, status: "draft" | "review" | "approved" | "archived", expectedVersion: number,
): Promise<void> {
  const data = await editorialRequest({ action: "set-status", id, status, expectedVersion, confirmed: status === "approved" });
  if (!data.ok) throw new Error("Le changement de statut n’a pas été confirmé.");
}

export async function generateEditorialText(input: {
  channel: string; brief: string; workspaceId: string | null; campaignId?: string | null;
  objective?: string; cta?: string; destinationUrl?: string; currentText?: string; subject?: string;
}): Promise<string> {
  if (!apiUrl) throw new Error("Service de génération non configuré.");
  // Sans session, la requête part quand même : le serveur la refuse (401) et l'on demande de se reconnecter.
  const token = await getAccessToken();
  const res = await fetch(`${apiUrl}/editorial-generate`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Reconnecte-toi pour générer un brouillon.");
  if (!res.ok || typeof data.text !== "string" || !data.text.trim()) {
    if (data.code === "AI_CONNECTION_REQUIRED" || data.error === "AI_CONNECTION_REQUIRED") throw new Error("CONNECTION_REQUIRED : connecte le service IA dans les paramètres. Ton texte existant est conservé.");
    throw new Error(data.reason ?? data.error ?? "La génération n’a pas abouti.");
  }
  return String(data.text);
}

export type ResearchFact = { date: string; text: string; source: string; url: string };
/** Recherche web de l'histoire d'un sujet : faits datés avec leur source (pages réellement consultées). Rien n'est publié. */
export async function researchCarouselFacts(subject: string): Promise<{ facts: ResearchFact[]; text: string; dropped: number }> {
  if (!apiUrl) throw new Error("Service de recherche non configuré.");
  const token = await getAccessToken();
  const res = await fetch(`${apiUrl}/editorial-generate`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: "research-facts", subject }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Reconnecte-toi pour lancer la recherche.");
  if (!res.ok || !Array.isArray(data.facts)) {
    if (data.code === "AI_CONNECTION_REQUIRED" || data.error === "AI_CONNECTION_REQUIRED") throw new Error("Le service IA n'est pas connecté.");
    throw new Error(typeof data.error === "string" && !/^[A-Z_0-9]+$/.test(data.error) ? data.error : "La recherche n'a pas abouti. Réessaie ou colle tes faits.");
  }
  return { facts: data.facts, text: String(data.text ?? ""), dropped: Number(data.dropped ?? 0) };
}

export type CampaignPackResult = {
  recipients: number; listName: string | null; imageError: string | null; deliverables: Deliverable[];
};
const PACK_ERRORS: Record<string, string> = {
  AI_CONNECTION_REQUIRED: "CONNECTION_REQUIRED : connecte le service IA dans les paramètres.",
  BRAND_MEMORY_UNAVAILABLE: "Mémoire de marque indisponible : la rédaction est bloquée tant que brand / forbidden-claims ne sont pas lisibles.",
};
/** Fichier + objectif → 3 BROUILLONS (e-mail au gabarit, LinkedIn, Instagram + visuel). Rien n'est envoyé ni publié. */
export async function generateCampaignPack(input: {
  campaignId: string; listName?: string | null; objectiveId?: string | null; ctaUrl?: string | null;
}): Promise<CampaignPackResult> {
  if (!apiUrl) throw new Error("Service de génération non configuré.");
  const token = await getAccessToken();
  if (!token) throw new Error("Reconnecte-toi pour générer les brouillons.");
  const res = await fetch(`${apiUrl}/editorial-generate`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "generate-pack", ...input }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.deliverables)) {
    throw new Error(PACK_ERRORS[data.code as string] ?? data.reason ?? data.error ?? "La préparation n’a pas abouti.");
  }
  return {
    recipients: Number(data.recipients ?? 0), listName: data.listName ?? null, imageError: data.imageError ?? null,
    deliverables: (data.deliverables as Record<string, unknown>[]).map(mapDeliverable),
  };
}

/** Idempotent, server-derived media transfer. Version is the source's raw updated_at. */
export async function transferStudioMedia(input: {
  sourceType: "montage" | "visual" | "reel"; sourceId: string; expectedSourceVersion: string; channel?: "instagram" | "linkedin";
}): Promise<Deliverable> {
  const data = await editorialRequest({ action: "transfer-studio-media", ...input });
  if (!data.deliverable) throw new Error("Le transfert n’a pas été confirmé.");
  return mapDeliverable(data.deliverable as Record<string, unknown>);
}
export async function listEditorialAccounts(): Promise<{ id: string; channel: string; name: string }[]> {
  const data = await editorialRequest({ action: "list-accounts" });
  return Array.isArray(data.accounts) ? data.accounts as { id: string; channel: string; name: string }[] : [];
}
