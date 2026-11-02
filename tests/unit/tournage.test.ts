import { describe, expect, it } from "vitest";
import { checkPlan, ffmpegCommand, findSlates, planFromSlates, readNumber, segmentName, tokenize } from "@/domain/tournage/slates";
import { matchCatalogue, reelIdFromText } from "@/domain/tournage/match";

// Cas repris des tests de automation/lib/decoupe.mjs (branche claude/amazing-mayer-00r1ac).
const spoken = (list: [string, number][]) => list.map(([text, at]) => ({ text: ` ${text}`, startMs: at, endMs: at + 300 }));

describe("annonces « V12 + titre »", () => {
  it("lit les nombres en chiffres ou en lettres", () => {
    const n = (t: string) => readNumber(tokenize(spoken(t.split(" ").map((w, i) => [w, i * 400] as [string, number]))), 0)?.value;
    expect(n("72")).toBe(72);
    expect(n("soixante-douze")).toBe(72);
    expect(n("soixante et onze")).toBe(71);
    expect(n("quatre-vingt-dix-sept")).toBe(97);
    expect(n("deux trois")).toBe(2);
    expect(n("réseau")).toBeUndefined();
  });

  it("réel du titre redit au dernier mot avant l'annonce suivante ; prise refaite : la dernière", () => {
    const words = spoken([
      ["V1,", 0], ["le", 300], ["réseau", 600], ["qui", 900], ["recommande.", 1200],
      ["Le", 3000], ["réseau", 3300], ["qui", 3600], ["recommande,", 3900], ["c'est", 4200], ["BeeRecos.", 4500],
      ["Vé", 9000], ["deux,", 9300], ["formation.", 9600],
      ["Formation", 11000], ["continue.", 11300],
      ["V2", 15000], ["formation.", 15300], ["Formation", 17000], ["encore.", 17300], ["Fin.", 17600],
      ["Et", 21000], ["V", 21300], ["8", 21400],
    ]);
    const slates = findSlates(words);
    expect(slates.map((s) => [s.n, s.titre, s.startMs, s.redit])).toEqual([[1, "le réseau qui recommande", 3000, true], [2, "formation", 11000, true], [2, "formation", 17000, true]]);
    const { segments, warnings } = planFromSlates(slates, words, 25000, { expected: 3 });
    expect(segments.map(({ n, fromMs, toMs, titre }) => [n, fromMs, toMs, titre])).toEqual([[1, 2600, 5200, "le réseau qui recommande"], [2, 16600, 22100, "formation"]]);
    expect(warnings[0]).toMatch(/V2 annoncé plusieurs fois/);
    expect(warnings.join("\n")).toMatch(/Annonce introuvable pour : V3/);
  });

  it("annonce seule sans titre redit : seule l'annonce est retirée", () => {
    const words = spoken([["V3.", 0], ["Aujourd'hui", 1500], ["je", 1800], ["parle", 2100], ["du", 2400], ["réseau.", 2700], ["V4", 6000], ["Suite.", 7500]]);
    const slates = findSlates(words);
    expect(slates.map((s) => [s.n, s.startMs, s.redit])).toEqual([[3, 1500, false], [4, 7500, false]]);
    const { segments, warnings } = planFromSlates(slates, words, 9000);
    expect(segments.map(({ fromMs, toMs }) => [fromMs, toMs])).toEqual([[1100, 3400], [7100, 8200]]);
    expect(warnings[0]).toMatch(/V3 : titre non redit.*« Aujourd'hui je parle du réseau » à vérifier/);
  });
});

describe("plan relu à la main", () => {
  it("refuse chevauchements, bornes hors rush et numéros doublés", () => {
    expect(checkPlan([{ n: 1, fromMs: 0, toMs: 5000, titre: "" }, { n: 2, fromMs: 4000, toMs: 9000, titre: "" }], 8000).join(" ")).toMatch(/avant la fin du segment précédent.*après la fin du rush/);
    expect(checkPlan([{ n: 1, fromMs: 0, toMs: 2000, titre: "" }, { n: 1, fromMs: 3000, toMs: 5000, titre: "" }], 0).join(" ")).toMatch(/V1 déjà utilisé/);
    expect(checkPlan([{ n: 1, fromMs: 0, toMs: 2000, titre: "" }], 0)).toEqual([]);
  });
  it("nomme l'extrait et le produit sans recopier le rush entier", () => {
    const s = { n: 7, fromMs: 1600, toMs: 3300, titre: "Mon réseau" };
    expect(segmentName(s)).toBe("reel-07-mon-reseau.mp4");
    const cmd = ffmpegCommand("tournage d'octobre.mov", s);
    expect(cmd).toContain("-ss 1.600");
    expect(cmd).toContain("-t 1.700");
    expect(cmd).toContain("'tournage d'\\''octobre.mov'");
    expect(cmd).toContain("-c:a aac");
  });
});

describe("association aux 72 scripts", () => {
  const catalogue = [
    { reelId: "V01", title: "Le réseau qui recommande" },
    { reelId: "V02", title: "La formation BeeSchool" },
    { reelId: "V03", title: "La formation continue BeeSchool" },
    { reelId: "V12", title: "L'IA au quotidien" },
  ];
  it("par numéro annoncé ou nom de fichier", () => {
    expect(reelIdFromText("reel-12-ia.mp4")).toBe("V12");
    expect(reelIdFromText("IMG_1234.MOV")).toBeNull();
    expect(matchCatalogue({ label: "V1 prise 2.mov" }, catalogue)).toEqual({ reelId: "V01", confidence: "numero", candidates: ["V01"] });
    expect(matchCatalogue({ n: 12, label: "" }, catalogue).reelId).toBe("V12");
  });
  it("par titre quand il n'y a pas d'ambiguïté", () => {
    expect(matchCatalogue({ label: "le réseau qui recommande" }, catalogue)).toMatchObject({ reelId: "V01", confidence: "titre" });
  });
  it("jamais certain quand deux scripts se ressemblent", () => {
    const close = [...catalogue, { reelId: "V20", title: "Le réseau qui grandit" }];
    const m = matchCatalogue({ label: "le réseau, prise 3" }, close);
    expect(m.reelId).toBeNull();
    expect(m.confidence).toBe("incertain");
    expect(m.candidates.slice(0, 2).sort()).toEqual(["V01", "V20"]);
    expect(matchCatalogue({ label: "formation BeeSchool" }, catalogue)).toMatchObject({ reelId: "V02", confidence: "titre" });
  });
  it("sans correspondance : association manuelle", () => {
    expect(matchCatalogue({ label: "IMG_1234" }, catalogue).confidence).toBe("aucun");
  });
});

import { parseClock, parseTranscript } from "@/domain/tournage/transcript";
describe("transcription de session", () => {
  it("accepte Scribe (secondes) et ms, ignore les espaces", () => {
    expect(parseTranscript({ words: [{ text: "V1", start: 0.5, end: 0.8 }, { text: " ", type: "spacing", start: 0.8, end: 0.9 }] })).toEqual([{ text: "V1", startMs: 500, endMs: 800 }]);
    expect(parseTranscript([{ text: "a", startMs: 10, endMs: 20 }])).toHaveLength(1);
    expect(() => parseTranscript({})).toThrow(/illisible/);
  });
  it("lit les temps saisis", () => {
    expect(parseClock("1:02:03.4")).toBe(3_723_400);
    expect(parseClock("2:03,5")).toBe(123_500);
    expect(parseClock("12")).toBe(12_000);
    expect(parseClock("abc")).toBeNull();
  });
});
