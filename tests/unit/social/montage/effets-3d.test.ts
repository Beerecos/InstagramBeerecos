import { describe, expect, it } from "vitest";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { checkAnimation, renderAnimation } from "@/domain/social/montage/animations";
import { listMotions } from "@/domain/social/montage/beemotion";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";

const ids = ["cube-3d", "carte-retournee", "titre-profondeur", "cascade-3d"];
const ctx = { id: "e3d", start: 2, duration: 4, accent: "#2851FF" };

describe("effets 3D", () => {
  it.each(ids)("%s est enregistré, conforme, en perspective et en attente de validation", (id) => {
    expect(checkAnimation(id, ANIMATIONS[id])).toEqual([]);
    expect(ANIMATIONS[id].css).toMatch(/perspective:\d+px/);
    expect(listMotions().find((m) => m.id === id)?.status).toBe("review");
    const out = renderAnimation(id, ANIMATIONS[id].example, ctx, ANIMATIONS);
    expect(out.tweens.join(" ")).toMatch(/rotationX|rotationY/);
    expect(out.tweens.join(" ")).not.toMatch(/onUpdate|Math.random|setTimeout|repeat/);
    const html = buildEditComposition({ video: "p.mp4", ranges: [{ fromMs: 0, toMs: 6000 }], subtitles: false, custom: [{ name: id, fromMs: 1000, toMs: 5000, props: ANIMATIONS[id].example }] }, [], { assetBase: "." });
    expect(html).toContain(`class="anim-${id}`);
    expect(html).not.toContain('class="anim-erreur"');
  });

  it("le cube fait un quart de tour par mot suivant", () => {
    const out = renderAnimation("cube-3d", { items: ["A", "B", "C"] }, ctx, ANIMATIONS);
    expect(out.tweens.filter((t) => /rotationX:(90|180),/.test(t))).toHaveLength(2);
    expect(out.html.match(/class="face"/g)).toHaveLength(3);
  });

  it("la carte se retourne d'un demi-tour et échappe le texte", () => {
    const out = renderAnimation("carte-retournee", { recto: "<b>x</b>", verso: "y" }, ctx, ANIMATIONS);
    expect(out.html).toContain("&lt;b&gt;");
    expect(out.tweens.join(" ")).toContain("rotationY:180");
  });

  it("borne les listes", () => {
    expect(renderAnimation("cube-3d", { items: ["A"] }, ctx, ANIMATIONS).error).toBeTruthy();
    expect(renderAnimation("cascade-3d", { items: ["1", "2", "3", "4", "5", "6"] }, ctx, ANIMATIONS).error).toBeTruthy();
    expect(renderAnimation("titre-profondeur", { texte: "x".repeat(61) }, ctx, ANIMATIONS).error).toBeTruthy();
  });
});
