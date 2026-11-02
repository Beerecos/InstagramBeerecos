import { describe, expect, it } from "vitest";
import { storyToMotion, OFFICIAL_SIGNATURE_VOICE } from "@/domain/reels/ai-spec";
import { DEMO_STORY } from "@/domain/social/reel-story/spec";
import { parseMotionSpec } from "@/domain/social/reel-story/motion-spec";

describe("adaptateur Recommandation → scènes Motion", () => {
  const motion = storyToMotion(DEMO_STORY);
  it("produit un MotionSpec valide pour le même éditeur", () => {
    const parsed = parseMotionSpec(motion);
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
  });
  it("reprend les textes validés mot pour mot", () => {
    const voices = motion.scenes.map((s) => s.voice);
    for (const line of Object.values(DEMO_STORY.voice.lines)) expect(voices).toContain(line);
    expect(motion.scenes[0].title).toBe("TU\nRECOMMANDES.");
    expect(motion.scenes.find((s) => s.title.includes("VALEUR"))?.pivot).toBe("VALEUR");
  });
  it("une seule scène CTA juste avant une seule signature officielle", () => {
    const visuals = motion.scenes.map((s) => s.visual);
    expect(visuals.filter((v) => v === "cta")).toHaveLength(1);
    expect(visuals.filter((v) => v === "signature")).toHaveLength(1);
    expect(visuals.at(-2)).toBe("cta");
    expect(motion.scenes.at(-1)?.voice).toBe(OFFICIAL_SIGNATURE_VOICE);
    expect(motion.cta.keyword).toBe("CLUB");
  });
  it("ignore une séquence sans voix", () => {
    const silent = storyToMotion({ ...DEMO_STORY, voice: { ...DEMO_STORY.voice, lines: { ...DEMO_STORY.voice.lines, rupture: "" } } });
    expect(silent.scenes.some((s) => s.title === "ET\nTOI ?")).toBe(false);
  });
});
