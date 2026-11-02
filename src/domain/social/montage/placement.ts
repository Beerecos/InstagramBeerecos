import { layout, toOutputMs, totalMs, type Range } from "./edit";
import { outputToSourceMs } from "./studio";
import type { CustomAnimation } from "./suggest";

/** Stable old-clip identities, persisted at the next save; never based on a sorted index after selection. */
export function withAnimationIds(custom: CustomAnimation[]): CustomAnimation[] {
  const used = new Set<string>();
  return custom.map((c) => {
    let hash = 2166136261;
    for (const char of JSON.stringify([c.name, c.fromMs, c.toMs, c.props])) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    const base = c.id ?? `clip-${(hash >>> 0).toString(36)}`;
    let id = base, n = 1;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id === c.id ? c : { ...c, id };
  });
}

export function animationOutputRange(animation: CustomAnimation, ranges: Range[]): Range {
  const segments = layout(ranges);
  return { fromMs: toOutputMs(segments, animation.fromMs), toMs: toOutputMs(segments, animation.toMs) };
}

/** End boundaries belong to the preceding kept segment, start boundaries to the next one. */
export function retimeAnimation(animation: CustomAnimation, ranges: Range[], fromOutputMs: number, toOutputMs: number): CustomAnimation {
  const segments = layout(ranges);
  const from = Math.round(fromOutputMs), to = Math.round(toOutputMs);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to > totalMs(segments) || to - from < 100) {
    throw new Error("L’animation doit rester dans le montage et durer au moins 0,1 seconde.");
  }
  const end = segments.find((s) => to > s.atMs && to <= s.atMs + s.toMs - s.fromMs);
  if (!end) throw new Error("Fin de l’animation hors du montage.");
  return { ...animation, fromMs: outputToSourceMs(segments, from), toMs: end.fromMs + to - end.atMs };
}
