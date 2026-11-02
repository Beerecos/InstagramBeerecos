import { describe, expect, it } from "vitest";
import { layout, toOutputMs, type CaptionWord, type Edit } from "@/domain/social/montage/edit";
import { initialEdit } from "@/domain/social/montage/montage";
import { applyWordFixes, checkStudioEdit, cutSource, isWordKept, outputToSourceMs, pushHistory, restoreSource, wordSpan, HISTORY_DEPTH } from "@/domain/social/montage/studio";

const words: CaptionWord[] = [
  { text: " Bonjour", startMs: 0, endMs: 400 },
  { text: " euh", startMs: 500, endMs: 700 },
  { text: " je", startMs: 800, endMs: 900 },
  { text: " suis", startMs: 950, endMs: 1200 },
  { text: " Cédric.", startMs: 1250, endMs: 1800 },
];

describe("studio : couper au transcript (glisser sur des mots + Suppr)", () => {
  it("retire la sélection et le blanc qui suit, puis la rétablit à l'identique", () => {
    const ranges = [{ fromMs: 0, toMs: 2000 }];
    const span = wordSpan(words, 1, 1);
    expect(span).toEqual({ fromMs: 500, toMs: 800 });
    const cut = cutSource(ranges, span.fromMs, span.toMs);
    expect(cut).toEqual([{ fromMs: 0, toMs: 500 }, { fromMs: 800, toMs: 2000 }]);
    expect(isWordKept(cut, words[1])).toBe(false);
    expect(isWordKept(cut, words[2])).toBe(true);
    expect(restoreSource(cut, span.fromMs, span.toMs, 2000)).toEqual(ranges);
  });

  it("sélection à l'envers, dernier mot, morceaux minuscules supprimés, bornes de la prise", () => {
    expect(wordSpan(words, 4, 3)).toEqual({ fromMs: 950, toMs: 1800 });
    expect(cutSource([{ fromMs: 0, toMs: 1000 }], 20, 1000)).toEqual([]);
    expect(restoreSource([], -50, 9999, 2000)).toEqual([{ fromMs: 0, toMs: 2000 }]);
  });

  it("le temps du montage se ramène au temps de la prise (inverse de toOutputMs)", () => {
    const segs = layout([{ fromMs: 0, toMs: 500 }, { fromMs: 800, toMs: 2000 }]);
    for (const src of [0, 250, 800, 1500, 1999]) expect(outputToSourceMs(segs, toOutputMs(segs, src))).toBe(src);
    expect(outputToSourceMs(segs, 99_999)).toBe(2000);
  });
});

describe("studio : historique et enregistrement validé", () => {
  const base: Edit = { ...initialEdit("prise.mp4", 2000), captions: "prise.json" };

  it("l'historique est borné", () => {
    let stack: Edit[] = [];
    for (let i = 0; i < HISTORY_DEPTH + 5; i++) stack = pushHistory(stack, { ...base, voiceGain: 1 + i / 100 });
    expect(stack).toHaveLength(HISTORY_DEPTH);
    expect(stack[stack.length - 1].voiceGain).toBeCloseTo(1 + (HISTORY_DEPTH + 4) / 100);
  });

  it("refuse une autre prise, un morceau hors prise, une clé inconnue et une animation invalide", () => {
    expect(checkStudioEdit({ ...base, ranges: [{ fromMs: 0, toMs: 1500 }] }, base, 2000).ok).toBe(true);
    const bad = (input: unknown) => { const r = checkStudioEdit(input, base, 2000); return r.ok ? [] : r.errors; };
    expect(bad({ ...base, video: "autre.mp4" }).join()).toMatch(/prise d'un montage ne change pas/);
    expect(bad({ ...base, ranges: [{ fromMs: 0, toMs: 2500 }] }).join()).toMatch(/finit après la prise/);
    expect(bad({ ...base, pirate: true }).join()).toMatch(/clé inconnue/);
    expect(bad({ ...base, custom: [{ name: "inexistante", fromMs: 0, toMs: 500, props: {} }] }).length).toBeGreaterThan(0);
  });

  it("enregistre les choix explicites, y compris aucun, et relit les anciens montages", () => {
    expect(checkStudioEdit(base, base, 2000).ok).toBe(true);
    for (const animationChoices of [[], ["titre", "chiffre"]]) {
      const r = checkStudioEdit({ ...base, animationChoices }, base, 2000);
      expect(r.ok && r.edit.animationChoices).toEqual(animationChoices);
    }
    for (const animationChoices of [["inconnue"], ["titre", "titre"], ["image"]]) {
      expect(checkStudioEdit({ ...base, animationChoices }, base, 2000).ok).toBe(false);
    }
  });

  it("corrige le texte d'un mot sans toucher au minutage", () => {
    const r = applyWordFixes(words, [{ i: 4, text: "Cédric !" }]);
    expect(r.ok && r.words[4]).toEqual({ text: " Cédric !", startMs: 1250, endMs: 1800 });
    expect(applyWordFixes(words, [{ i: 9, text: "x" }]).ok).toBe(false);
    expect(applyWordFixes(words, [{ i: 1, text: "  " }]).ok).toBe(false);
  });
});
