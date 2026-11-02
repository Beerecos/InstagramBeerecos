/**
 * Timeline du studio (Instagram BeeRecos) : opérations non destructives sur les morceaux gardés de la prise (`ranges`,
 * temps de la bande source) et aimantation. La prise originale n'est jamais modifiée : couper au curseur sépare un
 * morceau en deux, retirer un morceau le sort du montage (rétablissable), tirer un bord change ses bornes.
 */
import { layout, type CaptionWord, type Range } from "@/domain/social/montage/edit";

export const MIN_PIECE_MS = 200;

/** Coupe au curseur (touche S) : le morceau qui contient `sourceMs` devient deux morceaux contigus. */
export function splitAt(ranges: Range[], sourceMs: number, minMs = MIN_PIECE_MS): Range[] | null {
  const at = Math.round(sourceMs);
  const i = ranges.findIndex((r) => at > r.fromMs && at < r.toMs);
  if (i < 0) return null;
  const r = ranges[i];
  if (at - r.fromMs < minMs || r.toMs - at < minMs) return null;
  return [...ranges.slice(0, i), { fromMs: r.fromMs, toMs: at }, { fromMs: at, toMs: r.toMs }, ...ranges.slice(i + 1)];
}

/** Morceau du montage sous un instant de la bande source, ou -1. */
export const pieceAt = (ranges: Range[], sourceMs: number) => ranges.findIndex((r) => sourceMs >= r.fromMs && sourceMs < r.toMs);

/** Retire un morceau du montage (il reste dans la prise et se rétablit) ; le montage garde au moins un morceau. */
export function removePiece(ranges: Range[], index: number): Range[] | null {
  if (ranges.length <= 1 || index < 0 || index >= ranges.length) return null;
  return ranges.filter((_, i) => i !== index);
}

/**
 * Tire le début ou la fin d'un morceau à `sourceMs`, borné par ses voisins, la prise (0 … durée) et la durée minimale ;
 * `breaks` (débuts des prises 2, 3…) : un morceau ne chevauche jamais deux prises.
 */
export function trimPiece(ranges: Range[], index: number, edge: "start" | "end", sourceMs: number, durationMs: number, breaks: number[] = [], minMs = MIN_PIECE_MS): Range[] {
  const r = ranges[index];
  if (!r) return ranges;
  const prev = ranges[index - 1], next = ranges[index + 1];
  const takeStart = Math.max(0, ...breaks.filter((b) => b <= r.fromMs));
  const takeEnd = Math.min(durationMs, ...breaks.filter((b) => b >= r.toMs));
  let v = Math.round(sourceMs);
  if (edge === "start") v = Math.min(r.toMs - minMs, Math.max(prev ? prev.toMs : 0, takeStart, v));
  else v = Math.max(r.fromMs + minMs, Math.min(next ? next.fromMs : durationMs, takeEnd, v));
  const piece = edge === "start" ? { fromMs: v, toMs: r.toMs } : { fromMs: r.fromMs, toMs: v };
  return ranges.map((x, i) => (i === index ? piece : x));
}

/** Aimantation : la valeur la plus proche parmi les repères, si elle est à moins de `toleranceMs`. */
export function snap(value: number, marks: number[], toleranceMs: number): number {
  let best = value, dist = toleranceMs + 1;
  for (const m of marks) { const d = Math.abs(m - value); if (d < dist) { dist = d; best = m; } }
  return dist <= toleranceMs ? best : value;
}

/** Repères d'aimantation dans la bande source : début et fin de chaque mot. */
export const wordMarks = (words: CaptionWord[]) => words.flatMap((w) => [w.startMs, w.endMs]);

/** Pics d'amplitude (0…1) d'un signal, `perSecond` valeurs par seconde, normalisés sur le maximum. */
export function peaks(samples: Float32Array, sampleRate: number, perSecond = 50): Float32Array {
  const step = Math.max(1, Math.floor(sampleRate / perSecond));
  const out = new Float32Array(Math.ceil(samples.length / step));
  let max = 0;
  for (let i = 0; i < out.length; i++) {
    let m = 0;
    const end = Math.min(samples.length, (i + 1) * step);
    for (let k = i * step; k < end; k++) { const v = Math.abs(samples[k]); if (v > m) m = v; }
    out[i] = m; if (m > max) max = m;
  }
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
}

/** « 1:02.27 » : minutes, secondes et images (30 i/s) de la tête de lecture. */
export function timecode(ms: number, fps = 30): string {
  const total = Math.round((Math.max(0, ms) * fps) / 1000);
  const seconds = Math.floor(total / fps), frames = total % fps;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.${String(frames).padStart(2, "0")}`;
}


/**
 * Couper une zone marquée en temps du MONTAGE (repères I / O) : chaque morceau touché perd la partie correspondante
 * de la prise, quel que soit le nombre de morceaux traversés. Renvoie null si la zone ne laisse rien.
 */
export function cutOutputZone(ranges: Range[], outFrom: number, outTo: number): Range[] | null {
  const a = Math.min(outFrom, outTo), b = Math.max(outFrom, outTo);
  if (b - a < 40) return null;
  const pieces: Range[] = [];
  for (const sg of layout(ranges)) {
    const len = sg.toMs - sg.fromMs, from = Math.max(a, sg.atMs), to = Math.min(b, sg.atMs + len);
    const keepBefore = from > sg.atMs ? { fromMs: sg.fromMs, toMs: sg.fromMs + (from - sg.atMs) } : null;
    const keepAfter = to < sg.atMs + len ? { fromMs: sg.fromMs + (to - sg.atMs), toMs: sg.toMs } : null;
    if (to <= from) { pieces.push({ fromMs: sg.fromMs, toMs: sg.toMs }); continue; }
    for (const k of [keepBefore, keepAfter]) if (k && k.toMs - k.fromMs >= 40) pieces.push(k);
  }
  return pieces.length ? pieces : null;
}

/** Pas de déplacement au clavier : une image à 30 i/s, ou une seconde avec Maj. */
export const FRAME_MS = 1000 / 30;
export const stepMs = (shift: boolean) => (shift ? 1000 : FRAME_MS);
