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

import { readFileSync } from "node:fs";
import { reelToMotion, splitSpoken } from "@/domain/reels/ai-spec";
import type { Reel } from "@/domain/social/montage/reels";

describe("script des 72 → réel IA", () => {
  const structure = JSON.parse(readFileSync(new URL("../../content/reels-72/BeeRecos_72_Reels_Structure.json", import.meta.url), "utf8"));
  const reels: Reel[] = structure.reels;
  it("découpe une parole longue sans perdre un mot", () => {
    const long = "Première phrase assez longue pour remplir. ".repeat(8).trim();
    const parts = splitSpoken(long, 100);
    expect(parts.every((p) => p.length <= 100)).toBe(true);
    expect(parts.join(" ")).toBe(long);
  });
  it("reprend toutes les paroles des 72 scripts mot pour mot, CTA puis signature en fin", () => {
    for (const reel of reels) {
      const { spec } = reelToMotion(reel);
      const spoken = spec.scenes.slice(0, -1).map((s) => s.voice).join(" ").replace(/\s+/g, " ");
      const expected = reel.scenes.map((s) => s.spoken_text).join(" ").replace(/\s+/g, " ").trim();
      expect(spoken.split(" ").sort()).toEqual(expected.split(" ").sort());
      expect(spec.scenes.at(-1)?.visual).toBe("signature");
      expect(spec.scenes.filter((s) => s.visual === "cta").length).toBeLessThanOrEqual(1);
      expect(spec.scenes.every((s) => s.voice.length <= 220)).toBe(true);
      expect(spec.cta.keyword).toBe(reel.cta.display_keyword);
    }
  });
  it("garde les identifiants V01–V72 dans le titre", () => {
    expect(reelToMotion(reels[0]).spec.title.startsWith("V01 · ")).toBe(true);
  });
});
