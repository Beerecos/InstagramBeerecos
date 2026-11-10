/**
 * Courbes Editorial Impact (cubic-bezier CSS), calculées à l'identique dans le moteur (TypeScript) et dans la
 * composition (JavaScript injecté) : une seule définition, rendu déterministe image par image.
 */
export const EASE = {
  editorialOut: [0.22, 1, 0.36, 1],
  sharpOut: [0.16, 1, 0.3, 1],
  wipe: [0.76, 0, 0.24, 1],
  /** Ressort de carte contrôlé : ≈ 1,5 % de dépassement, jamais de rebond. */
  springCard: [0.3, 1.18, 0.42, 1],
  counter: [0.12, 0.85, 0.2, 1],
} as const;
export type EaseName = keyof typeof EASE;

/** Solveur cubic-bezier (Newton puis dichotomie), identique à celui de la composition. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; const d = dx(t); if (Math.abs(e) < 1e-6) return sy(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 30; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}

/** Même solveur, en JavaScript littéral (résiste à la minification) : objet `E` utilisable comme `ease:` GSAP. */
const BZ_SOURCE = `function BZ(x1, y1, x2, y2) {
        const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
        const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
        return (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x;
          for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6) return sy(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
          let lo = 0, hi = 1; t = x; for (let i = 0; i < 30; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
          return sy(t); };
      }`;
export function easingSource(): string {
  const entries = Object.entries(EASE).map(([k, v]) => `${k}: BZ(${v.join(", ")})`).join(", ");
  return `${BZ_SOURCE}\n      const E = { ${entries} };`;
}
