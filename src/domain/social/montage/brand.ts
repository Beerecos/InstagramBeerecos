/**
 * Charte des compositions de montage (1080×1920) : couleurs d'accent, échappement HTML, dimensions du logo officiel.
 * Repris de BeeMarketing (InstagramBeerecos, src/domain/video/reel.ts) pour que le montage ne dépende de rien d'autre.
 */
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;

/**
 * Palette de la charte BeeRecos (brandguide octobre 2026) — mêmes valeurs que les Reels IA (`src/lib/reel-story/brand.ts`,
 * vérifié par test). Les vidéos montées n'utilisent que le bleu, le noir et le blanc (violet et vert : carrousels et Reels IA
 * seulement). Les animations du montage ne lisent AUCUNE autre couleur (contrôle mesuré : `charte.test.ts`).
 */
export const COLORS = {
  blue: "#2851FF",
  black: "#000000",
  white: "#FFFFFF",
  violet: "#693BFC",
  green: "#3BCAC2",
} as const;

/**
 * Accent des vidéos montées : le bleu BeeRecos, seul (décision de Cédric du 2026-10-22 : « palette bleu, noir et blanc »
 * du prompt maître des réseaux sociaux ; violet et vert retirés du choix).
 */
export const ACCENT = { bleu: COLORS.blue } as const;
export type AccentName = keyof typeof ACCENT;
export const DEFAULT_ACCENT: AccentName = "bleu";
/** Rouge des bandeaux d'erreur de l'aperçu (jamais rendu : une animation en erreur bloque l'enregistrement). */
export const ALERT = "#D93025";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Tout texte venant du modèle ou de l'utilisateur est échappé : aucune balise ni script ne peut entrer dans la composition. */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Filigrane fourni par Cédric le 2026-11-02 : PNG RGBA original, sans fond ni redessin. */
export const STUDIO_LOGO = { file: "brand/beerecos-logo-transparent.png", ratio: 781 / 906 } as const;
/** Réglage standard du logo dans son cercle blanc, fixé par Cédric le 2026-11-10 : 220 px, 100 px à droite, 200 px en bas. */
export const STUDIO_LOGO_DEFAULT = { width: 220, right: 100, bottom: 200, opacity: 1 } as const;

/**
 * Logo de fin des vidéos montées : version horizontale officielle (pictogramme et « Recos » bleus, « Bee » noir) sur fond
 * blanc, fournie par Cédric le 2026-10-22 avec la baseline manuscrite dessous. Fichiers raster jamais redessinés, tirés de
 * cet original (fond presque blanc, 253-254, passé au blanc pur ; marges rognées au ras du logo) et coupés en deux à la
 * même échelle et à la même largeur : `beerecos-logo-horizontal.webp` (le logo) et `beerecos-baseline.webp` (la baseline
 * manuscrite), pour pouvoir écarter la baseline du logo. Ratio hauteur / largeur de chaque fichier.
 */
export const END_LOGO = {
  plain: { file: "brand/beerecos-logo-horizontal.webp", ratio: 390 / 1752 },
  baseline: { file: "brand/beerecos-baseline.webp", ratio: 106 / 1752 },
} as const;
/**
 * Vidéo de fin officielle (fournie par Cédric le 2026-11-10, « en remplacement de la page blanche BeeRecos ») : logo,
 * LIKE · COMMENTE · PARTAGE · ABONNE-TOI et #MonReseauCestTonReseau, 7,8 s, sans son. Fichier d'origine 2160 × 3840
 * réduit en 1080 × 1920 (H.264, 30 i/s), jamais retouché. Ajoutée après la dernière image de chaque Reel qui se termine
 * par le logo de fin (animation « logo-fin » ou écran de fin).
 */
export const END_VIDEO = { file: "brand/beerecos-video-fin.mp4", durationMs: 7800 } as const;
/** Espace entre le logo et la baseline (« mets le # un peu plus bas », Cédric, 2026-10-22). */
export const END_BASELINE_GAP = 56;
/**
 * Largeur du logo de fin : 740 px, la plus grande qui reste centrée (x = 540) dans les zones de sécurité (170 px de chaque
 * côté). Demandes de Cédric du 2026-10-22 : « plus aéré », puis « BeeRecos et le # plus gros ».
 */
export const END_LOGO_WIDTH = 740;

/**
 * Baseline officielle, écrite telle quelle : une ligne, sans espace, accent ni changement de casse. Seul texte composé
 * en écriture manuscrite Caveat Medium (exception à « Poppins seule », décision de Cédric du 2026-10-21).
 */
export const BASELINE = "#MonReseauCestTonReseau";
/** Nom de marque : casse imposée dans tout texte affiché. */
export const BRAND_NAME = "BeeRecos";
export const BASELINE_FONT = "Caveat";

/**
 * Sous-titres sur le canevas 1080 × 1920 (règles de rendu réseaux sociaux, 2026-10-21) : bloc centré en x = 540,
 * 760 px de large au plus, zone y = 1460 → 1600, Poppins Medium 44 px, deux lignes au plus. Repères de montage
 * réglables dans edit.json (`captionStyle`), à contrôler dans l'aperçu de publication.
 */
export const CAPTION_DEFAULTS = { top: 1460, height: 140, maxWidth: 760, fontSize: 44 } as const;
