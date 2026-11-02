import { describe, expect, it } from "vitest";
import { composeCaption, durationWarning, emptyPost, fileSlug, montageSrt, parseHashtags, postWarnings, srtTime } from "@/domain/reels/post";

describe("préparation du post", () => {
  it("normalise les hashtags sans doublon", () => {
    expect(parseHashtags("#BeeRecos, réseau  #reseau ia ##IA")).toEqual(["#BeeRecos", "#reseau", "#ia"]);
  });
  it("compose la légende finale", () => {
    expect(composeCaption({ caption: " Texte ", cta: "Commente CLUB", hashtags: ["#BeeRecos"] })).toBe("Texte\n\nCommente CLUB\n\n#BeeRecos");
  });
  it("ne présente jamais un mot-clé comme une automatisation DM vérifiée", () => {
    const post = { ...emptyPost("v1", "CLUB"), caption: "Viens découvrir un club" };
    const w = postWarnings(post, "v1");
    expect(w.some((x) => /DM n'est pas vérifiée/.test(x))).toBe(true);
    expect(w.some((x) => /CLUB n'apparaît pas/.test(x))).toBe(false); // présent via le CTA
  });
  it("signale une vidéo modifiée depuis la légende", () => {
    expect(postWarnings({ ...emptyPost("v1"), caption: "x" }, "v2").join(" ")).toMatch(/vidéo a changé/);
  });
  it("signale les limites Instagram", () => {
    const post = { ...emptyPost("v"), caption: "a".repeat(2300), hashtags: Array.from({ length: 31 }, (_, i) => `#t${i}`) };
    const w = postWarnings(post, "v").join(" ");
    expect(w).toMatch(/trop longue/);
    expect(w).toMatch(/31 hashtags/);
  });
  it("avertit hors de la cible 35–60 s sans couper", () => {
    expect(durationWarning(20_000)).toMatch(/sous la cible/);
    expect(durationWarning(45_000)).toBeNull();
    expect(durationWarning(75_000)).toMatch(/Rien n'est coupé/);
  });
  it("nom de fichier sûr", () => {
    expect(fileSlug("V12 · Mon réseau !")).toBe("v12-mon-reseau");
  });
});

describe("SRT du montage", () => {
  const words = [
    { text: "Bonjour", startMs: 0, endMs: 400 },
    { text: "euh", startMs: 500, endMs: 700 },
    { text: "je", startMs: 1000, endMs: 1100 },
    { text: "suis", startMs: 1100, endMs: 1300 },
    { text: "Cédric.", startMs: 1300, endMs: 1800 },
  ];
  it("suit les coupes : temps de sortie, mots coupés retirés", () => {
    const srt = montageSrt(words, [{ fromMs: 0, toMs: 450 }, { fromMs: 1000, toMs: 2000 }]);
    expect(srt).not.toContain("euh");
    // « Bonjour » (0–400) puis « je » ramené à 450 ms en sortie : la coupe referme le trou, une seule phrase.
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:01,250\nBonjour je suis Cédric.\n");
  });
  it("vide sans mot conservé", () => {
    expect(montageSrt(words, [{ fromMs: 3000, toMs: 4000 }])).toBe("");
  });
  it("format horaire", () => {
    expect(srtTime(3_723_004)).toBe("01:02:03,004");
  });
});
