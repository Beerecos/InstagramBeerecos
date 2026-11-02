import { parseMotionSpec, type MotionSpec } from "./motion-spec";

/** The AI writes into the human storyboard; it cannot replace or reorder its cards. */
export function parseMotionProposal(input: unknown, current: MotionSpec): MotionSpec {
  if (!input || typeof input !== "object") throw new Error("Proposition illisible.");
  const candidate = input as Record<string, unknown>;
  if (!Array.isArray(candidate.scenes) || candidate.scenes.length !== current.scenes.length ||
    candidate.scenes.some((s, i) => !s || s.id !== current.scenes[i].id || s.visual !== current.scenes[i].visual)) {
    throw new Error("L’IA a modifié les cartes choisies. Proposition écartée : ton montage est conservé.");
  }
  const parsed = parseMotionSpec({ ...candidate, settings: current.settings, voice: current.voice, cta: current.cta, assets: undefined });
  if (!parsed.ok) throw new Error(`Proposition à refaire : ${parsed.errors.join(" ")}`);
  return parsed.spec;
}
