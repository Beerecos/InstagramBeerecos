import { describe, expect, it } from "vitest";
import { analyzeScenes } from "@/domain/social/montage/scenes";
import { applyStandard } from "@/domain/social/montage/standard";
import { checkTimeline } from "@/domain/social/montage/suggest";
import { parseTemplate, STANDARD_TEMPLATE, templateWarnings, type AnimationTemplate } from "@/domain/social/montage/template";

function words(text: string) {
  return text.split(" ").map((w, i) => ({ text: w, startMs: i * 300, endMs: i * 300 + 250 }));
}
const SPEECH = "Ton réseau vaut de l'or si on sait quoi dire. Imagine un photographe qui travaille avec les restaurants du quartier. Nous avons accueilli 120 entrepreneurs cette année dans nos clubs. D'abord tu dis qui tu aides, ensuite dans quelle situation, enfin tu vérifies ce qu'on a retenu. Retiens bien ceci, la recommandation se prépare. Commente RÉSEAU pour visiter un club.";
const w = words(SPEECH);
const end = w[w.length - 1].endMs + 2500;
const scenes = analyzeScenes(w, { keyword: "RÉSEAU" });
const matte = () => "prise.matte.webm";

const mine: AnimationTemplate = {
  ...STANDARD_TEMPLATE, name: "Mon modèle",
  hook: { position: "milieu", couleur: "bleu", entree: "laterale" }, overlayMs: 3000, minSpacingMs: 3000,
};

describe("Mon modèle (base d'animation de Cédric)", () => {
  it("sans modèle : résultat identique au Standard BeeRecos v1 (montages existants rejoués à l'identique)", () => {
    const a = applyStandard(scenes, { endMs: end, keyword: "RÉSEAU", matteAt: matte, words: w });
    const b = applyStandard(scenes, { endMs: end, keyword: "RÉSEAU", matteAt: matte, words: w, template: STANDARD_TEMPLATE });
    expect(b).toEqual(a);
    expect(a.custom.every((c) => c.label?.startsWith("Standard v1 · "))).toBe(true);
  });

  it("applique le style de l'accroche, la durée et le nom du modèle", () => {
    const { custom } = applyStandard(scenes, { endMs: end, keyword: "RÉSEAU", matteAt: matte, words: w, template: mine });
    const hook = custom.find((c) => c.label === "Mon modèle · accroche")!;
    expect(hook).toMatchObject({ name: "titre-derriere", props: { position: "milieu", couleur: "bleu", entree: "laterale" } });
    expect(hook.toMs - hook.fromMs).toBe(3000);
    expect(checkTimeline(custom)).toEqual([]);
  });

  it("0 grand mot derrière : tout reste devant, même avec un détourage, sans avertissement de détourage", () => {
    const r = applyStandard(scenes, { endMs: end, keyword: "RÉSEAU", matteAt: matte, words: w, template: { ...mine, maxBehind: 0 } });
    expect(r.custom.some((c) => c.name === "titre-derriere")).toBe(false);
    expect(r.warnings.some((x) => x.includes("détourage"))).toBe(false);
  });

  it("respecte le nombre maximal de grands mots derrière", () => {
    const { custom } = applyStandard(scenes, { endMs: end, keyword: "RÉSEAU", matteAt: matte, words: w, template: { ...mine, maxBehind: 1 } });
    expect(custom.filter((c) => c.name === "titre-derriere").length).toBeLessThanOrEqual(1);
  });

  it("n'ajoute que les animations cochées", () => {
    const { custom } = applyStandard(scenes, { endMs: end, keyword: "RÉSEAU", matteAt: matte, words: w,
      template: { ...mine, auto: { onglet: false, chiffre: false, liste: false, "mot-cle": false, "logo-fin": false } } });
    expect(custom.map((c) => c.name).every((n) => n === "titre-derriere")).toBe(true);
  });

  it("refuse des réglages hors charte ou incomplets (jamais un modèle à moitié appliqué)", () => {
    expect(parseTemplate(STANDARD_TEMPLATE)).toEqual(STANDARD_TEMPLATE);
    expect(parseTemplate({ ...STANDARD_TEMPLATE, hook: { ...STANDARD_TEMPLATE.hook, couleur: "rose" } })).toBeNull();
    expect(parseTemplate({ ...STANDARD_TEMPLATE, overlayMs: 10_000 })).toBeNull();
    expect(parseTemplate({ ...STANDARD_TEMPLATE, police: "Comic Sans" })).toBeNull();
    expect(parseTemplate(null)).toBeNull();
  });

  it("signale sans bloquer un modèle sans logo de fin ni appel à l'action", () => {
    expect(templateWarnings(STANDARD_TEMPLATE)).toEqual([]);
    expect(templateWarnings({ ...STANDARD_TEMPLATE, auto: { ...STANDARD_TEMPLATE.auto, "logo-fin": false, "mot-cle": false } })).toHaveLength(2);
  });
});
