import { describe, expect, it } from "vitest";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { checkAnimation, renderAnimation } from "@/domain/social/montage/animations";
import { checkMotionRegistry, listMotions } from "@/domain/social/montage/beemotion";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";

const ids = ["tour-blocs", "icones-orbite", "puce-lumineuse", "arbre-pousse", "fusee-decollage"];
const ctx = { id: "r3d", start: 2, duration: 4, accent: "#2851FF" };

describe("illustrations de la vidéo de référence", () => {
  it.each(ids)("%s est conforme, déterministe et en attente de validation", (id) => {
    expect(checkAnimation(id, ANIMATIONS[id])).toEqual([]);
    expect(listMotions().find((m) => m.id === id)?.status).toBe("review");
    const a = renderAnimation(id, ANIMATIONS[id].example, ctx, ANIMATIONS);
    const b = renderAnimation(id, ANIMATIONS[id].example, ctx, ANIMATIONS);
    expect(a).toEqual(b);
    expect(a.tweens.join(" ")).not.toMatch(/onUpdate|Math.random|setTimeout|repeat/);
    const html = buildEditComposition({ video: "p.mp4", ranges: [{ fromMs: 0, toMs: 6000 }], subtitles: false, custom: [{ name: id, fromMs: 1000, toMs: 5000, props: ANIMATIONS[id].example }] }, [], { assetBase: "." });
    expect(html).toContain(`class="anim-${id}`);
    expect(html).not.toContain('class="anim-erreur"');
  });

  it("le registre BeeMotion reste cohérent", () => expect(checkMotionRegistry()).toEqual([]));

  it("la tour a le nombre d'étages demandé et s'effondre", () => {
    const out = renderAnimation("tour-blocs", { etages: 4, fond: false }, ctx, ANIMATIONS);
    expect(out.html.match(/class="bloc"/g)).toHaveLength(4);
    expect(out.html).not.toContain(" fond");
    expect(out.tweens.filter((t) => /-b\d", \{ x:/.test(t))).toHaveLength(4);
  });

  it("n'accepte que les icônes du catalogue et échappe les textes", () => {
    expect(renderAnimation("icones-orbite", { icones: ["reseau", "inconnue", "idee"] }, ctx, ANIMATIONS).error).toBeTruthy();
    expect(renderAnimation("icones-orbite", { icones: ["reseau", "idee"] }, ctx, ANIMATIONS).error).toBeTruthy();
    const out = renderAnimation("fusee-decollage", { texte: "<i>go</i>" }, ctx, ANIMATIONS);
    expect(out.html).toContain("&lt;i&gt;");
    expect(renderAnimation("fusee-decollage", { texte: "" }, ctx, ANIMATIONS).html).not.toContain('class="texte"');
  });
});
