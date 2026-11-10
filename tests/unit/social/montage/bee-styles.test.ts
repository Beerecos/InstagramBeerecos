import { describe, expect, it } from "vitest";
import { activeStyle, BEE_STYLE, BEE_STYLES, swapWordAnimation, WORD_ANIMATIONS, wordProps } from "@/domain/social/montage/bee-styles";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { analyzeScenes } from "@/domain/social/montage/scenes";
import { applyStandard } from "@/domain/social/montage/standard";
import { checkTimeline } from "@/domain/social/montage/suggest";

const SPEECH = "Ton réseau vaut de l'or si on sait quoi dire. Imagine un photographe qui travaille avec les restaurants du quartier. Nous avons accueilli 120 entrepreneurs cette année dans nos clubs. La confiance se construit chaque semaine avec ton club. Retiens bien ceci, la recommandation se prépare. Commente RÉSEAU pour visiter un club.";
const w = SPEECH.split(" ").map((t, i) => ({ text: t, startMs: i * 300, endMs: i * 300 + 250 }));
const end = w[w.length - 1].endMs + 2500;
const scenes = analyzeScenes(w, { keyword: "RÉSEAU" });
const run = (k?: (typeof BEE_STYLES)[number], matte = false) =>
  applyStandard(scenes, { endMs: end, keyword: "RÉSEAU", words: w, ...(matte ? { matteAt: () => "m.webm" } : {}), ...(k ? { look: BEE_STYLE[k].look, styleName: BEE_STYLE[k].label } : {}) });

describe("BeeStyles : choisir ses animations, même sans détourage", () => {
  it("sans style : pose identique à avant (onglets)", () => {
    expect(run().custom.filter((a) => a.name !== "logo-fin" && a.name !== "mot-cle" && a.name !== "chiffre").every((a) => a.name === "onglet")).toBe(true);
  });

  it("chaque style pose ses propres animations, valides et sans chevauchement, sans détourage", () => {
    for (const k of BEE_STYLES) {
      const { custom } = run(k);
      expect(checkTimeline(custom), k).toEqual([]);
      for (const a of custom) expect(ANIMATIONS[a.name].props.safeParse(a.props).success, `${k} ${a.name}`).toBe(true);
      expect(activeStyle(custom)).toBe(k);
    }
    const names = new Set(run("dynamic").custom.map((a) => a.name));
    expect(names.has("titre-profondeur") || names.has("mot-impact")).toBe(true);
    expect(names.has("onglet")).toBe(false);
  });

  it("avec un détourage, l'accroche peut toujours passer derrière la personne", () => {
    expect(run("punch", true).custom.some((a) => a.name === "titre-derriere")).toBe(true);
  });

  it("changer d'animation garde le texte et les temps", () => {
    const a = { name: "onglet", fromMs: 1000, toMs: 3500, props: { texte: "RÉSEAU", variante: "blanc" }, label: "x" };
    for (const n of WORD_ANIMATIONS) {
      const b = swapWordAnimation(a, n);
      expect(b).toMatchObject({ name: n, fromMs: 1000, toMs: 3500 });
      expect(ANIMATIONS[n].props.safeParse(b.props).success, n).toBe(true);
    }
    expect(swapWordAnimation(swapWordAnimation(a, "papier-dechire"), "titre").props).toEqual({ texte: "RÉSEAU" });
    expect(wordProps("mot-impact", "x".repeat(90)).texte).toHaveLength(48);
    const logo = { name: "logo-fin", fromMs: 0, toMs: 1, props: {} };
    expect(swapWordAnimation(logo, "titre")).toBe(logo);
  });
});
