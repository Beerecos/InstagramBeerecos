/**
 * EDITORIAL IMPACT — jetons du système de motion design (Cédric, 2026-11-10, « AI Motion Director »).
 * Toutes les durées viennent d'ici (en images à 30 i/s) : aucune valeur arbitraire dans les scènes.
 * Charte BeeRecos : Poppins seule police (brand.md) ; la densité « condensée » vient de la graisse 800, d'un interlignage
 * serré et d'un approche négatif, pas d'une autre police.
 */
export const FPS = 30;
export const W = 1080;
export const H = 1920;

/** Durées en images (30 i/s) : micro 167 ms · fast 233 · normal 333 · transition 367 · card 400 · slow 600. */
export const MOTION = { micro: 5, fast: 7, normal: 10, transition: 11, card: 12, slow: 18 } as const;
export const frames = (n: number) => Math.round((n * 1000) / FPS);
export const ms = (k: keyof typeof MOTION) => frames(MOTION[k]);

export const PALETTE = { dark: "#0B0B0B", light: "#F6F5F0", brand: "#2851FF", white: "#FFFFFF", ink: "#0A0A0A", muted: "#6B6B6B" } as const;
export type Background = "dark" | "light" | "brand";
export const BG: Record<Background, { fill: string; text: string; accent: string; texture: string | null }> = {
  dark: { fill: PALETTE.dark, text: PALETTE.white, accent: PALETTE.brand, texture: "rgba(255,255,255,0.045)" },
  light: { fill: PALETTE.light, text: PALETTE.ink, accent: PALETTE.brand, texture: "rgba(0,0,0,0.035)" },
  brand: { fill: PALETTE.brand, text: PALETTE.white, accent: PALETTE.ink, texture: "rgba(255,255,255,0.05)" },
};

/** Échelle typographique (px sur 1080 × 1920). */
export const TYPE = { stat: 230, mega: 150, headline: 108, secondary: 58, pill: 40, micro: 28 } as const;

/** Zones de sécurité Instagram (plus strictes que le minimum demandé ; bord droit protégé). */
export const SAFE = { left: 90, right: 150, top: 230, bottom: 360 } as const;

/** Dynamique 1 → 5 : écart visé entre deux micro-événements (ms), zoom max, place des wipes. */
export const INTENSITY = {
  1: { label: "Minimal", gap: [1000, 1500], zoom: 1.02, wipes: 0.2 },
  2: { label: "Premium", gap: [700, 1100], zoom: 1.03, wipes: 0.4 },
  3: { label: "Dynamique", gap: [500, 850], zoom: 1.04, wipes: 0.6 },
  4: { label: "Editorial Impact", gap: [350, 650], zoom: 1.07, wipes: 0.8 },
  5: { label: "Maximum", gap: [250, 500], zoom: 1.07, wipes: 1 },
} as const;
export type Intensity = keyof typeof INTENSITY;
