import { describe, expect, it } from "vitest";
import { peaks, pieceAt, removePiece, snap, splitAt, timecode, trimPiece, wordMarks } from "@/domain/studio/timeline";

describe("timeline : opérations non destructives", () => {
  const ranges = [{ fromMs: 0, toMs: 4000 }, { fromMs: 5000, toMs: 9000 }];
  it("coupe au curseur sans rien retirer", () => {
    expect(splitAt(ranges, 2000)).toEqual([{ fromMs: 0, toMs: 2000 }, { fromMs: 2000, toMs: 4000 }, { fromMs: 5000, toMs: 9000 }]);
    expect(splitAt(ranges, 4500)).toBeNull(); // dans une coupe
    expect(splitAt(ranges, 100)).toBeNull(); // morceau trop court
  });
  it("retire un morceau, jamais le dernier", () => {
    expect(removePiece(ranges, 0)).toEqual([{ fromMs: 5000, toMs: 9000 }]);
    expect(removePiece([ranges[0]], 0)).toBeNull();
    expect(pieceAt(ranges, 6000)).toBe(1);
    expect(pieceAt(ranges, 4500)).toBe(-1);
  });
  it("tire les bords, borné par les voisins, la prise et les changements de prise", () => {
    expect(trimPiece(ranges, 1, "start", 3000, 10000)).toEqual([ranges[0], { fromMs: 4000, toMs: 9000 }]);
    expect(trimPiece(ranges, 0, "end", 7000, 10000)).toEqual([{ fromMs: 0, toMs: 5000 }, ranges[1]]);
    expect(trimPiece(ranges, 1, "end", 20000, 10000)[1]).toEqual({ fromMs: 5000, toMs: 10000 });
    expect(trimPiece(ranges, 1, "start", 8950, 10000)[1]).toEqual({ fromMs: 8800, toMs: 9000 });
    // Prise 2 commence à 4800 : le morceau 2 ne peut pas déborder sur la prise 1.
    expect(trimPiece([{ fromMs: 0, toMs: 3000 }, { fromMs: 5000, toMs: 9000 }], 1, "start", 4000, 10000, [4800])[1].fromMs).toBe(4800);
  });
  it("aimante sur les mots", () => {
    const marks = wordMarks([{ text: "a", startMs: 1000, endMs: 1400 }]);
    expect(snap(1080, marks, 100)).toBe(1000);
    expect(snap(1250, marks, 100)).toBe(1250);
  });
  it("calcule la forme d'onde et le timecode", () => {
    const s = new Float32Array([0, 0.5, -1, 0.25, 0, 0, 0.1, -0.2]);
    expect(Array.from(peaks(s, 4, 1)).map((v) => Math.round(v * 100) / 100)).toEqual([1, 0.2]);
    expect(timecode(62_900)).toBe("1:02.27");
  });
});

import { cutOutputZone, stepMs } from "@/domain/studio/timeline";
describe("zone I / O", () => {
  const ranges = [{ fromMs: 0, toMs: 4000 }, { fromMs: 5000, toMs: 9000 }]; // montage : 0–4000 puis 4000–8000
  it("coupe une zone qui traverse deux morceaux, en temps du montage", () => {
    expect(cutOutputZone(ranges, 3000, 5000)).toEqual([{ fromMs: 0, toMs: 3000 }, { fromMs: 6000, toMs: 9000 }]);
  });
  it("coupe au milieu d'un morceau et accepte des repères inversés", () => {
    expect(cutOutputZone(ranges, 2000, 1000)).toEqual([{ fromMs: 0, toMs: 1000 }, { fromMs: 2000, toMs: 4000 }, { fromMs: 5000, toMs: 9000 }]);
  });
  it("refuse une zone qui ne laisse rien ou trop courte", () => {
    expect(cutOutputZone(ranges, 0, 8000)).toBeNull();
    expect(cutOutputZone(ranges, 1000, 1010)).toBeNull();
  });
  it("pas d'une image ou d'une seconde", () => {
    expect(Math.round(stepMs(false) * 30)).toBe(1000);
    expect(stepMs(true)).toBe(1000);
  });
});
import { timecode as tcf } from "@/domain/studio/timeline";
describe("timecode", () => { it("compte les images entières", () => { expect(tcf(33)).toBe("0:00.01"); expect(tcf(1033)).toBe("0:01.01"); expect(tcf(999)).toBe("0:01.00"); }); });
