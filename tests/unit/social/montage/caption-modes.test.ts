import { describe, expect, it } from "vitest";
import { initialEdit } from "@/domain/social/montage/montage";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { CAPTION_MODE, CAPTION_MODES } from "@/domain/social/montage/caption-modes";
import { EditSchema } from "@/domain/social/montage/edit";

const words = "Ton réseau vaut de l'or si tu sais quoi dire aux bonnes personnes".split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
const edit = (mode?: (typeof CAPTION_MODES)[number]) => ({ ...initialEdit("prise.mp4", 6000), captionStyle: mode ? { mode } : {} });
const html = (mode?: (typeof CAPTION_MODES)[number]) => buildEditComposition(edit(mode), words, { assetBase: "." });
const pages = (h: string) => [...h.matchAll(/<div id="cap-\d+" class="clip caption"[^>]*><p>(.*?)<\/p><\/div>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());

describe("styles de sous-titres", () => {
  it("cinq styles, découpage de 2 à 6 mots", () => {
    expect(CAPTION_MODES).toEqual(["dynamic", "clean", "highlight", "punch", "minimal"]);
    for (const m of CAPTION_MODES) {
      expect(CAPTION_MODE[m].maxWords).toBeGreaterThanOrEqual(2);
      expect(CAPTION_MODE[m].maxWords).toBeLessThanOrEqual(6);
      expect(EditSchema.safeParse(edit(m)).success).toBe(true);
    }
    expect(EditSchema.safeParse({ ...edit(), captionStyle: { mode: "neon" } }).success).toBe(false);
  });

  it("sans style choisi : rendu d'avant à l'identique (montages existants)", () => {
    expect(html()).toBe(buildEditComposition({ ...edit(), captionStyle: {} }, words, { assetBase: "." }));
    expect(pages(html()).every((p) => p.split(" ").length <= 4)).toBe(true);
  });

  it("chaque style découpe selon sa règle ; Punch : deux mots, en capitales", () => {
    expect(pages(html("punch")).every((p) => p.split(" ").length <= 2)).toBe(true);
    expect(pages(html("clean")).some((p) => p.split(" ").length > 4)).toBe(true);
    expect(html("punch")).toContain("text-transform: uppercase");
  });

  it("Dynamic : les mots apparaissent quand ils sont dits ; Clean : pas de karaoké, phrase lisible d'un coup", () => {
    expect(html("dynamic")).toMatch(/tl\.fromTo\("#c0-w1", \{ opacity: 0 \}/);
    expect(html("clean")).not.toMatch(/tl\.to\("#c0-w0", \{ color:/);
    expect(html("clean")).toMatch(/<span id="c0-w0" style="color: /);
    expect(html("highlight")).toMatch(/tl\.to\("#c0-w0", \{ color:/);
  });

  it("Minimal : sans cartouche, avec ombre portée", () => {
    expect(html("minimal")).toContain("background: none !important");
  });
});
