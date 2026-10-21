import { describe, expect, it } from "vitest";
import { z } from "zod";
import { KIT_ANIMATIONS, checkAnimation, defineAnimation, renderAnimation } from "@/domain/video/animations";
import { buildAnimationPreview, buildEditComposition } from "@/domain/video/edit-composition";
import { countUp, formatNumber } from "@/domain/video/fx";
import { ANIMATIONS } from "@/domain/video/registry";

const ctx = { id: "a0", start: 1, duration: 3, accent: "#693BFC", assetBase: "https://app.test/hyperframes" };
const edit = (custom: unknown[]) => ({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 10000 }], subtitles: false, custom });

describe("boîte à outils", () => {
  it("nombres à la française", () => {
    expect(formatNumber(12500)).toBe("12 500");
    expect(formatNumber(3.5, 1)).toBe("3,5");
  });

  it("compteur déterministe : des tl.set positionnés, valeur finale exacte, texte encodé", () => {
    const t = countUp("a0-v", { to: 120, at: 1, duration: 1, steps: 4 });
    expect(t).toHaveLength(5);
    expect(t[0]).toBe('tl.set("#a0-v", { textContent: "0" }, 1);');
    expect(t[4]).toBe('tl.set("#a0-v", { textContent: "120" }, 2);');
    expect(t.join("")).not.toMatch(/onUpdate|Math\.random/);
  });
});

describe("animations du kit BeeRecos", () => {
  it("toutes conformes (fiche, exemple, ids, tweens, CSS préfixé)", () => {
    for (const [name, def] of Object.entries(KIT_ANIMATIONS)) expect([name, checkAnimation(name, def)]).toEqual([name, []]);
  });

  it("chiffre : compte jusqu'à la valeur, préfixe et suffixe échappés", () => {
    const out = renderAnimation("chiffre", { valeur: 30, avant: "<", apres: " %", legende: "de CA" }, ctx);
    expect(out.error).toBeUndefined();
    expect(out.html).toContain("&lt;<span");
    expect(out.tweens.some((t) => t.includes('textContent: "30"'))).toBe(true);
  });

  it("liste : 2 à 4 points, puce à la couleur d'accent", () => {
    expect(renderAnimation("liste", { items: ["seul"] }, ctx).error).toContain("liste");
    const out = renderAnimation("liste", { items: ["un", "deux"] }, ctx);
    expect(out.html).toContain("background: #693BFC");
    expect(out.tweens.filter((t) => t.includes("-i"))).toHaveLength(2);
  });

  it("logo-fin : logo officiel blanc depuis les ressources, jamais transformé", () => {
    const out = renderAnimation("logo-fin", {}, ctx);
    expect(out.html).toContain('src="https://app.test/hyperframes/brand/beerecos-logo-white.svg"');
    expect(out.tweens.join("")).not.toMatch(/scale|rotat|skew/);
  });
});

describe("contrôle d'une animation maison", () => {
  const good = defineAnimation({
    label: "Test",
    description: "Animation de test pour vérifier le contrôle des animations maison.",
    lengthMs: 2000,
    props: z.strictObject({ texte: z.string() }),
    example: { texte: "ok" },
    css: ".anim-test { color: red; }",
    render: (c, p) => ({ html: `<div id="${c.id}" class="anim-test">${p.texte}</div>`, tweens: [`tl.to("#${c.id}", { opacity: 0 }, 1);`] }),
  });

  it("accepte une animation propre", () => expect(checkAnimation("test", good)).toEqual([]));

  it("refuse ids étrangers, tweens sur d'autres éléments, CSS global, script, exemple invalide", () => {
    const bad = { ...good, css: "body { margin: 0; }", render: () => ({ html: '<div id="root"><img onerror="x"><script>x</script></div>', tweens: ['tl.to("#cap-0", { opacity: 0 }, 1);', "gsap.to('#x', {})"] }) };
    const errors = checkAnimation("test", bad).join("\n");
    expect(errors).toContain("id « root »");
    expect(errors).toContain("tween sur « #cap-0 »");
    expect(errors).toContain("tween hors gabarit");
    expect(errors).toContain("CSS « body »");
    expect(errors).toContain("ni script");
    expect(checkAnimation("test", { ...good, example: { texte: 3 } })[0]).toContain("l'exemple ne passe pas");
    expect(checkAnimation("Mauvais Nom", good)[0]).toContain("minuscules");
  });

  it("à nom égal, l'animation maison remplace celle du kit dans la composition", () => {
    const html = buildEditComposition(edit([{ name: "titre", fromMs: 0, toMs: 2000, props: { texte: "maison" } }]), [], { assetBase: ".", registry: { ...KIT_ANIMATIONS, titre: good } });
    expect(html).toContain('class="anim-test">maison</div>');
    expect(html).not.toContain(".anim-titre {");
  });
});

describe("composition", () => {
  it("n'injecte que le CSS des animations utilisées", () => {
    const html = buildEditComposition(edit([{ name: "chiffre", fromMs: 0, toMs: 3000, props: { valeur: 3, legende: "clubs" } }]), [], { assetBase: "." });
    expect(html).toContain(".anim-chiffre {");
    expect(html).not.toContain(".anim-liste {");
    expect(html).toContain(".anim-erreur {");
  });

  it("aperçu isolé : l'animation seule sur un fond, sur sa durée conseillée", () => {
    const html = buildAnimationPreview("barre", ANIMATIONS.barre.example, { assetBase: "." });
    expect(html).toContain('data-duration="4"');
    expect(html).toContain('class="clip fake-take"');
    expect(html).toContain("Le bouche-à-oreille au hasard");
    expect(buildAnimationPreview("inconnue", {}, { assetBase: "." })).toContain("Animation « inconnue » introuvable");
  });
});
