export const PILLARS = ["reseau_monetise", "formation", "digitalisation_ia"] as const;
export type Pillar = (typeof PILLARS)[number];

export const PILLAR_LABELS: Record<Pillar, string> = {
  reseau_monetise: "Réseau MONÉTISÉ",
  formation: "Formation",
  digitalisation_ia: "Digitalisation IA",
};

export const CREATION_MODES = ["ai", "human", "hybrid"] as const;
export type CreationMode = (typeof CREATION_MODES)[number];

export const CREATION_MODE_LABELS: Record<CreationMode, string> = {
  ai: "IA",
  human: "Humain",
  hybrid: "Hybride",
};

/** Cycle éditorial d'un contenu. */
export const CONTENT_STAGES = [
  "idea",
  "script",
  "production",
  "review",
  "approved",
  "scheduled",
  "published",
  "analyzed",
] as const;
export type ContentStage = (typeof CONTENT_STAGES)[number];

/** États techniques d'une vidéo. */
export const VIDEO_STATES = [
  "draft",
  "script_ready",
  "storyboard_ready",
  "generating",
  "assembling",
  "ready_for_review",
  "approved",
  "scheduled",
  "published",
  "failed",
  "archived",
] as const;
export type VideoState = (typeof VIDEO_STATES)[number];

export const AUTONOMY_MODES = ["manual", "validation", "autopilot"] as const;
export type AutonomyMode = (typeof AUTONOMY_MODES)[number];

export const AUTONOMY_LABELS: Record<AutonomyMode, string> = {
  manual: "Manuel",
  validation: "Validation",
  autopilot: "Autopilot",
};

export type PillarWeights = Record<Pillar, number>;

/** Normalise des pondérations saisies librement pour qu'elles totalisent 100. */
export function normalizeWeights<K extends string>(weights: Record<K, number>): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const clean = keys.map((k) => Math.max(0, Number.isFinite(weights[k]) ? weights[k] : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  if (total === 0) {
    const even = Math.floor(100 / keys.length);
    return Object.fromEntries(keys.map((k, i) => [k, i === 0 ? 100 - even * (keys.length - 1) : even])) as Record<K, number>;
  }
  const scaled = clean.map((v) => (v / total) * 100);
  const rounded = scaled.map(Math.floor);
  let rest = 100 - rounded.reduce((a, b) => a + b, 0);
  // Répartit le reste aux plus grandes parties décimales (méthode du plus fort reste).
  const order = scaled.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest-- <= 0) break;
    rounded[i] += 1;
  }
  return Object.fromEntries(keys.map((k, i) => [k, rounded[i]])) as Record<K, number>;
}
