import { z } from "zod";

/**
 * Préparation du post d'un montage (Instagram BeeRecos, 2026-11-02) : légende, CTA, mot-clé éventuel, destination,
 * hashtags et instant de couverture, liés à la version du montage (`version` = updated_at du montage au moment de
 * l'enregistrement, posé par le serveur). Enregistrer le post ne modifie ni la vidéo ni sa version : aucun rendu ni
 * aucune validation n'est invalidé. Un mot-clé préparé n'active aucune réponse automatique en DM.
 */
export const POST_CAPTION_MAX = 2200;
export const POST_HASHTAGS_MAX = 30;

export const PostSchema = z.strictObject({
  caption: z.string().max(POST_CAPTION_MAX, `Légende de ${POST_CAPTION_MAX} caractères au plus.`),
  cta: z.string().trim().max(120),
  keyword: z.string().trim().regex(/^([A-ZÀ-Ý0-9]{2,20})?$/, "Mot-clé en majuscules, sans espace (ex. CLUB), ou vide."),
  destination: z.string().trim().max(300),
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]{1,60}$/u, "Hashtag invalide.")).max(POST_HASHTAGS_MAX, `${POST_HASHTAGS_MAX} hashtags au plus.`),
  coverMs: z.number().int().min(0).max(600_000),
});
export type PostInput = z.infer<typeof PostSchema>;
export type MontagePost = PostInput & { version: string; savedAt: string };
