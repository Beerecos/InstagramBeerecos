/**
 * STYLES DE SOUS-TITRES (refonte du Studio, 2026-11-10) : cinq comportements exprimés en configuration, rendus par le
 * même moteur (edit-composition.ts). Un style règle le découpage (2 à 6 mots selon le style, coupé aux pauses et aux
 * fins de phrase), l'animation des mots et la taille par défaut. Sans style choisi : « Highlight », le rendu d'avant
 * (4 mots, mot prononcé allumé), si bien que les montages déjà enregistrés se rejouent à l'identique.
 */
export const CAPTION_MODES = ["dynamic", "clean", "highlight", "punch", "minimal"] as const;
export type CaptionMode = (typeof CAPTION_MODES)[number];

export type CaptionModeDef = {
  label: string;
  hint: string;
  /** Découpage des pages : mots et signes au plus. */
  maxWords: number;
  maxChars: number;
  /** Le mot prononcé prend la couleur d'accent. */
  karaoke: boolean;
  /** Les mots apparaissent au moment où ils sont dits. */
  reveal: boolean;
  /** Taille par défaut (px), si aucune taille n'est choisie. */
  fontSize: number;
  uppercase: boolean;
  weight: 500 | 600 | 700 | 800;
  /** Cartouche derrière le texte (sinon ombre portée seule, plus discret). */
  box: boolean;
};

export const CAPTION_MODE: Record<CaptionMode, CaptionModeDef> = {
  dynamic: { label: "Dynamic", hint: "Les mots apparaissent au rythme de ta voix", maxWords: 3, maxChars: 20, karaoke: true, reveal: true, fontSize: 60, uppercase: false, weight: 700, box: true },
  clean: { label: "Clean", hint: "Une phrase simple, très lisible", maxWords: 6, maxChars: 34, karaoke: false, reveal: false, fontSize: 48, uppercase: false, weight: 500, box: true },
  highlight: { label: "Highlight", hint: "Le mot prononcé est mis en valeur", maxWords: 4, maxChars: 26, karaoke: true, reveal: false, fontSize: 40, uppercase: false, weight: 500, box: true },
  punch: { label: "Punch", hint: "Très gros, deux mots à la fois", maxWords: 2, maxChars: 16, karaoke: true, reveal: true, fontSize: 84, uppercase: true, weight: 800, box: true },
  minimal: { label: "Minimal", hint: "Discret, sans cartouche", maxWords: 5, maxChars: 30, karaoke: false, reveal: false, fontSize: 36, uppercase: false, weight: 500, box: false },
};

/** Style en vigueur (rendu d'avant si aucun). */
export const captionModeOf = (style: { mode?: CaptionMode } | undefined): CaptionMode => style?.mode ?? "highlight";
