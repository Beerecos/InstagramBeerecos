import { z } from "zod";

/**
 * « MON MODÈLE » (demande de Cédric, 2026-11-09 : « je veux créer moi-même une base d'animation […] comme template de
 * base »). Les réglages que Cédric choisit dans l'éditeur du Studio remplacent ceux du Standard BeeRecos v1 lorsque le
 * montage applique la dynamique automatique. Seuls des choix déjà validés par la charte sont possibles (positions,
 * couleurs, entrées des grands mots) : l'éditeur n'invente ni police ni couleur. Tout texte vient toujours de ce qui
 * est dit (standard.ts).
 */

export const BIG_WORD_POSITIONS = ["haut", "milieu"] as const;
export const BIG_WORD_COLORS = ["blanc", "bleu", "noir"] as const;
export const BIG_WORD_ENTRIES = ["flou", "rebond", "verticale", "laterale"] as const;

export const POSITION_LABEL: Record<(typeof BIG_WORD_POSITIONS)[number], string> = { haut: "En haut", milieu: "Au milieu" };
export const COLOR_LABEL: Record<(typeof BIG_WORD_COLORS)[number], string> = { blanc: "Blanc", bleu: "Bleu BeeRecos", noir: "Noir" };
export const ENTRY_LABEL: Record<(typeof BIG_WORD_ENTRIES)[number], string> = { flou: "Flou", rebond: "Rebond", verticale: "Verticale", laterale: "Latérale" };

const BigWordStyle = z.strictObject({
  position: z.enum(BIG_WORD_POSITIONS),
  couleur: z.enum(BIG_WORD_COLORS),
  entree: z.enum(BIG_WORD_ENTRIES),
});
export type BigWordStyle = z.infer<typeof BigWordStyle>;

/** Animations que la dynamique automatique peut poser (en plus des grands mots). */
export const AUTO_ANIMATIONS = ["onglet", "chiffre", "liste", "mot-cle", "logo-fin"] as const;
export type AutoAnimation = (typeof AUTO_ANIMATIONS)[number];
export const AUTO_LABEL: Record<AutoAnimation, string> = {
  onglet: "Onglet sur les idées fortes", chiffre: "Chiffres prononcés", liste: "Étapes énumérées", "mot-cle": "Pastille « Commente MOT »", "logo-fin": "Vidéo de fin BeeRecos",
};

export const AnimationTemplateSchema = z.strictObject({
  /** Format des réglages (pour faire évoluer le modèle sans casser les versions enregistrées). */
  format: z.literal(1),
  name: z.string().trim().min(1).max(60),
  /** Accroche (premier grand mot) et « à retenir » (dernier grand mot). */
  hook: BigWordStyle,
  takeaway: BigWordStyle,
  /** Durée d'affichage d'un grand mot ou d'un onglet. */
  overlayMs: z.number().int().min(1500).max(4000),
  /** Grands mots derrière la personne (0 : toujours devant, en onglet). Un détourage de la prise reste nécessaire. */
  maxBehind: z.number().int().min(0).max(3),
  /** Écart minimal entre deux débuts d'animation. */
  minSpacingMs: z.number().int().min(2000).max(8000),
  /** Animations posées automatiquement. */
  auto: z.strictObject(Object.fromEntries(AUTO_ANIMATIONS.map((a) => [a, z.boolean()])) as Record<AutoAnimation, z.ZodBoolean>),
});
export type AnimationTemplate = z.infer<typeof AnimationTemplateSchema>;

/** Le Standard BeeRecos v1 (validé par Cédric le 2026-11-04) exprimé comme un modèle : point de départ de l'éditeur. */
export const STANDARD_TEMPLATE: AnimationTemplate = {
  format: 1,
  name: "Standard v1",
  hook: { position: "haut", couleur: "blanc", entree: "rebond" },
  takeaway: { position: "milieu", couleur: "bleu", entree: "verticale" },
  overlayMs: 2500,
  maxBehind: 2,
  minSpacingMs: 4000,
  auto: { onglet: true, chiffre: true, liste: true, "mot-cle": true, "logo-fin": true },
};

/** Réglages lus (base de données, brouillon) : valides, sinon null (jamais un modèle à moitié appliqué). */
export function parseTemplate(raw: unknown): AnimationTemplate | null {
  const r = AnimationTemplateSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Points d'attention de charte d'un modèle (n'empêchent pas l'enregistrement). */
export function templateWarnings(t: AnimationTemplate): string[] {
  const w: string[] = [];
  if (!t.auto["logo-fin"]) w.push("Sans logo de fin, la vidéo ne se conclut pas par le logo officiel et la baseline BeeRecos.");
  if (!t.auto["mot-cle"]) w.push("Sans pastille « Commente MOT », l'appel à l'action n'est pas affiché.");
  if (t.maxBehind > 0 && t.hook.couleur === t.takeaway.couleur && t.hook.position === t.takeaway.position && t.hook.entree === t.takeaway.entree)
    w.push("Accroche et « à retenir » sont identiques : la fin ressemblera au début.");
  return w;
}
