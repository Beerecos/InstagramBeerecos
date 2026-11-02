import { describe, expect, it } from "vitest";
import { newSlide } from "@/domain/social/carousel";
import { restoreVisual, visualPostChannel } from "@/components/social/visual-project";

describe("visual composition restore contract", () => {
  it("restores persisted aspect independently of derived carousel/single format, retaining order and all composition settings", () => {
    const first = newSlide("cover", { title: "Premier", imgPosX: 31, imgScale: 160 });
    const second = newSlide("plain", { title: "Second", accent: "#2851FF", body: "Texte conservé" });
    const saved = { format: "carousel", aspect: "li45", slides: [second, first], keyword: "", caption: "Légende modifiée" };
    const restored = restoreVisual(saved);
    expect(restored).toEqual({ format: "li45", slides: [second, first], keyword: "", caption: "Légende modifiée" });
    expect(restoreVisual({ ...saved, format: "single", slides: [first] }).slides).toEqual([first]);
  });
  it("supports the original local carousel schema without inventing text or replacing identities", () => {
    const original = { format: "sq", slides: [newSlide()], keyword: "", caption: "" };
    expect(restoreVisual(original)).toEqual(original);
  });
  it("does not mistake a template engine composition for an editable carousel", () => {
    expect(() => restoreVisual({ format: "single", slides: [{ index: 1, headline: "Titre métier" }] })).toThrow(/éditeur métier/);
  });
  it("refuses empty, oversized and damaged compositions instead of replacing them with a blank project", () => {
    for (const slides of [[], [null], Array.from({ length: 11 }, () => newSlide())]) {
      expect(() => restoreVisual({ format: "ig34", slides })).toThrow();
    }
    expect(() => restoreVisual(null)).toThrow();
  });
});

it("accepts only the two supported explicit post channels", () => {
  expect(visualPostChannel("linkedin")).toBe("linkedin");
  expect(visualPostChannel("instagram")).toBe("instagram");
  for (const value of [null, "", "all", "facebook", "LINKEDIN"]) expect(visualPostChannel(value)).toBeUndefined();
});
