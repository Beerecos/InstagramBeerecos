import { describe, expect, it } from "vitest";
import { captionPages, layout, remapCaptions, type CaptionWord } from "@/domain/video/edit";
import { applyAutoCut, energyFrames, normalizeTranscript, parseDropList, planAutoCut, rangesFromWords, refineWithEnergy, speechIslands, speechThreshold } from "@/domain/video/pipeline";

const w = (text: string, startMs: number, endMs: number): CaptionWord => ({ text: ` ${text}`, startMs, endMs });

describe("transcription", () => {
  it("convertit la sortie Hyperframes (secondes) en ms de la prise, sans mot vide", () => {
    expect(normalizeTranscript([{ text: "Bonjour", start: 0.07, end: 0.6 }, { text: " ", start: 1, end: 1 }])).toEqual([{ text: " Bonjour", startMs: 70, endMs: 600 }]);
  });

  it("énergie par fenêtres de 20 ms et îlots de parole", () => {
    const rate = 1000; // 20 échantillons par fenêtre
    const samples = new Int16Array(200);
    samples.fill(8000, 40, 80); // parole 40–80 ms
    samples.fill(8000, 160, 200); // parole 160–200 ms
    const frames = energyFrames(samples, rate);
    expect(frames).toHaveLength(10);
    expect(frames[0]).toBe(-100);
    expect(speechThreshold(frames)).toBe(-94);
    expect(speechIslands(frames, { minGapMs: 50 })).toEqual([{ fromMs: 40, toMs: 80 }, { fromMs: 160, toMs: 200 }]);
    expect(speechIslands(frames, { minGapMs: 200 })).toEqual([{ fromMs: 40, toMs: 200 }]);
  });

  it("recale les mots placés trop tôt après une pause (cas réel whisper) et laisse un transcript juste intact", () => {
    const islands = [{ fromMs: 0, toMs: 7660 }, { fromMs: 9160, toMs: 11290 }];
    const words = [w("combien.", 7130, 7740), w("Commenter", 7740, 8480), w("club", 8480, 9220), w("club.", 10830, 11340)];
    const out = refineWithEnergy(words, islands);
    expect(out[0].endMs).toBeLessThanOrEqual(7660);
    expect(out[1].startMs).toBe(9160);
    expect(out[3].endMs).toBe(11290);
    for (let i = 1; i < out.length; i++) expect(out[i].startMs).toBeGreaterThanOrEqual(out[i - 1].startMs);
    const ok = [w("Bonjour", 100, 500), w("tous", 600, 900)];
    expect(refineWithEnergy(ok, [{ fromMs: 0, toMs: 1000 }])).toEqual(ok);
  });
});

describe("coupe automatique", () => {
  const words = [
    w("Bonjour", 70, 590), w("à", 689, 806), w("tous,", 806, 1327),
    w("aujourd'hui", 1327, 1945), w("je", 1945, 2063), w("vous", 2063, 2289), w("parle", 2299, 2593), w("du", 2593, 2701), w("réseau,", 2701, 3251),
    w("euh", 3300, 3600),
    w("et", 3700, 3850), w("je", 3850, 3990), w("vous", 3990, 4200), w("parle", 4200, 4500), w("du", 4500, 4600), w("réseau", 4600, 5000), w("BeeRecos.", 5000, 5600),
    w("Commentez", 7400, 7900), w("CLUB.", 7900, 8400),
  ];

  it("numérote les phrases et suggère de retirer la première version d'une phrase refaite", () => {
    const plan = planAutoCut(words);
    expect(plan.map((c) => c.text)).toEqual(["Bonjour à tous,", "aujourd'hui je vous parle du réseau,", "euh et je vous parle du réseau BeeRecos.", "Commentez CLUB."]);
    expect(plan[1].suggestDrop).toBe("reprise (version gardée : 3)");
    expect(plan[2].fillers).toBe(1);
    expect(plan[2].suggestDrop).toBeUndefined();
    expect(plan[0].suggestDrop).toBeUndefined();
  });

  it("détecte un faux départ", () => {
    const plan = planAutoCut([w("Je", 0, 200), w("vous...", 200, 400), w("Je", 1500, 1700), w("vous", 1700, 1900), w("présente", 1900, 2400), w("BeeRecos.", 2400, 3000)]);
    expect(plan[0].suggestDrop).toBe("faux départ (reprise en 2)");
  });

  it("applique le plan : phrases retirées, hésitations retirées, silences longs coupés, marges sans mordre sur un mot", () => {
    const plan = planAutoCut(words);
    const ranges = applyAutoCut(words, plan, new Set([2]), 9000);
    expect(ranges).toEqual([
      { fromMs: 0, toMs: 1327 },
      { fromMs: 3630, toMs: 5710 },
      { fromMs: 7330, toMs: 8510 },
    ]);
    expect(() => applyAutoCut(words, plan, new Set([9]))).toThrow("Phrase(s) inexistante(s) : 9");
  });

  it("regroupe les mots proches et respecte la durée de la prise", () => {
    expect(rangesFromWords([w("a", 0, 100), w("b", 300, 400)], () => true, { durationMs: 450 })).toEqual([{ fromMs: 0, toMs: 450 }]);
  });

  it("lit une liste de phrases « 2,5-6 »", () => {
    expect([...parseDropList("2, 5-6")]).toEqual([2, 5, 6]);
    expect(parseDropList("").size).toBe(0);
    expect(() => parseDropList("2;3")).toThrow("Liste de phrases invalide");
    expect(() => parseDropList("6-5")).toThrow("Intervalle à l'envers");
  });
});

describe("sous-titres après coupe", () => {
  it("change de page à chaque raccord et à chaque fin de phrase", () => {
    const segs = layout([{ fromMs: 0, toMs: 1000 }, { fromMs: 2000, toMs: 3000 }]);
    const pages = captionPages(remapCaptions([w("Bonjour", 100, 400), w("tous,", 400, 800), w("et", 2100, 2200), w("voilà.", 2200, 2500), w("Fin", 2600, 2800)], segs));
    expect(pages.map((p) => p.words.map((x) => x.text).join(" "))).toEqual(["Bonjour tous,", "et voilà.", "Fin"]);
  });
});
