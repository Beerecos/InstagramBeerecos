import { describe, expect, it } from "vitest";
import { centeredWindow, framingFromWindow, needsCrop, placeWindow, windowFromFraming, type Framing } from "@/domain/reels/crop";

/** Simulation pixel indépendante de la composition : cover + object-position + translate/scale autour du centre. */
function visibleSource(W: number, H: number, f: Framing) {
  const k = Math.max(1080 / W, 1920 / H);
  const ox = (1080 - W * k) * ((f.focusX ?? 50) / 100), oy = (1920 - H * k) * ((f.focusY ?? 50) / 100);
  const back = (q: number, c: number, t: number) => c + (q - c - t) / f.scale;
  const u = (qx: number) => (back(qx, 540, f.x) - ox) / k / W;
  const v = (qy: number) => (back(qy, 960, f.y) - oy) / k / H;
  return { left: u(0), top: v(0), width: u(1080) - u(0), height: v(1920) - v(0) };
}
const close = (a: { left: number; top: number; width: number; height: number }, b: typeof a, eps = 0.002) => {
  for (const k of ["left", "top", "width", "height"] as const) expect(Math.abs(a[k] - b[k])).toBeLessThan(eps);
};

describe("recadrage 9:16 d'une prise paysage", () => {
  const W = 1920, H = 1080, A = W / H;

  it("la fenêtre choisie est exactement la partie affichée, avec ou sans zoom, partout dans l'image", () => {
    for (const scale of [1, 1.3, 1.75, 2]) {
      for (const [l, t] of [[0, 0], [0.2, 0.1], [0.5, 0.3], [1, 1]]) {
        const w = placeWindow(A, scale, l, t);
        const f = framingFromWindow(A, scale, w);
        close(visibleSource(W, H, f), w);
        close(windowFromFraming(A, f), w);
      }
    }
  });

  it("sans zoom : la fenêtre fait la hauteur de l'image et 9/16 de sa hauteur en largeur", () => {
    const w = centeredWindow(A, 1);
    expect(w.height).toBe(1);
    expect(w.width).toBeCloseTo((9 / 16) / A, 5);
    expect(framingFromWindow(A, 1, placeWindow(A, 1, 0, 0))).toMatchObject({ x: 0, y: 0, focusX: 0 });
    expect(framingFromWindow(A, 1, placeWindow(A, 1, 1, 0))).toMatchObject({ x: 0, y: 0, focusX: 100 });
  });

  it("avec zoom, le cadrage vertical fonctionne (il était ignoré avant)", () => {
    const top = framingFromWindow(A, 2, placeWindow(A, 2, 0.4, 0));
    const bottom = framingFromWindow(A, 2, placeWindow(A, 2, 0.4, 1));
    expect(top.y).toBeGreaterThan(0);
    expect(bottom.y).toBeLessThan(0);
    close(visibleSource(W, H, top), placeWindow(A, 2, 0.4, 0));
  });

  it("une prise plus haute que le 9:16 se cadre de haut en bas ; un 9:16 n'a pas besoin de cadrage", () => {
    const tall = 1080 / 2400;
    const w = placeWindow(tall, 1, 0, 0.7);
    close(visibleSource(1080, 2400, framingFromWindow(tall, 1, w)), w);
    expect(needsCrop(A)).toBe(true);
    expect(needsCrop(1080 / 1920)).toBe(false);
  });

  it("le réglage reste dans les bornes acceptées par le serveur", () => {
    for (const scale of [1, 2]) for (const l of [0, 1]) for (const t of [0, 1]) {
      const f = framingFromWindow(A, scale, placeWindow(A, scale, l, t));
      expect(Math.abs(f.x)).toBeLessThanOrEqual(540);
      expect(Math.abs(f.y)).toBeLessThanOrEqual(960);
      expect(f.focusX!).toBeGreaterThanOrEqual(0); expect(f.focusX!).toBeLessThanOrEqual(100);
    }
  });
});
