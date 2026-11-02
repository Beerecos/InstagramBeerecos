import { describe, expect, it } from "vitest";
import { captionPages, layout, remapCaptions, type CaptionWord } from "@/domain/social/montage/edit";
import { applyAutoCut, energyFrames, normalizeTranscript, parseDropList, planAutoCut, rangesFromWords, refineWithEnergy, speechIslands, speechThreshold } from "@/domain/social/montage/pipeline";

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

  const timed = (text: string, start = 0): CaptionWord[] => text.split(/\s+/).map((text, i) => w(text, start + i * 250, start + i * 250 + 200));

  it("retrouve les longues phrases répétées au-delà de deux clauses et garde la dernière version", () => {
    const sentence = "La prochaine fois que tu présentes ton activité, explique qui tu aides et dans quelle situation, puis demande à ton interlocuteur ce qu’il a retenu.";
    const first = timed(sentence);
    const bridge = timed("Je respire. On reprend. Très bien.", first[first.length - 1].endMs + 300);
    const last = timed(sentence, bridge[bridge.length - 1].endMs + 300);
    const words = [...first, ...bridge, ...last];
    const before = structuredClone(words);
    const plan = planAutoCut(words);
    const earlier = plan.filter((c) => c.fromMs < bridge[0].startMs);
    expect(earlier).toHaveLength(3);
    expect(earlier.every((c) => c.suggestDrop?.startsWith("reprise"))).toBe(true);
    expect(plan.filter((c) => c.fromMs >= last[0].startMs).every((c) => !c.suggestDrop)).toBe(true);
    const kept = applyAutoCut(words, plan, new Set(plan.filter((c) => c.suggestDrop).map((c) => c.n)));
    expect(kept.some((r) => r.fromMs <= last[0].startMs && r.toMs >= last[last.length - 1].endMs)).toBe(true);
    expect(words).toEqual(before);
  });

  it.each([
    ["Ce club génère 30 recommandations par mois.", "Ce club génère 40 recommandations par mois."],
    ["Ce club génère trente recommandations par mois.", "Ce club génère quarante recommandations par mois."],
    ["Ce club génère 1,5 recommandations par mois.", "Ce club génère 15 recommandations par mois."],
    ["Ce club vous aide à développer votre réseau.", "Ce club ne vous aide pas à développer votre réseau."],
    ["Ce club vous fait gagner beaucoup de temps.", "Ce club vous fait perdre beaucoup de temps."],
    ["Le client recommande le partenaire.", "Le partenaire recommande le client."],
  ])("garde les deux versions quand le sens change : %s", (a, b) => {
    const first = timed(a), last = timed(b, first[first.length - 1].endMs + 900);
    expect(planAutoCut([...first, ...last]).every((c) => !c.suggestDrop)).toBe(true);
    expect(planAutoCut([...first, ...last], { takeBreaks: [last[0].startMs] }).every((c) => !c.suggestDrop)).toBe(true);
  });

  it("n'étend pas les rapprochements incertains ni les rappels éloignés", () => {
    const phrase = "Tu présentes ton activité aux membres du club.";
    const first = timed(phrase);
    const bridge = timed("Une autre idée. Encore une idée. Puis la conclusion.", first[first.length - 1].endMs + 300);
    const later = timed(phrase, 90_000);
    expect(planAutoCut([...first, ...bridge, ...later])[0].suggestDrop).toBeUndefined();
    const short = timed("Je vous conseille. Je vous conseille ce club.");
    expect(planAutoCut(short)[0].suggestDrop).toBeUndefined();
  });

  it("conserve une introduction identique quand la suite de la phrase change de sens", () => {
    const words = timed("Quand tu présentes ton activité au club, tu dois écouter ton interlocuteur. Quand tu présentes ton activité au club, tu dois convaincre ton interlocuteur.");
    expect(planAutoCut(words).every((c) => !c.suggestDrop)).toBe(true);
  });

  it("douceur optionnelle : conserve les respirations courtes sans réintroduire une phrase retirée", () => {
    const words = [w("Une", 100, 300), w("pause.", 800, 1000), w("Erreur.", 1300, 1600), w("Puis", 1800, 2000), w("la", 2600, 2800), w("suite.", 2850, 3100)];
    const plan = planAutoCut(words);
    const drop = new Set([plan.find((c) => c.text === "Erreur.")!.n]);
    const regular = applyAutoCut(words, plan, drop, 3400);
    expect(applyAutoCut(words, plan, drop, 3400, { preserveBreaths: false })).toEqual(regular);
    const gentle = applyAutoCut(words, plan, drop, 3400, { preserveBreaths: true });
    expect(gentle).toEqual([{ fromMs: 0, toMs: 1180 }, { fromMs: 1700, toMs: 3280 }]);
    expect(gentle.length).toBeLessThan(regular.length);
    expect(gentle.every((r) => r.toMs <= 1300 || r.fromMs >= 1600)).toBe(true);
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
