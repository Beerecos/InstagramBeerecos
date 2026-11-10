/**
 * VISUAL BEAT GRID : 120 BPM par défaut (1 temps = 500 ms, demi-temps = 250 ms). Un événement proposé est calé sur le
 * temps (ou demi-temps) le plus proche s'il est à moins de `tolerance` ms ; la parole reste prioritaire : on ne s'écarte
 * jamais de plus de `maxSpeechDrift` ms du mot qu'il illustre.
 */
export const DEFAULT_BPM = 120;
export const beatMs = (bpm = DEFAULT_BPM) => 60000 / bpm;

type SnapOpts = { bpm?: number; half?: boolean; tolerance?: number; speechMs?: number; maxSpeechDrift?: number };

export function snap(atMs: number, o: SnapOpts = {}): number {
  const step = beatMs(o.bpm) / (o.half === false ? 1 : 2);
  const target = Math.round(atMs / step) * step;
  if (Math.abs(target - atMs) > (o.tolerance ?? 80)) return Math.round(atMs);
  if (o.speechMs !== undefined && Math.abs(target - o.speechMs) > (o.maxSpeechDrift ?? 100)) return Math.round(atMs);
  return Math.round(target);
}
export const snapToBeat = (atMs: number, o: Omit<SnapOpts, "half"> = {}) => snap(atMs, { ...o, half: false });
export const snapToHalfBeat = (atMs: number, o: Omit<SnapOpts, "half"> = {}) => snap(atMs, { ...o, half: true });

/** Temps (ms) de la grille entre deux instants, pour l'affichage de la timeline. */
export function beatTicks(fromMs: number, toMs: number, bpm = DEFAULT_BPM): number[] {
  const b = beatMs(bpm), out: number[] = [];
  for (let t = Math.ceil(fromMs / b) * b; t <= toMs; t += b) out.push(Math.round(t));
  return out;
}
