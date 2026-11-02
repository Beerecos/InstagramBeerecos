import type { Deliverable, DeliverableStatus } from "./editorial-api";

/**
 * Réseaux sociaux sur une seule page (refonte du 2026-10-21, demande de Cédric : « beaucoup trop d'onglets »).
 * Logique pure de la page /publication : quel écran afficher pour une URL donnée (les anciens liens restent valides),
 * format d'un contenu déduit de ses médias, action principale selon le statut.
 */

/** Outils secondaires ouverts depuis le menu « Autres outils » (ex-onglets), toujours joignables par `?vue=`. */
export const SOCIAL_TOOLS = [
  { key: "pilotage", label: "Pilotage Instagram" },
  { key: "montage", label: "Montage" },
  { key: "reels", label: "Reels IA" },
  { key: "carrousels", label: "Carrousels" },
  { key: "campagnes", label: "Campagnes à partager" },
  { key: "automatisation", label: "Automatisation et conversations" },
  { key: "validations", label: "Autres validations" },
  { key: "ruche", label: "La Ruche" },
] as const;
export type SocialToolKey = (typeof SOCIAL_TOOLS)[number]["key"];

export type SocialView =
  | { kind: "workspace"; display: "list" | "calendar"; reviewFocus: boolean; editor: boolean }
  | { kind: "tool"; tool: SocialToolKey };

/** Paramètres qui ouvrent l'éditeur de contenus (liens existants : campagnes, calendrier, partage, studio, comptes). */
const EDITOR_PARAMS = ["edit", "texte", "lien", "tab", "date", "nouveau"] as const;

/**
 * Priorité explicite : outil demandé (`vue`) > affichage (Calendrier si `vue=calendrier`, sinon Liste) ; l'éditeur
 * s'ouvre en panneau AU-DESSUS de l'affichage dès qu'un paramètre d'édition ou de préremplissage est présent
 * (`campaignId` seul compte comme préremplissage en liste ; en calendrier, c'est un filtre).
 */
export function resolveSocialView(params: URLSearchParams): SocialView {
  const vue = params.get("vue") ?? "";
  const tool = SOCIAL_TOOLS.find((t) => t.key === vue);
  if (tool) return { kind: "tool", tool: tool.key };
  const display = vue === "calendrier" ? "calendar" : "list";
  const editor = EDITOR_PARAMS.some((p) => params.has(p)) || (display === "list" && params.has("campaignId"));
  return { kind: "workspace", display, reviewFocus: vue === "valider", editor };
}

/** Fermer le panneau d'un outil : on retire seulement `vue` (la liste et ses filtres restent). */
export function withoutTool(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("vue");
  next.delete("montage");
  next.delete("visual");
  next.delete("reel");
  next.delete("postChannel");
  return next;
}

/** Fermer le panneau : on retire seulement les paramètres de l'éditeur, filtres et affichage restent. */
export function withoutEditor(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const p of EDITOR_PARAMS) next.delete(p);
  next.delete("postChannel");
  if (next.get("vue") !== "calendrier") next.delete("campaignId");
  return next;
}

export const STATUS_LABEL: Record<DeliverableStatus, string> = { draft: "Brouillon", review: "À valider", approved: "Validé", published: "Publié", archived: "Archivé" };

export type ContentFormat = "reel" | "carrousel" | "post" | "texte";
export const FORMAT_LABEL: Record<ContentFormat, string> = { reel: "Vidéo / Reel", carrousel: "Carrousel", post: "Post image", texte: "Texte seul" };

/** Format déduit des médias réellement attachés (le modèle ne stocke pas de format) : rien n'est supposé. */
export function formatOf(d: Pick<Deliverable, "media">): ContentFormat {
  const media = d.media ?? [];
  if (media.some((m) => m.type === "video")) return "reel";
  const images = media.filter((m) => m.type === "image").length;
  if (images >= 2) return "carrousel";
  return images === 1 ? "post" : "texte";
}

/** Action principale d'une ligne : modifier un brouillon, vérifier ce qui attend, consulter le reste (lecture seule respectée). */
export function primaryAction(d: Pick<Deliverable, "status">): { label: string; kind: "edit" | "preview" } {
  if (d.status === "draft") return { label: "Modifier", kind: "edit" };
  if (d.status === "review") return { label: "Vérifier", kind: "preview" };
  return { label: "Consulter", kind: "preview" };
}

const fold = (s: string) => s.toLocaleLowerCase("fr").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Recherche (titre, texte) et format : appliqués aux contenus chargés, la base ne sait pas les filtrer. */
export function matchesLocal(d: Pick<Deliverable, "title" | "content" | "media">, q: string, format: string): boolean {
  if (format && formatOf(d) !== format) return false;
  const query = fold(q.trim());
  return !query || fold(`${d.title ?? ""} ${d.content ?? ""}`).includes(query);
}

/** Routes de création communes, en conservant les filtres du tableau. */
export function studioHref(params: URLSearchParams, source: "reel" | "ai" | "visual"): string {
  // Instagram BeeRecos : routes dédiées (les filtres de l'ancien tableau /publication ne s'appliquent plus).
  void params;
  return source === "ai" ? "/reels/nouveau/ia" : source === "visual" ? "/formats" : "/reels/nouveau/video";
}

/**
 * Anciens liens BeeMarketing `/publication?vue=…` → routes d'Instagram BeeRecos, en conservant les identifiants utiles
 * (montage, source IA, visuel). Tout le reste (tableau, éditeur de post, outils commerciaux) ramène à « Mes réels ».
 */
export function legacyPublicationHref(params: URLSearchParams): string {
  const vue = params.get("vue") ?? "";
  const montageId = params.get("montage");
  if (montageId && /^[\w-]{1,64}$/.test(montageId)) return `/reels/${encodeURIComponent(montageId)}`;
  const keep = (keys: string[]) => {
    const next = new URLSearchParams();
    for (const k of keys) { const v = params.get(k); if (v) next.set(k, v); }
    return next.size ? `?${next}` : "";
  };
  if (vue === "reels" || params.has("studioAsset")) return `/reels/nouveau/ia${keep(["studioAsset", "studioRevision", "studioKind"])}`;
  if (vue === "montage") return "/reels/nouveau/video";
  if (vue === "carrousels") return `/formats${keep(["visual"])}`;
  return "/";
}

export function pipelineStage(d: Pick<Deliverable, "status">): "prepare" | "validate" | "history" {
  if (d.status === "draft") return "prepare";
  if (d.status === "review" || d.status === "approved") return "validate";
  return "history";
}
