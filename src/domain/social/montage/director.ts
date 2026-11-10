import type { Scene } from "./scenes";

/**
 * AUTO DIRECTOR (refonte du Studio, 2026-11-10) : à partir d'une seule caméra, simuler plusieurs plans (100 %, 110 %,
 * 115 %, 125 %, léger décalage gauche ou droite) aux moments qui le justifient : accroche, changement d'idée, chiffre ou
 * preuve, phrase forte, appel à l'action. Déterministe (même montage → mêmes plans), jamais de zoom permanent : on revient
 * au plan large régulièrement. Pas de détection du visage (non disponible) : le plan serré est centré en haut du cadre,
 * là où se trouve le visage dans un tournage face caméra ; un recadrage manuel (« Cadrage ») reste prioritaire.
 */
export const DIRECTOR_INTENSITIES = ["sobre", "equilibre", "dynamique"] as const;
export type DirectorIntensity = (typeof DIRECTOR_INTENSITIES)[number];
export const DIRECTOR_LABEL: Record<DirectorIntensity, { label: string; hint: string }> = {
  sobre: { label: "Sobre", hint: "Un plan serré sur l'accroche et l'appel à l'action" },
  equilibre: { label: "Équilibré", hint: "Un changement de plan à chaque idée forte" },
  dynamique: { label: "Dynamique", hint: "Plans variés, cadrages gauche et droite" },
};

/** Un plan : à partir de `atMs` (temps source), zoom et décalage horizontal (px, sur 1080). */
export type Shot = { atMs: number; zoom: number; offsetX: number; reason: string };

/** Durée minimale d'un plan : en dessous, le changement fatigue au lieu de rythmer. */
export const MIN_SHOT_MS = 1500;

const STRONG = new Set(["PROOF", "STAT", "EMPHASIS", "QUOTE"]);

/**
 * Plans du montage, scène par scène (temps source). Le premier plan commence toujours au début de la vidéo.
 * - sobre : accroche en 110 %, appel à l'action en 110 %, le reste en plan large ;
 * - équilibré : accroche 115 %, chiffre / preuve / phrase forte 115 %, autres idées alternées 100 % / 110 %, CTA 110 % ;
 * - dynamique : accroche 125 % puis 110 %, alternance 100 / 110 / 115 avec décalages gauche-droite, scènes longues coupées.
 */
export function directorShots(scenes: Scene[], intensity: DirectorIntensity): Shot[] {
  const shots: Shot[] = [];
  const push = (atMs: number, zoom: number, offsetX: number, reason: string) => {
    const prev = shots[shots.length - 1];
    if (prev && prev.zoom === zoom && prev.offsetX === offsetX) return;
    if (prev && atMs - prev.atMs < MIN_SHOT_MS) { shots[shots.length - 1] = { atMs: prev.atMs, zoom, offsetX, reason }; return; }
    shots.push({ atMs, zoom, offsetX, reason });
  };
  let alt = 0;
  scenes.forEach((scene, i) => {
    const at = i === 0 ? 0 : scene.startMs;
    const long = scene.endMs - scene.startMs;
    if (intensity === "sobre") {
      push(at, scene.intent === "HOOK" || scene.intent === "CTA" ? 1.1 : 1, 0, scene.intent === "HOOK" ? "Accroche" : scene.intent === "CTA" ? "Appel à l'action" : "Plan large");
      return;
    }
    if (scene.intent === "HOOK") {
      push(at, intensity === "dynamique" ? 1.25 : 1.15, 0, "Accroche");
      if (intensity === "dynamique" && long > 2 * MIN_SHOT_MS) push(scene.startMs + Math.round(long / 2), 1.1, 0, "Accroche (relance)");
      return;
    }
    if (scene.intent === "CTA") { push(at, 1.1, 0, "Appel à l'action"); return; }
    if (STRONG.has(scene.intent)) { push(at, 1.15, intensity === "dynamique" ? (alt++ % 2 ? 30 : -30) : 0, "Moment fort"); return; }
    // Changement d'idée : alternance de plans, retour régulier au plan large.
    const cycle = intensity === "dynamique" ? [1, 1.1, 1.15] : [1, 1.1];
    const zoom = cycle[alt % cycle.length];
    const offset = intensity === "dynamique" && zoom > 1 ? (alt % 2 ? 30 : -30) : 0;
    alt++;
    push(at, zoom, offset, zoom === 1 ? "Plan large" : "Changement d'idée");
    if (intensity === "dynamique" && long > 6000) push(scene.startMs + Math.round(long / 2), zoom === 1 ? 1.1 : 1, 0, "Relance du rythme");
  });
  return shots;
}

/** Plan en vigueur à un instant (temps source). */
export function shotAt(shots: Shot[], ms: number): Shot {
  let cur = shots[0] ?? { atMs: 0, zoom: 1, offsetX: 0, reason: "Plan large" };
  for (const s of shots) if (s.atMs <= ms) cur = s;
  return cur;
}
