/**
 * Charte BeeRecos (Brand Guidelines, version octobre 2026) — SEULE source des couleurs, polices, logos et zones
 * de sécurité des Reels. Le template ne lit jamais une couleur ou une police ailleurs : d'une vidéo à l'autre,
 * seule l'histoire change.
 */

export const COLORS = {
  blue: "#2851FF",   // couleur principale
  black: "#000000",
  white: "#FFFFFF",
  violet: "#693BFC", // secondaire : quelques accents seulement
  green: "#3BCAC2",  // secondaire : validations
} as const;

/** Poppins uniquement. Regular pour les compléments, SemiBold / Bold pour les messages forts. */
export const FONT_FAMILY = "Poppins";
export const FONT_FILES = [
  { weight: 400, file: "poppins-latin-400-normal.woff2" },
  { weight: 600, file: "poppins-latin-600-normal.woff2" },
  { weight: 700, file: "poppins-latin-700-normal.woff2" },
] as const;

/**
 * Logos officiels (fichiers SVG issus du brandguide) — jamais redessinés ni retapés en Poppins.
 * Ratios recopiés des viewBox officiels ; animer seulement l'opacité, la position et l'échelle homothétique.
 */
export const LOGOS = {
  verticalWhite: { file: "brand/beerecos-logo-white.svg", ratio: 188.106 / 176.152 },
  verticalBlue: { file: "brand/beerecos-logo-blue.svg", ratio: 188.103 / 176.152 },
  horizontalWhite: { file: "brand/beerecos-logo-horizontal-white.svg", ratio: 80.828 / 286.566 },
  /**
   * Logo de fin (signature des Reels, comme les vidéos montées) : version horizontale fournie par Cédric le 2026-10-22,
   * sur fond blanc, coupée en deux à la même échelle : le logo, puis la baseline manuscrite posée dessous.
   */
  endHorizontal: { file: "brand/beerecos-logo-horizontal.webp", ratio: 390 / 1752 },
  endBaseline: { file: "brand/beerecos-baseline.webp", ratio: 106 / 1752 },
} as const;
/**
 * Pictogramme officiel seul (brandguide p. 10 « versions secondaires »), personnage guide des Reels.
 * Fichiers vectoriels extraits SANS MODIFICATION du PDF de la charte (bleu #2851FF exact) + variante blanche
 * officielle (p. 10 et 16). Le PNG fourni par Cédric (« beerecos-letter-bleu(2).png », 436 × 782, #1552FF) se range
 * avec `npm run brand:pictogramme -- <fichier.png>` : original conservé intact + variante #2851FF au même masque alpha.
 */
export const PICTOGRAM = {
  blue: "brand/beerecos-pictogramme-bleu.svg",
  white: "brand/beerecos-pictogramme-blanc.svg",
  ratio: 79.8652 / 145.6367,
} as const;

/** Taille minimale digitale : 150 px de large (brandguide p. 13). */
export const LOGO_MIN_WIDTH = 150;
/** Zone de protection : marge libre d'au moins 1/6 de la largeur du logo autour de lui. */
export const logoClearSpace = (width: number) => Math.ceil(width / 6);

/** Nom de marque : casse imposée, y compris dans un écran composé en capitales. */
export const BRAND_NAME = "BeeRecos";
/** Prononciation donnée à la synthèse vocale (le texte affiché reste « BeeRecos ») — règle de Cédric du 2026-10-23. */
export const BRAND_SPOKEN = "Bi-reu-co";

/** Format Instagram Reels et zones de sécurité (interface Instagram en haut, en bas et à droite). */
export const FRAME = { width: 1080, height: 1920, fps: 30 } as const;
export const SAFE = { top: 250, bottom: 430, left: 90, right: 170 } as const;
export const SAFE_WIDTH = FRAME.width - SAFE.left - SAFE.right;
