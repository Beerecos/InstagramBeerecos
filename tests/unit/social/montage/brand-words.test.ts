import { describe, expect, it } from "vitest";
import { fixBrandWords } from "@/domain/social/montage/brand-words";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";

const w = (t: string) => t.split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
const texts = (t: string) => fixBrandWords(w(t)).map((x) => x.text).join(" ");

describe("sous-titres : BeeRecos toujours bien écrit", () => {
  it("corrige les variantes entendues, garde la ponctuation", () => {
    expect(texts("pour découvrir Biroco et demander")).toBe("pour découvrir BeeRecos et demander");
    expect(texts("chez Birecos, Beerecos. «Bérécos»")).toBe("chez BeeRecos, BeeRecos. «BeeRecos»");
    expect(texts("rejoins Bee recos !")).toBe("rejoins BeeRecos !");
    // Variantes vues en production (2026-11-10).
    expect(texts("découvrir B-Recru et demander")).toBe("découvrir BeeRecos et demander");
    expect(texts("Bi-reco, Birrecos, BeeRecos, B recru")).toBe("BeeRecos, BeeRecos, BeeRecos, BeeRecos");
  });
  it("« Bee recos » en deux mots : un seul mot, du début du premier à la fin du second", () => {
    const r = fixBrandWords(w("rejoins Bi recos maintenant"));
    expect(r).toHaveLength(3);
    expect(r[1]).toEqual({ text: "BeeRecos", startMs: 300, endMs: 850 });
  });
  it("ne touche pas aux mots proches", () => {
    expect(texts("bureau Berck bric bisous recommander bio brico recrue Bruno barco bicross")).toBe("bureau Berck bric bisous recommander bio brico recrue Bruno barco bicross");
  });
  it("le rendu affiche BeeRecos", () => {
    const html = buildEditComposition({ video: "p.mp4", accent: "bleu", ranges: [{ fromMs: 0, toMs: 3000 }], subtitles: true, captionStyle: {}, voiceGain: 1, custom: [], sounds: [] }, w("découvrir Biroco aujourd'hui"), { assetBase: "." });
    expect(html).toContain("BeeRecos");
    expect(html).not.toContain("Biroco");
  });
});
