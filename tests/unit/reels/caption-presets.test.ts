import { describe, expect, it } from "vitest";
import { CAPTION_POSITIONS, CAPTION_PRESETS, CAPTION_SIZES, nearest, presetOf, withPosition, withPreset, withSize } from "@/domain/reels/caption-presets";
import { CaptionStyleSchema } from "@/domain/social/montage/edit";

describe("sous-titres en mode simple", () => {
  it("chaque style, taille et position est accepté par le serveur", () => {
    for (const p of CAPTION_PRESETS) for (const s of CAPTION_SIZES) for (const pos of CAPTION_POSITIONS) {
      expect(CaptionStyleSchema.safeParse(withPosition(withSize(withPreset({}, p.key), s.key), pos.key)).success).toBe(true);
    }
  });
  it("reconnaît le style choisi et garde les autres réglages", () => {
    const style = withPreset({ fontFamily: "Caveat", top: 1300 }, "bleu");
    expect(presetOf(style)).toBe("bleu");
    expect(style).toMatchObject({ fontFamily: "Caveat", top: 1300, backgroundColor: "#2851FF" });
    expect(presetOf({})).toBe("classique");
    expect(presetOf({ color: "#123456" })).toBeNull();
  });
  it("affiche la taille et la position les plus proches d'un réglage fait à la main", () => {
    expect(nearest(CAPTION_SIZES, 58, (s) => s.fontSize, "moyen")).toBe("moyen");
    expect(nearest(CAPTION_SIZES, 70, (s) => s.fontSize, "moyen")).toBe("grand");
    expect(nearest(CAPTION_POSITIONS, undefined, (s) => s.top, "bas")).toBe("bas");
  });
});
