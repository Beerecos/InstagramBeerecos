import { describe, expect, it } from "vitest";
import { BriefSchema, checkStoryboard, rulesMemory, storyboardContext, StudioSettingsSchema, withSettings } from "@/domain/social/montage/ideation";
import { initialEdit } from "@/domain/social/montage/montage";

const BRIEF = { sujet: "Nos 12 clubs", angle: "Vu par un nouveau membre", motCle: "CLUB" };
const WORDS = [" On", " est", " 35", " par", " club."].map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
const SEQ = { idee: "Accroche", parole: "On est 35 par club.", titre: "35 par club", traitement: "onglet" as const, dureeS: 5 };

describe("idéation du Studio", () => {
  it("brief : sujet, angle et mot-clé obligatoires", () => {
    expect(BriefSchema.safeParse(BRIEF).success).toBe(true);
    expect(BriefSchema.safeParse({ sujet: "Nos clubs", angle: "x" }).success).toBe(false);
    expect(BriefSchema.safeParse({ ...BRIEF, pilier: "Marketing" }).success).toBe(false);
  });

  it("storyboard : chiffres du brief ou de la prise seulement, durée d'un Reel", () => {
    const ok = checkStoryboard({ sequences: [SEQ, { ...SEQ, titre: "12 clubs" }], cta: "Commente CLUB" }, BRIEF, WORDS);
    expect(ok.ok).toBe(true);
    const bad = checkStoryboard({ sequences: [{ ...SEQ, titre: "500 membres" }], cta: "Commente CLUB" }, BRIEF, WORDS);
    expect(bad.ok ? [] : bad.errors).toEqual(["• séquence 1 → chiffre absent du brief et de la prise : 500 (DONNÉE MANQUANTE : à fournir, jamais à inventer)"]);
    const long = checkStoryboard({ sequences: Array.from({ length: 4 }, () => ({ ...SEQ, dureeS: 50 })), cta: "Commente CLUB" }, BRIEF, WORDS);
    expect(long.ok).toBe(false);
  });

  it("avertit sans bloquer : CTA sans le mot-clé, titre derrière le sujet (étape B), prise non transcrite", () => {
    const r = checkStoryboard({ sequences: [{ ...SEQ, traitement: "derriere-sujet" }], cta: "Abonne-toi" }, BRIEF, []);
    expect(r.ok).toBe(false); // 35 n'est ni dans le brief ni dans une prise absente
    const r2 = checkStoryboard({ sequences: [{ ...SEQ, titre: "Nos clubs", parole: "", traitement: "derriere-sujet" }], cta: "Abonne-toi" }, BRIEF, []);
    expect(r2.ok && r2.warnings.length).toBe(3);
  });

  it("le storyboard validé devient le plan des propositions ; les préférences s'appliquent au montage", () => {
    expect(storyboardContext({ sequences: [SEQ], cta: "Commente CLUB", baseline: true })).toContain("titre « 35 par club » (onglet)");
    const s = StudioSettingsSchema.parse({ accent: "vert", captionStyle: { top: 1400 }, rules: ["Toujours partir d'une situation vécue."] });
    expect(withSettings(initialEdit("p.mp4", 4000), s)).toMatchObject({ accent: "bleu", subtitles: true, captionStyle: { top: 1400 } });
    expect(rulesMemory(s)).toEqual([{ slug: "regles-de-la-direction", content: "- Toujours partir d'une situation vécue." }]);
  });
});
