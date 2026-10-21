/**
 * Boîte à outils commune des animations de montage : zones de sécurité, entrées / sorties, compteur.
 * Tout renvoie des chaînes (HTML ou tweens GSAP sur la timeline `tl`) : rien ne s'exécute au build,
 * et chaque tween est positionné en secondes du montage, donc l'image est la même à chaque rendu.
 */
export { escapeHtml } from "./reel.ts";

/** Zones de sécurité Instagram en 1080×1920 (px) : ni le haut, ni les 20 % du bas, ni le bord droit. */
export const SAFE = { top: 260, bottom: 420, left: 90, right: 170 } as const;
/** Bloc pleine largeur dans les zones de sécurité ; ajouter `top`, `bottom` ou `inset` selon l'animation. */
export const SAFE_BLOCK = `position: absolute; left: ${SAFE.left}px; right: ${SAFE.right}px;`;

/** Arrondi au centième de seconde (évite des positions comme 0.30000000000000004 dans la timeline). */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Instant de sortie : l'animation est finie 50 ms avant la fin du clip (fenêtre de visibilité [début, fin)). */
export const exitAt = (ctx: { start: number; duration: number }, d = 0.3) => r2(Math.max(ctx.start, ctx.start + ctx.duration - d - 0.05));

const sel = (id: string) => JSON.stringify(`#${id}`);

/** Entrée signature BeeRecos : flou → net, en montant légèrement (expo). */
export const blurIn = (id: string, at: number, opts: { y?: number; blur?: number; duration?: number } = {}) => {
  const { y = 40, blur = 10, duration = 0.6 } = opts;
  return `tl.fromTo(${sel(id)}, { y: ${y}, opacity: 0, filter: "blur(${blur}px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: ${duration}, ease: "expo.out" }, ${r2(at)});`;
};

/** Apparition simple en fondu. */
export const fadeIn = (id: string, at: number, duration = 0.4) => `tl.fromTo(${sel(id)}, { opacity: 0 }, { opacity: 1, duration: ${duration}, ease: "power2.out" }, ${r2(at)});`;

/** Arrivée latérale (listes, éléments secondaires). */
export const slideIn = (id: string, at: number, opts: { x?: number; duration?: number } = {}) => {
  const { x = -40, duration = 0.5 } = opts;
  return `tl.fromTo(${sel(id)}, { x: ${x}, opacity: 0 }, { x: 0, opacity: 1, duration: ${duration}, ease: "expo.out" }, ${r2(at)});`;
};

/** Sortie en fondu, terminée avant la fin du clip. */
export const fadeOut = (id: string, ctx: { start: number; duration: number }, duration = 0.3) => `tl.to(${sel(id)}, { opacity: 0, duration: ${duration}, ease: "power2.in" }, ${exitAt(ctx, duration)});`;

/**
 * Trait qui barre un texte, ligne après ligne (l'élément est un `<span>` en ligne avec `STRIKE_CSS`) :
 * on anime la largeur d'un fond en dégradé, qui suit les retours à la ligne.
 */
export const strikeThrough = (id: string, at: number, duration = 0.6) =>
  `tl.fromTo(${sel(id)}, { backgroundSize: "0% 8px" }, { backgroundSize: "100% 8px", duration: ${duration}, ease: "power3.inOut" }, ${r2(at)});`;
export const STRIKE_CSS = "background-repeat: no-repeat; background-position: 0 58%; background-size: 0% 8px;";

/** Nombre à la française : espace fine insécable pour les milliers, virgule décimale. */
export const formatNumber = (n: number, decimals = 0) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).replace(/\s/g, " ");

/**
 * Compteur déterministe : une suite de `tl.set` calculée au build (pas d'onUpdate), décélération en fin de course.
 * Le texte de chaque étape est encodé en JSON : aucune injection possible.
 */
export function countUp(id: string, opts: { to: number; from?: number; at: number; duration: number; decimals?: number; steps?: number }): string[] {
  const { to, from = 0, at, duration, decimals = 0, steps = 30 } = opts;
  const out: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const eased = 1 - (1 - p) ** 2.5;
    const value = i === steps ? to : from + (to - from) * eased;
    out.push(`tl.set(${sel(id)}, { textContent: ${JSON.stringify(formatNumber(value, decimals))} }, ${r2(at + p * duration)});`);
  }
  return out;
}
