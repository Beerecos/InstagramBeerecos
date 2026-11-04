import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INSPIBEEZNESS_CAROUSEL_PROMPT } from "@/domain/instagram/presets/inspibeezness";
import { INSPI_CTA, INSPI_ENDING, INSPI_HASHTAGS, STORY_RULES, storyBrief, storyLength, withInspiEnding } from "@/domain/instagram/story-caption";

describe("légende InspiBEEz'ness : raconter toute l'histoire", () => {
  it("la consigne couvre les 9 étapes, la fiabilité et le budget, et interdit d'écrire la fin soi-même", () => {
    for (const step of ["L'ouverture", "Le contexte", "Le déclic", "La création", "Le lancement", "L'évolution", "Le résultat", "La réflexion entrepreneuriale"]) expect(STORY_RULES).toContain(step);
    expect(STORY_RULES).toMatch(/N'invente aucun dialogue/);
    expect(STORY_RULES).toMatch(/2000 caractères/);
    expect(STORY_RULES).toMatch(/N'écris PAS l'invitation finale/);
    const brief = storyBrief("STABILO BOSS", "Slide 1 : 1971");
    expect(brief).toContain("SUJET : STABILO BOSS");
    expect(brief).toContain("Slide 1 : 1971");
  });

  it("termine toujours par l'invitation et les hashtags exacts, sans doublon", () => {
    expect(withInspiEnding("Le récit.")).toBe(`Le récit.\n\n${INSPI_ENDING}`);
    const modelAdded = "Le récit.\n\nTu veux rencontrer des entrepreneurs inspirants ? Commente INSPI !\n#BeeRecos #Inspi";
    expect(withInspiEnding(modelAdded)).toBe(`Le récit.\n\n${INSPI_ENDING}`);
    expect(withInspiEnding(withInspiEnding("Le récit."))).toBe(`Le récit.\n\n${INSPI_ENDING}`);
  });

  it("la légende STABILO validée respecte la fin exacte et le budget de 2 000 caractères", () => {
    const text = readFileSync("content/legendes/2026-11-04-inspibeezness-stabilo-boss.txt", "utf8").trimEnd();
    expect(text.endsWith(INSPI_ENDING)).toBe(true);
    expect(storyLength(text)).toEqual({ length: 1952, overBudget: false });
    expect(storyLength("x".repeat(2001)).overBudget).toBe(true);
  });
});

describe("prompt Carrousels InspiBEEz'ness (4 novembre 2026)", () => {
  it("contient les 10 sections, le format 4:5, 8 slides au plus et l'invitation exacte", () => {
    for (let i = 1; i <= 10; i++) expect(INSPIBEEZNESS_CAROUSEL_PROMPT).toMatch(new RegExp(`^${i}\\. `, "m"));
    expect(INSPIBEEZNESS_CAROUSEL_PROMPT).toContain("1 080 × 1 350 px");
    expect(INSPIBEEZNESS_CAROUSEL_PROMPT).toContain("8 slides maximum");
    expect(INSPIBEEZNESS_CAROUSEL_PROMPT).toContain(INSPI_CTA);
    expect(INSPIBEEZNESS_CAROUSEL_PROMPT).toContain(INSPI_HASHTAGS);
  });
});
