import { z } from "zod";
import { CustomAnimationSchema } from "./montage/edit";
import type { CustomAnimation } from "./montage/suggest";
import { ANIMATIONS, ARCHIVED_ANIMATIONS } from "./montage/registry";
import { motionRegistryKey, stampMotionVersions } from "./montage/beemotion";
import { parseMotionSpec, type MotionSpec } from "./reel-story/motion-spec";
import { parseStorySpec, type StorySpec } from "./reel-story/spec";
import { StoryboardSchema, type Storyboard } from "./editorial/schema";

export type StudioAssetKind = "effect" | "motion" | "story" | "editorial";
export type StudioEffect = { schemaVersion: 1; layers: CustomAnimation[]; durationMs: number };
export type StudioAssetData = { effect: StudioEffect; motion: MotionSpec; story: StorySpec; editorial: Storyboard };
export type StudioAsset<K extends StudioAssetKind = StudioAssetKind> = K extends StudioAssetKind ? {
  id: string; kind: K; title: string; revision: number; status: "draft" | "approved" | "archived";
  data: StudioAssetData[K]; createdAt: string; updatedAt: string;
} : never;
export const MAX_ASSET_JSON_BYTES = 256 * 1024;
const EffectSchema = z.strictObject({ schemaVersion: z.literal(1), durationMs: z.number().int().min(1).max(60_000), layers: z.array(CustomAnimationSchema).min(1).max(30) });

/** Only JSON data reaches storage; no generated HTML, remote URLs or temporary audio assets. */
function assertJson(input: unknown, depth = 0): void {
  if (depth > 24) throw new Error("Déclaration trop profonde.");
  if (input === null || typeof input === "string" || typeof input === "boolean") return;
  if (typeof input === "number" && Number.isFinite(input)) return;
  if (Array.isArray(input)) { for (const x of input) assertJson(x, depth + 1); return; }
  if (typeof input === "object" && Object.getPrototypeOf(input) === Object.prototype) {
    for (const [key, value] of Object.entries(input)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Clé interdite.");
      assertJson(value, depth + 1);
    }
    return;
  }
  throw new Error("Données JSON finies attendues.");
}
export function parseStudioAssetData<K extends StudioAssetKind>(kind: K, input: unknown): StudioAssetData[K] {
  assertJson(input);
  if (new TextEncoder().encode(JSON.stringify(input)).length > MAX_ASSET_JSON_BYTES) throw new Error("Projet trop volumineux (256 Ko maximum).");
  if (kind === "effect") {
    const effect = EffectSchema.parse(input);
    const layers = effect.layers.map(layer => {
      if (layer.toMs <= layer.fromMs || layer.toMs > effect.durationMs) throw new Error("Couche hors de la durée de l'effet.");
      const key = motionRegistryKey(layer.name, layer.version);
      const def = ARCHIVED_ANIMATIONS[key] ?? ANIMATIONS[key];
      if (!def) throw new Error(`Animation inconnue : ${layer.name}.`);
      const props = def.props.parse(layer.props) as Record<string, unknown>;
      if (Object.keys(layer.props).some(key => !(key in props))) throw new Error("Paramètre d'animation inconnu.");
      return { ...layer, props };
    });
    return { ...effect, layers: stampMotionVersions(layers) } as StudioAssetData[K];
  }
  if (kind === "editorial") {
    // Réel IA « Editorial Impact » : seule la structure déclarative est gardée (voix générées, durées mesurées et
    // cartes verrouillées sont propres à un rendu ou à l'écran d'édition).
    const parsedSb = StoryboardSchema.safeParse(input);
    if (!parsedSb.success) throw new Error(parsedSb.error.issues.map((i) => `${i.path.join(".") || "structure"} : ${i.message}`).join(" "));
    const sb = parsedSb.data;
    const source: Storyboard = { ...sb, scenes: sb.scenes.map((scene) => { const copy = { ...scene }; delete copy.locked; return copy; }) };
    delete source.assets;
    delete source.voiceDurations;
    return source as StudioAssetData[K];
  }
  const parsed = kind === "motion" ? parseMotionSpec(input) : parseStorySpec(input);
  if (!parsed.ok) throw new Error(parsed.errors.join(" "));
  // Parsers reconstruct only declarative fields; all generated voice/blob/signed URLs are intentionally dropped.
  const source = { ...parsed.spec };
  delete source.assets;
  return source as StudioAssetData[K];
}
/** Copy layers into edit.custom. Library revisions can never mutate a previously placed instance. */
export function instantiateEffect(effect: StudioEffect, atSourceMs: number, uuid: () => string = () => crypto.randomUUID()): CustomAnimation[] {
  if (!Number.isSafeInteger(atSourceMs) || atSourceMs < 0) throw new Error("Position source invalide.");
  return structuredClone(effect.layers).map(layer => ({ ...layer, id: uuid(), fromMs: layer.fromMs + atSourceMs, toMs: layer.toMs + atSourceMs }));
}
