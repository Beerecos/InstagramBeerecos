import { describe, expect, it } from "vitest";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { parseEdit } from "@/domain/social/montage/edit";
import { initialEdit } from "@/domain/social/montage/montage";

describe("recadrage 9:16 d'une prise paysage (2026-11-03)", () => {
  const base = initialEdit("prise.mp4", 6000);
  it("place la partie gardée dans la composition (aperçu et MP4)", () => {
    const html = buildEditComposition({ ...base, framing: { x: 0, y: 0, scale: 1, focusX: 20, focusY: 50 } }, [], { assetBase: "." });
    expect(html).toContain('transform-origin: 50% 50%; object-position: 20% 50%"');
  });
  it("garde le rendu inchangé d'un cadrage d'avant", () => {
    const html = buildEditComposition({ ...base, framing: { x: 40, y: 0, scale: 1.2 } }, [], { assetBase: "." });
    expect(html).toContain('style="transform: translate(40px, 0px) scale(1.2); transform-origin: 50% 50%"');
    expect(html).not.toContain("object-position");
  });
  it("borne la partie gardée de 0 à 100 %", () => {
    expect(parseEdit({ ...base, framing: { x: 0, y: 0, scale: 1, focusX: 120 } }).ok).toBe(false);
    expect(parseEdit({ ...base, framing: { x: 0, y: 0, scale: 1, focusX: 0 } }).ok).toBe(true);
  });
});
