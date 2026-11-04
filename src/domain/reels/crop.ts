/**
 * Recadrage 9:16 d'une prise (paysage ou autre) : passage exact entre la fenêtre choisie à la main sur l'image source
 * et le réglage `framing` de la composition, sans changer la composition (aperçu et MP4 identiques).
 *
 * Composition (edit-composition.ts) : vidéo en `object-fit: cover` dans 1080×1920, `object-position: fx% fy%`, puis
 * `transform: translate(x px, y px) scale(s)` autour du centre. Un point p du cadre (en part de 1080 ou 1920) est
 * affiché en 1/2 + t + s·(p − 1/2) : la partie visible du cadre va de 1/2 − (1/2 + t)/s, sur une largeur 1/s.
 * Toutes les mesures ici sont des parts de l'image source (0 → 1).
 */
export const TARGET = 9 / 16;

export type Framing = { x: number; y: number; scale: number; focusX?: number; focusY?: number };
/** Fenêtre gardée sur l'image source : coin haut-gauche et taille, en parts de la largeur et de la hauteur. */
export type CropWindow = { left: number; top: number; width: number; height: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Part de la source visible dans le cadre 9:16 sans zoom (cover). `aspect` = largeur / hauteur de la prise. */
export function coverShare(aspect: number) {
  return { w: Math.min(1, TARGET / aspect), h: Math.min(1, aspect / TARGET) };
}

/** Taille de la fenêtre pour un zoom donné. */
export function windowSize(aspect: number, scale: number) {
  const c = coverShare(aspect);
  return { width: c.w / scale, height: c.h / scale };
}

/** Fenêtre réellement montrée par un réglage `framing` (lecture d'un cadrage existant). */
export function windowFromFraming(aspect: number, f: Framing): CropWindow {
  const c = coverShare(aspect);
  const s = f.scale;
  const fx = (f.focusX ?? 50) / 100, fy = (f.focusY ?? 50) / 100;
  const xl = 0.5 - (0.5 + f.x / 1080) / s;
  const yl = 0.5 - (0.5 + f.y / 1920) / s;
  return { left: (1 - c.w) * fx + c.w * xl, top: (1 - c.h) * fy + c.h * yl, width: c.w / s, height: c.h / s };
}

/** Place une fenêtre (taille imposée par le zoom) pour que son coin haut-gauche soit (left, top), sans sortir de l'image. */
export function placeWindow(aspect: number, scale: number, left: number, top: number): CropWindow {
  const { width, height } = windowSize(aspect, scale);
  return { left: clamp(left, 0, 1 - width), top: clamp(top, 0, 1 - height), width, height };
}

/** Réglage `framing` qui montre exactement cette fenêtre (position par object-position, complément par translation). */
export function framingFromWindow(aspect: number, scale: number, w: CropWindow): Framing {
  const c = coverShare(aspect);
  const s = scale;
  const cx = w.left + w.width / 2, cy = w.top + w.height / 2;
  const fx = c.w < 1 ? clamp((cx - c.w / 2) / (1 - c.w), 0, 1) : 0.5;
  const fy = c.h < 1 ? clamp((cy - c.h / 2) / (1 - c.h), 0, 1) : 0.5;
  const xl = (w.left - (1 - c.w) * fx) / c.w;
  const yl = (w.top - (1 - c.h) * fy) / c.h;
  const tx = s * (0.5 - xl) - 0.5, ty = s * (0.5 - yl) - 0.5;
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    x: clamp(Math.round(tx * 1080), -540, 540),
    y: clamp(Math.round(ty * 1920), -960, 960),
    scale: r(s),
    focusX: r(fx * 100),
    focusY: r(fy * 100),
  };
}

/** Fenêtre centrée pour un zoom donné (bouton « Centrer »). */
export function centeredWindow(aspect: number, scale: number): CropWindow {
  const { width, height } = windowSize(aspect, scale);
  return { left: (1 - width) / 2, top: (1 - height) / 2, width, height };
}

/** La prise n'est pas au format 9:16 (paysage, carré, ou plus haute) : un cadrage est à choisir. */
export const needsCrop = (aspect: number) => Math.abs(aspect - TARGET) > 0.01;
