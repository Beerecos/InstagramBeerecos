/**
 * Modèle IA canonique d'Instagram BeeRecos : MotionSpec (scènes avec voix, texte affiché, visuel, pivot, cartes).
 * Adaptateur des contenus hérités « Recommandation » (StorySpec, 7 séquences fixes) : les textes validés sont repris
 * mot pour mot, sans recopie manuelle entre deux éditeurs. Seule la signature finale officielle est ajoutée
 * (logo et baseline), comme dans le film validé du 2026-10-23.
 */
import { DEFAULT_VOICE_SPEED } from "@/domain/social/reel-story/pron";
import { AUDREY_VOICE_ID } from "@/domain/social/reel-story/audrey";
import { MOTION_STYLE_ID, type MotionScene, type MotionSpec } from "@/domain/social/reel-story/motion-spec";
import type { StorySpec } from "@/domain/social/reel-story/spec";

/** Texte affiché sans les marqueurs d'emphase `*mot*` ; le premier mot souligné devient le mot pivot. */
function unmark(text: string): { text: string; pivot?: string } {
  const pivot = /\*([^*]+)\*/.exec(text)?.[1]?.trim();
  return { text: text.replace(/\*/g, "").trim(), ...(pivot ? { pivot } : {}) };
}

export const OFFICIAL_SIGNATURE_VOICE = "BeeRecos. Mon réseau, c’est ton réseau.";

export function storyToMotion(story: StorySpec): MotionSpec {
  const lines = story.voice.lines;
  const scenes: MotionScene[] = [];
  const push = (id: string, scene: Omit<MotionScene, "id">) => { if (scene.voice.trim()) scenes.push({ id, ...scene }); };
  const hook = unmark(story.hook.text);
  push("s1", { visual: "titre", voice: lines.hook, title: hook.text, subtitle: story.hook.complement || undefined, pivot: hook.pivot });
  const consequence = unmark(story.consequence.text);
  push("s2", { visual: "titre", voice: lines.consequence, title: consequence.text, pivot: consequence.pivot });
  const rupture = unmark(story.rupture.text);
  push("s3", { visual: "titre", voice: lines.rupture, title: rupture.text, pivot: rupture.pivot });
  const value = unmark(story.value.text);
  push("s4", { visual: "titre", voice: lines.value, title: value.text, pivot: value.pivot });
  const steps = story.steps.items.map((s) => s.title.replace(/[.!]+$/, "").trim()).filter(Boolean);
  push("s5", { visual: "liste", voice: lines.steps, title: steps.join("\n"), items: steps.slice(0, 3) });
  push("s6", { visual: "marque", voice: lines.signature, title: story.signature.tagline.replace(/[.!]+$/, "") });
  push("s7", { visual: "cta", voice: lines.cta, title: story.cta.verb.charAt(0) + story.cta.verb.slice(1).toLowerCase(), subtitle: story.cta.complement || undefined, pivot: story.cta.keyword });
  scenes.push({ id: "s8", visual: "signature", voice: OFFICIAL_SIGNATURE_VOICE, title: "" });
  return {
    kind: "motion",
    style: MOTION_STYLE_ID,
    title: story.title,
    objective: "",
    pillar: story.pillar,
    targetSeconds: 45,
    settings: { rythme: "dynamique", texte: "equilibre", presence: "mascotte" },
    scenes,
    cta: { keyword: story.cta.keyword, complement: story.cta.complement },
    voice: { provider: "heygen", voiceId: AUDREY_VOICE_ID, speed: DEFAULT_VOICE_SPEED },
  };
}
