/**
 * Onglet Post : règles pures d'une création à publier sur Instagram (réel ou post photo/carrousel),
 * de son mot-clé « commente MOT → DM » et de son cycle de vie. Testées sans réseau.
 *
 * Cycle : draft → publishing → published, ou → error (on peut relancer depuis error tant que rien n'est publié).
 * Un passage en « published » n'est écrit que par le serveur, après la réponse d'Instagram (jamais supposé).
 */
import { z } from "zod";

export const CAPTION_MAX = 2200;
export const HASHTAG_MAX = 30;
export const MEDIA_MAX = 10;

export const PUBLICATION_STATUSES = ["draft", "publishing", "published", "error"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "Brouillon",
  publishing: "Publication en cours",
  published: "Publié",
  error: "Échec",
};

/** Mot-clé : un seul mot, majuscules (accents permis), 2 à 30 caractères. « club » → « CLUB ». */
export function normalizeKeyword(input: string): string {
  return input.trim().toLocaleUpperCase("fr-FR").replace(/[^A-Z0-9À-Ü]/g, "");
}
const KEYWORD = /^[A-Z0-9À-Ü]{2,30}$/;

export const MediaSchema = z.strictObject({
  /** Chemin dans le bucket privé ig-media (post simple) ; un réel passe par son MP4 rendu. */
  path: z.string().regex(/^[a-zA-Z0-9/_.-]{1,200}$/),
  type: z.enum(["image"]),
});
export type PublicationMedia = z.infer<typeof MediaSchema>;

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => (v ? v : null)).nullable().optional();

export const DraftSchema = z.strictObject({
  kind: z.enum(["reel", "post"]),
  montageId: z.string().trim().min(1).max(80).nullable().optional(),
  title: z.string().trim().max(120).default(""),
  caption: z.string().max(CAPTION_MAX).default(""),
  media: z.array(MediaSchema).max(MEDIA_MAX).default([]),
  keyword: z.string().transform(normalizeKeyword).refine((k) => !k || KEYWORD.test(k), "Mot-clé : un seul mot de 2 à 30 lettres ou chiffres.").transform((k) => k || null).nullable().optional(),
  dmText: optionalText(900),
  buttonTitle: optionalText(20),
  buttonUrl: z.string().trim().max(500).refine((u) => !u || /^https:\/\/[^\s]+$/.test(u), "Le lien du bouton doit commencer par https://").transform((u) => u || null).nullable().optional(),
});
export type DraftInput = z.input<typeof DraftSchema>;
export type Draft = z.output<typeof DraftSchema>;

export type Publication = {
  id: string;
  kind: "reel" | "post";
  montageId: string | null;
  title: string;
  caption: string;
  media: PublicationMedia[];
  keyword: string | null;
  dmText: string | null;
  buttonTitle: string | null;
  buttonUrl: string | null;
  status: PublicationStatus;
  permalink: string | null;
  publishedAt: string | null;
  error: string | null;
  updatedAt: string;
};

export function hashtagCount(caption: string): number {
  return (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

/**
 * Ce qui empêche de publier (liste vide = prêt). `hasVideo` : MP4 rendu disponible pour un réel.
 * Le mot-clé est facultatif ; s'il est là, le DM doit l'être aussi et la légende doit le citer.
 */
export function publishBlockers(p: Pick<Publication, "kind" | "caption" | "media" | "keyword" | "dmText" | "buttonTitle" | "buttonUrl" | "status">, opts: { hasVideo?: boolean; connected: boolean }): string[] {
  const out: string[] = [];
  if (!opts.connected) out.push("Instagram n'est pas connecté (Paramètres → Instagram).");
  if (p.status === "published") out.push("Déjà publié.");
  if (p.status === "publishing") out.push("Publication déjà en cours.");
  if (p.kind === "reel" && !opts.hasVideo) out.push("Le MP4 du réel n'est pas encore rendu.");
  if (p.kind === "post" && p.media.length === 0) out.push("Ajoute au moins une photo.");
  if (p.media.length > MEDIA_MAX) out.push(`${MEDIA_MAX} photos au plus.`);
  if (!p.caption.trim()) out.push("La légende est vide.");
  if (p.caption.length > CAPTION_MAX) out.push(`Légende trop longue (${p.caption.length} / ${CAPTION_MAX}).`);
  if (hashtagCount(p.caption) > HASHTAG_MAX) out.push(`${HASHTAG_MAX} hashtags au plus.`);
  if (p.keyword) {
    if (!p.dmText?.trim()) out.push(`Écris le DM envoyé à ceux qui commentent ${p.keyword}.`);
    if (!mentionsKeyword(p.caption, p.keyword)) out.push(`La légende doit dire de commenter ${p.keyword}.`);
    if (Boolean(p.buttonTitle) !== Boolean(p.buttonUrl)) out.push("Le bouton du DM a besoin d'un libellé et d'un lien.");
  }
  return out;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function mentionsKeyword(caption: string, keyword: string): boolean {
  const words = fold(caption).split(/[^a-z0-9]+/);
  return words.includes(fold(keyword));
}

/** Instagram : 1 photo = IMAGE, 2 à 10 = CAROUSEL ; un réel = REELS. */
export function containerKind(p: Pick<Publication, "kind" | "media">): "REELS" | "IMAGE" | "CAROUSEL" {
  if (p.kind === "reel") return "REELS";
  return p.media.length > 1 ? "CAROUSEL" : "IMAGE";
}

/** Une publication peut être (re)lancée seulement depuis brouillon ou échec, et jamais deux fois. */
export function canStartPublishing(status: PublicationStatus): boolean {
  return status === "draft" || status === "error";
}

/** Jeton Instagram : à renouveler s'il expire dans moins de 10 jours (il dure 60 jours). */
export function tokenNeedsRefresh(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - now < 10 * 24 * 3600 * 1000;
}

/**
 * Photo de post : Instagram accepte un rapport largeur/hauteur de 4:5 (0,8) à 1,91:1. Au-delà, on recadre au centre
 * (jamais de déformation) ; largeur ramenée à 1440 px au plus. Renvoie la zone source à garder et la taille de sortie.
 */
export function photoCrop(width: number, height: number, maxWidth = 1440) {
  const ratio = width / height;
  let sw = width, sh = height;
  if (ratio < 0.8) sh = Math.round(width / 0.8);
  else if (ratio > 1.91) sw = Math.round(height * 1.91);
  const sx = Math.round((width - sw) / 2), sy = Math.round((height - sh) / 2);
  const scale = Math.min(1, maxWidth / sw);
  return { sx, sy, sw, sh, w: Math.round(sw * scale), h: Math.round(sh * scale), cropped: sw !== width || sh !== height };
}
