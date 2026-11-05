import { describe, expect, it } from "vitest";
import { analyzeScenes } from "@/domain/social/montage/scenes";
import { applyStandard, STANDARD_V1 } from "@/domain/social/montage/standard";
import { checkTimeline } from "@/domain/social/montage/suggest";

/** Transcript factice : un mot toutes les 300 ms, phrases séparées par un point. */
function words(text: string) {
  return text.split(" ").map((w, i) => ({ text: w, startMs: i * 300, endMs: i * 300 + 250 }));
}
const SPEECH = "Ton réseau vaut de l'or si on sait quoi dire. Imagine un photographe qui travaille avec les restaurants du quartier. Nous avons accueilli 120 entrepreneurs cette année dans nos clubs. D'abord tu dis qui tu aides, ensuite dans quelle situation, enfin tu vérifies ce qu'on a retenu. Retiens bien ceci, la recommandation se prépare. Commente RÉSEAU pour visiter un club.";

describe("Standard v1", () => {
  const w = words(SPEECH);
  const end = w[w.length - 1].endMs + 2500;
  const scenes = analyzeScenes(w, { keyword: "RÉSEAU" });

  it("pose toujours les mêmes animations, sans chevauchement, une seule fin et un seul mot-clé", () => {
    const { custom } = applyStandard(scenes, { endMs: end, keyword: "RÉSEAU", matteAt: () => "prise.matte.webm" });
    expect(custom.every((c) => (STANDARD_V1.animations as readonly string[]).includes(c.name))).toBe(true);
    expect(checkTimeline(custom)).toEqual([]);
    expect(custom.filter((c) => c.name === "logo-fin")).toHaveLength(1);
    expect(custom.find((c) => c.name === "mot-cle")?.props).toEqual({ mot: "RÉSEAU" });
    const starts = custom.filter((c) => c.name !== "logo-fin").map((c) => c.fromMs).sort((a, b) => a - b);
    starts.slice(1).forEach((s, i) => expect(s - starts[i]).toBeGreaterThanOrEqual(STANDARD_V1.minSpacingMs));
  });

  it("accroche : grand mot blanc derrière la tête avec rebond, pris dans ce qui est dit", () => {
    const { custom } = applyStandard(scenes, { endMs: end, keyword: "RÉSEAU", matteAt: () => "prise.matte.webm" });
    const hook = custom[0];
    expect(hook).toMatchObject({ name: "titre-derriere", fromMs: 300, props: { texte: "RÉSEAU", position: "haut", couleur: "blanc", entree: "rebond" } });
    expect(custom.filter((c) => c.name === "titre-derriere").length).toBeLessThanOrEqual(STANDARD_V1.maxBehind);
  });

  it("un chiffre n'apparaît que s'il est prononcé, avec la légende dite", () => {
    const { custom } = applyStandard(scenes, { endMs: end, keyword: "RÉSEAU" });
    const fig = custom.find((c) => c.name === "chiffre");
    if (fig) {
      expect(fig.props.valeur).toBe(120);
      expect(SPEECH).toContain(String(fig.props.legende));
    }
  });

  it("sans détourage, les grands mots passent en onglet ; sans mot-clé lié, pas de pastille", () => {
    const { custom, warnings } = applyStandard(scenes, { endMs: end, keyword: null });
    expect(custom.some((c) => c.name === "titre-derriere")).toBe(false);
    expect(custom.some((c) => c.name === "mot-cle")).toBe(false);
    expect(warnings.join("\n")).toMatch(/passe en onglet/);
    expect(warnings.join("\n")).toMatch(/sans mot-clé/);
  });
});

describe("Standard v1 sur une vraie prise (« test 1 », 2026-11-05)", () => {
  const said = "Tu connais cinq cents personnes qui sait vraiment quand te recommander. Imagine que tu sois photographe, tes contacts connaissent ton métier. Cette précision peut leur faire penser à toi au détour d'une conversation. Tu sauras si ton message est assez clair pour être transmis. Commente réseau et je t'envoie les informations.";
  const w = said.split(" ").map((t, i) => ({ text: ` ${t}`, startMs: i * 450, endMs: i * 450 + 400 }));
  const scenes = analyzeScenes(w, {});
  const end = w[w.length - 1].endMs + 2500;

  it("mots forts dits (pas les premiers mots venus), mot-clé repris après « Commente »", () => {
    const { custom, warnings } = applyStandard(scenes, { endMs: end, keyword: null, words: w });
    const texts = custom.map((c) => String(c.props.texte ?? c.props.mot ?? ""));
    expect(texts).toContain("RECOMMANDER");
    expect(texts).toContain("PRÉCISION");
    expect(texts).toContain("RÉSEAU");
    expect(texts.join(" ")).not.toMatch(/TU CONNAIS/);
    expect(warnings.join("\n")).toMatch(/Mot-clé dit dans la vidéo : « RÉSEAU »/);
    expect(checkTimeline(custom)).toEqual([]);
  });

  it("un chiffre dit en toutes lettres devient un chiffre animé, avec la suite de la phrase", () => {
    const one = analyzeScenes(w.slice(0, 11), {});
    const { custom } = applyStandard([...one, ...one.map((s) => ({ ...s, index: 1, startMs: s.startMs + 20000, endMs: s.endMs + 20000 })), ...one.map((s) => ({ ...s, index: 2, startMs: s.startMs + 40000, endMs: s.endMs + 40000 }))], { endMs: 60000, words: [...w.slice(0, 11), ...w.slice(0, 11).map((x) => ({ ...x, startMs: x.startMs + 20000, endMs: x.endMs + 20000 })), ...w.slice(0, 11).map((x) => ({ ...x, startMs: x.startMs + 40000, endMs: x.endMs + 40000 }))] });
    expect(custom.find((c) => c.name === "chiffre")?.props).toMatchObject({ valeur: 500, legende: "personnes qui sait vraiment" });
  });
});
