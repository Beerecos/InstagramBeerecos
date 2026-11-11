import type { Edit } from "./edit";

/**
 * Styles de départ du Studio (2026-11-11) : Sobre, Dynamique, Impact. Un style règle d'un coup les sous-titres, les
 * plans (Auto Director), les accents sonores et l'intensité des animations ; chaque réglage reste modifiable ensuite.
 * Les animations dont l'intensité a été réglée à la main gardent leur valeur.
 */
export const STUDIO_PRESETS = {
  sobre: { label: "Sobre", caption: "clean", director: "sobre", sons: false, intensite: 0.6 },
  dynamique: { label: "Dynamique", caption: "dynamic", director: "equilibre", sons: true, intensite: 1 },
  impact: { label: "Impact", caption: "punch", director: "dynamique", sons: true, intensite: 1.4 },
} as const;
export type StudioPreset = keyof typeof STUDIO_PRESETS;

export function applyStudioPreset(edit: Edit, preset: StudioPreset, opts: { manualIntensity?: Set<string> } = {}): Edit {
  const p = STUDIO_PRESETS[preset];
  const keep = opts.manualIntensity ?? new Set<string>();
  return {
    ...edit,
    captionStyle: { ...edit.captionStyle, mode: p.caption },
    rythme: { zoomCoupes: false, zoom: 1.1, volumeSon: 0.35, ...edit.rythme, director: p.director },
    effetsSonores: { actif: p.sons, volumes: edit.effetsSonores?.volumes ?? { clic: 0.22, saisie: 0.18, glisse: 0.2 } },
    custom: edit.custom.map((c) => (c.id && keep.has(c.id) ? c : { ...c, intensite: p.intensite })),
  };
}
