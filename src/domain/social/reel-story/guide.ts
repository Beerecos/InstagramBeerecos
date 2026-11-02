import { PICTOGRAM } from "./brand";

/**
 * Le GUIDE — pictogramme officiel BeeRecos utilisé comme personnage de marque récurrent.
 * SOURCE UNIQUE de ses réglages : fichiers, proportions, durées et amplitudes, pour le montage des Reels
 * (composition.ts → aperçu et MP4) comme pour le composant de l'interface (PictogramGuide.tsx).
 *
 * Règles : le pictogramme entier vit dans UN conteneur ; seuls l'opacité, la translation et une mise à l'échelle
 * uniforme centrée sont animées. Jamais de rotation, de déformation, d'ombre, de contour ni d'élément ajouté.
 */

export type GuideMode = "discret" | "dynamique";
export type GuideState = "entrer" | "attendre" | "reagir" | "accompagner" | "sortir";

export type GuideMotion = {
  /** Entrer : opacité 0 → 1 et montée douce de `rise` px. */
  enter: { duration: number; rise: number };
  /** Rebond vertical amorti (sans écrasement) après l'entrée. */
  bounce: { duration: number; amplitude: number };
  /** Réagir : pulsation uniforme 100 % → `scale` → 100 %. */
  react: { duration: number; scale: number };
  /** Accompagner : déplacement vers la scène suivante. */
  accompany: { duration: number; nudge: number };
  /** Sortir : disparition par opacité. */
  exit: { duration: number };
};

export const GUIDE_MOTION: Record<GuideMode, GuideMotion> = {
  discret: {
    enter: { duration: 0.55, rise: 24 },
    bounce: { duration: 0.6, amplitude: 6 },
    react: { duration: 0.5, scale: 1.02 },
    accompany: { duration: 0.5, nudge: 5 },
    exit: { duration: 0.4 },
  },
  dynamique: {
    enter: { duration: 0.45, rise: 40 },
    bounce: { duration: 0.6, amplitude: 12 },
    react: { duration: 0.4, scale: 1.03 },
    accompany: { duration: 0.4, nudge: 10 },
    exit: { duration: 0.3 },
  },
};

export const GUIDE_MODE_LABEL: Record<GuideMode, string> = { discret: "Mouvement discret", dynamique: "Mouvement dynamique" };

/** Ratio largeur / hauteur du pictogramme officiel. */
export const GUIDE_RATIO = PICTOGRAM.ratio;

/**
 * Démonstration de référence (7 s) qui définit la gestuelle : apparition et montée (0–0,6 s), rebond amorti
 * (0,6–1,5 s), pause, pulsation 100 → 103 → 100 % (3–3,8 s), maintien, disparition par opacité (6,4–7 s).
 * Exprimée en images clés (offset 0–1) : opacité, translation verticale (px) et échelle uniforme.
 */
export const REFERENCE_DEMO = {
  duration: 7,
  keyframes: [
    { t: 0, opacity: 0, y: 28, scale: 1 },
    { t: 0.6, opacity: 1, y: 0, scale: 1 },
    { t: 0.8, opacity: 1, y: -10, scale: 1 },
    { t: 1.0, opacity: 1, y: 0, scale: 1 },
    { t: 1.2, opacity: 1, y: -4, scale: 1 },
    { t: 1.5, opacity: 1, y: 0, scale: 1 },
    { t: 3.0, opacity: 1, y: 0, scale: 1 },
    { t: 3.4, opacity: 1, y: 0, scale: 1.03 },
    { t: 3.8, opacity: 1, y: 0, scale: 1 },
    { t: 6.4, opacity: 1, y: 0, scale: 1 },
    { t: 7.0, opacity: 0, y: 0, scale: 1 },
  ],
} as const;

/** Images clés Web Animations d'un état (interface BeeMarketing), avec les mêmes réglages que le montage. */
/** Image clé compatible Web Animations (sans dépendre des types DOM, ce module tourne aussi côté serveur). */
export type GuideKeyframe = { offset?: number; opacity?: number; transform?: string };

export function guideKeyframes(state: GuideState, mode: GuideMode): { keyframes: GuideKeyframe[]; duration: number; easing: string } {
  const m = GUIDE_MOTION[mode];
  const tf = (y: number, s = 1) => `translateY(${y}px) scale(${s})`;
  switch (state) {
    case "entrer":
      return { keyframes: [{ opacity: 0, transform: tf(m.enter.rise) }, { opacity: 1, transform: tf(0) }], duration: m.enter.duration * 1000, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
    case "attendre":
      return { keyframes: [{ transform: tf(0) }, { transform: tf(-m.bounce.amplitude), offset: 0.3 }, { transform: tf(0), offset: 0.6 }, { transform: tf(-m.bounce.amplitude / 3), offset: 0.8 }, { transform: tf(0) }], duration: m.bounce.duration * 1000, easing: "ease-out" };
    case "reagir":
      return { keyframes: [{ transform: tf(0, 1) }, { transform: tf(0, m.react.scale), offset: 0.45 }, { transform: tf(0, 1) }], duration: m.react.duration * 1000, easing: "ease-in-out" };
    case "accompagner":
      return { keyframes: [{ transform: tf(0) }, { transform: tf(-m.accompany.nudge), offset: 0.5 }, { transform: tf(0) }], duration: m.accompany.duration * 1000, easing: "ease-in-out" };
    case "sortir":
      return { keyframes: [{ opacity: 1 }, { opacity: 0 }], duration: m.exit.duration * 1000, easing: "ease-in" };
  }
}

/** Position du guide dans une scène : centre (px) et hauteur affichée (échelle uniforme). */
export type GuidePose = { cx: number; cy: number; h: number };

/** Taille de référence du conteneur dans la composition (px). */
export const GUIDE_BASE_HEIGHT = 240;
export const GUIDE_BASE_WIDTH = Math.round(GUIDE_BASE_HEIGHT * GUIDE_RATIO);

const r = (n: number) => Math.round(n * 1000) / 1000;
const pose = (p: GuidePose) => `x: ${r(p.cx - GUIDE_BASE_WIDTH / 2)}, y: ${r(p.cy - GUIDE_BASE_HEIGHT / 2)}, scale: ${r(p.h / GUIDE_BASE_HEIGHT)}`;

/**
 * Le même composant côté montage : chaque état produit des tweens GSAP sur `#guide` (le conteneur unique).
 * Les durées viennent de GUIDE_MOTION ; les mouvements des Reels restent entre 0,3 et 0,8 s.
 */
export function guideGsap(mode: GuideMode) {
  const m = GUIDE_MOTION[mode];
  return {
    /** Pose immédiate (coupe franche). */
    place: (at: number, p: GuidePose) => `tl.set("#guide", { ${pose(p)} }, ${r(at)});`,
    entrer: (at: number, p: GuidePose) =>
      `tl.set("#guide", { ${pose(p)} }, ${r(at)}); tl.fromTo("#guide-in", { autoAlpha: 0, y: ${m.enter.rise} }, { autoAlpha: 1, y: 0, duration: ${m.enter.duration}, ease: "power3.out", immediateRender: false }, ${r(at)});`,
    attendre: (at: number) =>
      `tl.to("#guide-in", { keyframes: [{ y: ${-m.bounce.amplitude}, duration: ${r(m.bounce.duration * 0.3)}, ease: "power2.out" }, { y: 0, duration: ${r(m.bounce.duration * 0.3)}, ease: "power2.in" }, { y: ${r(-m.bounce.amplitude / 3)}, duration: ${r(m.bounce.duration * 0.2)}, ease: "power2.out" }, { y: 0, duration: ${r(m.bounce.duration * 0.2)}, ease: "power2.in" }] }, ${r(at)});`,
    reagir: (at: number) =>
      `tl.to("#guide-in", { keyframes: [{ scale: ${m.react.scale}, duration: ${r(m.react.duration * 0.45)}, ease: "power2.out" }, { scale: 1, duration: ${r(m.react.duration * 0.55)}, ease: "power2.inOut" }] }, ${r(at)});`,
    accompagner: (at: number, p: GuidePose) => `tl.to("#guide", { ${pose(p)}, duration: ${m.accompany.duration}, ease: "power3.inOut" }, ${r(at)});`,
    pousser: (at: number) =>
      `tl.to("#guide-in", { keyframes: [{ y: ${-m.accompany.nudge}, duration: ${r(m.accompany.duration * 0.45)}, ease: "power2.out" }, { y: 0, duration: ${r(m.accompany.duration * 0.55)}, ease: "power2.inOut" }] }, ${r(at)});`,
    sortir: (at: number) => `tl.to("#guide-in", { autoAlpha: 0, duration: ${m.exit.duration}, ease: "power1.in" }, ${r(at)});`,
    /** Variante de couleur officielle lisible sur le fond : bleu sur clair, blanc sur bleu ou noir. */
    couleur: (at: number, variant: "bleu" | "blanc") =>
      `tl.set("#guide .g-bleu", { opacity: ${variant === "bleu" ? 1 : 0} }, ${r(at)}); tl.set("#guide .g-blanc", { opacity: ${variant === "blanc" ? 1 : 0} }, ${r(at)});`,
  };
}
