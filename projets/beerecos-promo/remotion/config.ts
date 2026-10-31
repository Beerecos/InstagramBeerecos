import raw from "../config/promo.json";

export const CFG = raw;
export type FormatKey = keyof typeof raw.formats;
export type Format = (typeof raw.formats)[FormatKey];
export const C = raw.colors;
export const FPS = raw.video.fps;

export const scene = (id: string) => {
  const s = raw.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`Scène inconnue : ${id}`);
  return s;
};

/** Secondes absolues du film → image relative au début d'une scène. */
export const sceneFrame = (id: string, seconds: number) => Math.round(seconds * FPS) - scene(id).start;
