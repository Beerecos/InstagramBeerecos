import { describe, expect, it } from "vitest";
import { StoryboardSchema, type Storyboard } from "@/domain/social/montage/ideation";
import { checkNarrativeOrder, estimateSeconds, narrativeCoverage, narrativePrompt, readHooks, readSequences, scoreNarrative, speechSeconds } from "@/domain/social/montage/narrative";

const ROLES = ["HOOK", "LEAD", "BODY_1", "OPEN_LOOP_1", "BODY_2", "OPEN_LOOP_2", "BODY_3", "CTA"] as const;
const brief = { sujet: "Le réseau BeeRecos", angle: "Vu par un membre", motCle: "CLUB" };
const text = (n: number) => Array.from({ length: n }, (_, i) => `mot${String.fromCharCode(97 + (i % 26))}`).join(" ");
const sb = (patch: (s: Storyboard) => void = () => {}): Storyboard => {
  const s: Storyboard = {
    sequences: ROLES.map((role) => ({ idee: role, parole: role === "HOOK" ? "Pourquoi personne ne te recommande ?" : role.startsWith("OPEN") ? "Mais le plus important reste à venir." : role === "CTA" ? "Commente CLUB pour préparer ta visite." : text(14), titre: "Titre court", traitement: "onglet", dureeS: 5, role })),
    cta: "Commente CLUB", baseline: true,
  };
  patch(s);
  return s;
};

describe("moteur narratif des Reels", () => {
  it("le rôle est facultatif : un storyboard d'avant le moteur reste valide", () => {
    expect(StoryboardSchema.safeParse({ sequences: [{ idee: "Accroche", parole: "", titre: "", traitement: "onglet", dureeS: 4 }], cta: "Commente CLUB", baseline: true }).success).toBe(true);
    expect(StoryboardSchema.safeParse({ ...sb(), ctaObjectif: "invitation_club" }).success).toBe(true);
    expect(StoryboardSchema.safeParse({ ...sb(), ctaObjectif: "viral" }).success).toBe(false);
  });
  it("durée estimée sur la parole (≈ 155 mots/min), sinon la durée prévue", () => {
    expect(speechSeconds(text(26))).toBe(10.4);
    expect(estimateSeconds({ sequences: [{ idee: "x", parole: "", titre: "", traitement: "aucun", dureeS: 7 }] })).toBe(7);
    expect(estimateSeconds(sb())).toBeGreaterThanOrEqual(35);
  });
  it("potentiel : bonne structure > structure faible ; les blocs faibles sont désignés", () => {
    const good = scoreNarrative(sb(), brief);
    expect(good.overall).toBeGreaterThanOrEqual(80);
    expect(good.weak).toEqual([]);
    const bad = scoreNarrative(sb((s) => { s.sequences[0].parole = text(20); s.sequences[3].parole = "Voici une info."; s.sequences[7].parole = "Abonne-toi."; s.cta = "Abonne-toi"; }), brief);
    expect(bad.overall).toBeLessThan(good.overall);
    expect(bad.weak).toEqual(expect.arrayContaining(["HOOK", "OPEN_LOOP_1", "CTA"]));
  });
  it("ordre des huit blocs contrôlé ; couverture pour la bande narrative", () => {
    expect(checkNarrativeOrder(sb())).toEqual([]);
    expect(checkNarrativeOrder(sb((s) => { s.sequences.reverse(); }))[0]).toContain("huit blocs");
    expect(narrativeCoverage(sb((s) => { s.sequences.splice(4, 1); })).find((c) => c.role === "BODY_2")!.index).toBe(-1);
  });
  it("réponses de Bee : un hook par type, un seul recommandé ; rôle inconnu retiré ; nom de rôle sans chiffre dans l'idée", () => {
    const hooks = readHooks({ hooks: [{ type: "probleme", parole: "a", recommended: true }, { type: "curiosite", parole: "b", recommended: true }, { type: "provocation", parole: "beerecos c" }, { type: "autre", parole: "d" }] });
    expect(hooks.map((h) => h.type)).toEqual(["probleme", "curiosite", "provocation"]);
    expect(hooks.filter((h) => h.recommended)).toHaveLength(1);
    expect(hooks[2].parole).toBe("BeeRecos c");
    const seqs = readSequences([{ idee: "BODY_1 : la première idée", parole: "x", role: "BODY_1" }, { idee: "Bonus", parole: "y", role: "BONUS" }]);
    expect(seqs[0]).toMatchObject({ idee: "la première idée", role: "BODY_1" });
    expect(seqs[1]).not.toHaveProperty("role");
  });
  it("consignes : piliers BeeRecos, objectif du CTA, transcript repris tel quel pour une vidéo tournée", () => {
    const p = narrativePrompt("full", brief, [{ text: " Bonjour", startMs: 0, endMs: 300 }], [{ slug: "brand", content: "charte" }], { objectif: "dm" });
    expect(p.system).toContain("École de formation");
    expect(p.system).toContain("#MonReseauCestTonReseau");
    expect(p.system).toContain("passage EXACT du transcript");
    expect(p.system).toContain("objectif « DM »");
    expect(p.user).toContain("Bonjour");
    expect(narrativePrompt("block", brief, [], [], { storyboard: sb(), index: 2, intent: "provocateur" }).system).toContain("plus provocateur");
  });
});
