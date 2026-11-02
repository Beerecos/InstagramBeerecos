// Content — types, CTA, attribution (PRD §19-22/§26). Pur, testable, sans I/O.

// Types de contenus V1 (§20). V2 (YouTube, Shorts, Reels, vidéo générée) : DEFERRED (§100 P1/P2).
export const CONTENT_CHANNELS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "newsletter", label: "Newsletter" },
  { key: "article", label: "Article" },
  { key: "email", label: "Email" },
  { key: "landing-page", label: "Landing page" },
] as const;

export type ContentChannelKey = (typeof CONTENT_CHANNELS)[number]["key"];

export function channelLabel(key: string | null | undefined): string {
  return CONTENT_CHANNELS.find((c) => c.key === key)?.label ?? key ?? "—";
}

// CTA suggérés (§22 : "Exemples" — pas un enum fermé, l'utilisateur peut en écrire un autre).
export const CTA_SUGGESTIONS = [
  "Découvrir le club",
  "Participer à la prochaine réunion",
  "Être invité",
  "Être rappelé",
  "Découvrir BeeRecos",
  "Rejoindre la liste d'attente",
] as const;

// Code d'attribution (§21/§26) : identifie un contenu pour le suivi first/last touch.
// Format : {slug-campagne|"organic"}-{6 premiers caractères de l'id du contenu, sans tirets}.
// Déterministe (même entrée → même code), lisible dans une URL, pas de collision pratique
// tant que les ids sont des UUID.
export function slugifyForAttribution(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "organic";
}

export function buildAttributionCode(campaignNameOrSlug: string | null | undefined, contentId: string): string {
  const prefix = campaignNameOrSlug ? slugifyForAttribution(campaignNameOrSlug) : "organic";
  const suffix = contentId.replace(/-/g, "").slice(0, 6).toLowerCase();
  return `${prefix}-${suffix}`;
}

const ATTRIBUTION_CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/;

export function isValidAttributionCode(code: string): boolean {
  return ATTRIBUTION_CODE_RE.test(code);
}

// Ajoute (ou remplace) le paramètre d'attribution sur une URL de destination, sans dépendre
// d'un contexte navigateur (pur, testable). Idempotent : relancer avec un nouveau code remplace
// l'ancien plutôt que de l'empiler.
export function withAttribution(url: string, code: string): string {
  if (!url) return url;
  const [base, query = ""] = url.split("?");
  const params = query.split("&").filter((p) => p && !p.startsWith("attrib="));
  params.push(`attrib=${encodeURIComponent(code)}`);
  return `${base}?${params.join("&")}`;
}
