import { describe, expect, it } from "vitest";
import { addBlock, isReady, motionToScript, newScript, prompterText, removeBlock, scriptChecks, scriptSeconds, scriptToMotion, type Script } from "@/domain/scripts/script";
import { parseMotionSpec } from "@/domain/social/reel-story/motion-spec";

const filled = (): Script => {
  const s = newScript();
  const text: Record<string, [string, string]> = {
    HOOK: ["Tu recommandes un pro, et après ?", "Et après ?"],
    LEAD: ["Une mise en relation réussie crée de la confiance entre trois personnes, et cette confiance se cultive chaque semaine.", "La confiance se cultive"],
    BODY_1: ["Chez BeeRecos, chaque recommandation est enregistrée et suivie, pour que personne ne l'oublie en chemin.", "Chaque reco suivie"],
    CTA: ["Envie de voir comment ça se passe ? Commente CLUB et je t'envoie les informations pour visiter un club.", ""],
  };
  return { ...s, title: "Après la reco", blocks: s.blocks.map((b) => ({ ...b, voice: text[b.role][0], screen: text[b.role][1] })) };
};

describe("éditeur de script : du hook au call to action", () => {
  it("commence par le hook et finit par le CTA, blocs facultatifs à leur place", () => {
    let s = newScript();
    expect(s.blocks.map((b) => b.role)).toEqual(["HOOK", "LEAD", "BODY_1", "CTA"]);
    s = addBlock(addBlock(s, "BODY_2"), "OPEN_LOOP_1");
    expect(s.blocks.map((b) => b.role)).toEqual(["HOOK", "LEAD", "BODY_1", "OPEN_LOOP_1", "BODY_2", "CTA"]);
    expect(addBlock(s, "BODY_2").blocks).toHaveLength(6);
    const hook = s.blocks[0].id;
    expect(removeBlock(s, hook).blocks).toHaveLength(6); // le hook est obligatoire
    expect(removeBlock(s, s.blocks[3].id).blocks.map((b) => b.role)).not.toContain("OPEN_LOOP_1");
  });
  it("contrôle mot-clé, texte à l'écran, chiffres et orthographe de BeeRecos", () => {
    const s = filled();
    expect(scriptChecks(s).filter((c) => c.level === "erreur")).toEqual([]);
    expect(isReady(s)).toBe(true);
    const bad: Script = { ...s, blocks: s.blocks.map((b) => b.role === "CTA" ? { ...b, voice: "Commente club." } : b.role === "BODY_1" ? { ...b, voice: "Avec Beerecos tu gagnes 20 %.", screen: "un deux trois quatre cinq six sept huit" } : b) };
    const errors = scriptChecks(bad).map((c) => c.text).join(" | ");
    expect(errors).toMatch(/prononce le mot-clé CLUB/);
    expect(errors).toMatch(/7 mots à l'écran/);
    expect(errors).toMatch(/aucun montant/);
    expect(errors).toMatch(/écris BeeRecos/);
  });
  it("estime la durée et signale la cible 35–60 s", () => {
    const s = filled();
    expect(scriptSeconds(s)).toBeGreaterThan(20);
    expect(scriptChecks({ ...s, blocks: [s.blocks[0], s.blocks[3]] }).some((c) => /Durée estimée/.test(c.text))).toBe(true);
  });
  it("devient un MotionSpec valide (réel IA) et se rouvre à l'identique", () => {
    const s = filled();
    const spec = scriptToMotion(s);
    const parsed = parseMotionSpec(spec);
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
    expect(spec.scenes.map((x) => x.role ?? x.visual)).toEqual(["HOOK", "LEAD", "BODY_1", "CTA", "signature"]);
    const back = motionToScript(spec);
    expect(back.blocks.map((b) => [b.role, b.voice, b.screen])).toEqual(s.blocks.map((b) => [b.role, b.voice, b.screen]));
    expect(prompterText(back).split("\n\n")).toHaveLength(4);
  });
});
