import { describe, expect, it } from "vitest";
import { animationAiBrief, parseAnimationAi, spokenAround } from "@/domain/social/montage/animation-ai";

const words = "Tu connais 500 personnes. Qui sait vraiment quand te recommander ?".split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
const a = { name: "bandeau-double", fromMs: 0, toMs: 2000, props: { texte: "Tu connais", detail: "cinq cents personnes" } };

describe("✨ Proposer avec l'IA (réglages d'une animation)", () => {
  it("lit ce qui est dit autour et liste les champs de l'animation", () => {
    expect(spokenAround(words, a)).toContain("500 personnes");
    const brief = animationAiBrief("bandeau-double", spokenAround(words, a));
    expect(brief).toContain("- texte");
    expect(brief).toContain("- remplacement (facultatif");
  });
  it("garde une proposition valide, raccourcit, refuse un chiffre inventé", () => {
    const spoken = spokenAround(words, a);
    expect(parseAnimationAi('{"texte":"500 CONTACTS","detail":"qui te recommande ?","remplacement":""}', a, spoken)).toEqual({ props: { texte: "500 CONTACTS", detail: "qui te recommande ?", angle: -7 } });
    const long = parseAnimationAi(JSON.stringify({ texte: "x".repeat(60), detail: "ok" }), a, spoken);
    expect("props" in long && (long.props.texte as string).length).toBe(38);
    expect(parseAnimationAi('{"texte":"1000 CONTACTS","detail":"ok"}', a, spoken)).toEqual({ error: "La proposition contenait un chiffre qui n'a pas été dit : réessaie." });
    expect(parseAnimationAi("pas du json", a, spoken)).toEqual({ error: "Proposition illisible : réessaie." });
  });
});
