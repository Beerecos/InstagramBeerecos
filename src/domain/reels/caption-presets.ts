/**
 * Sous-titres en mode simple : quatre styles aux couleurs de la charte (bleu #2851FF, blanc, noir), trois tailles,
 * trois positions. Chaque choix se traduit en `captionStyle` accepté tel quel par le serveur (couleurs #RRGGBB,
 * taille 32-120 px, position 900-1700 px).
 */
import type { Edit } from "@/domain/social/montage/edit";

type Style = Edit["captionStyle"];
export type CaptionPreset = { key: string; label: string; color: string; highlightColor: string; backgroundColor: string };

export const CAPTION_PRESETS: CaptionPreset[] = [
  { key: "classique", label: "Classique", color: "#BFBFBF", highlightColor: "#FFFFFF", backgroundColor: "#000000" },
  { key: "bleu", label: "Bleu BeeRecos", color: "#C9D4FF", highlightColor: "#FFFFFF", backgroundColor: "#2851FF" },
  { key: "blanc", label: "Blanc", color: "#8A8A8A", highlightColor: "#000000", backgroundColor: "#FFFFFF" },
  { key: "noir-bleu", label: "Noir et bleu", color: "#FFFFFF", highlightColor: "#2851FF", backgroundColor: "#000000" },
];
export const CAPTION_SIZES = [{ key: "petit", label: "Petit", fontSize: 40 }, { key: "moyen", label: "Moyen", fontSize: 52 }, { key: "grand", label: "Grand", fontSize: 64 }] as const;
export const CAPTION_POSITIONS = [{ key: "haut", label: "Haut", top: 980 }, { key: "milieu", label: "Milieu", top: 1240 }, { key: "bas", label: "Bas", top: 1460 }] as const;

export function presetOf(style: Style): string | null {
  const p = CAPTION_PRESETS.find((x) => x.color === style.color && x.highlightColor === style.highlightColor && x.backgroundColor === style.backgroundColor);
  return p?.key ?? (style.color || style.highlightColor || style.backgroundColor ? null : "classique");
}
/** Taille ou position la plus proche du réglage actuel (un réglage fait en mode avancé reste lisible). */
export function nearest<T extends { key: string }>(items: readonly T[], value: number | undefined, pick: (t: T) => number, fallback: string): string {
  if (value === undefined) return fallback;
  return items.reduce((best, t) => (Math.abs(pick(t) - value) < Math.abs(pick(best) - value) ? t : best), items[0]).key;
}

export function withPreset(style: Style, key: string): Style {
  const p = CAPTION_PRESETS.find((x) => x.key === key);
  return p ? { ...style, color: p.color, highlightColor: p.highlightColor, backgroundColor: p.backgroundColor } : style;
}
export const withSize = (style: Style, key: string): Style => ({ ...style, fontSize: CAPTION_SIZES.find((s) => s.key === key)?.fontSize ?? style.fontSize });
export const withPosition = (style: Style, key: string): Style => ({ ...style, top: CAPTION_POSITIONS.find((s) => s.key === key)?.top ?? style.top });
