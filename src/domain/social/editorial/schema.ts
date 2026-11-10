import { z } from "zod";

/**
 * Storyboard Editorial Impact : données seulement (aucun texte figé dans les scènes). L'IA ou le découpage déterministe
 * produisent ces données ; le moteur (schedule.ts) décide du COMMENT (temps, animations, sons) ; render.ts dessine.
 * Aucun témoignage ni note n'est inventé : ces scènes n'existent que si l'utilisateur les fournit.
 */
const line = z.string().trim().min(1).max(40);
const bg = z.enum(["dark", "light", "brand"]);
export const TRANSITIONS = ["wipe-lr", "wipe-rl", "cut", "none"] as const;
const common = { id: z.string().min(1).max(40), background: bg, transitionOut: z.enum(TRANSITIONS).default("wipe-lr"), locked: z.boolean().optional() };

export const HookStatScene = z.strictObject({
  ...common, type: z.literal("hook-stat"), layout: z.enum(["center", "left", "full"]).default("center"),
  lead: line.optional(),
  stat: z.strictObject({ value: z.number().min(0).max(1_000_000), prefix: z.string().max(4).default(""), suffix: z.string().max(4).default(""), decimals: z.number().int().min(0).max(1).default(0) }),
  lines: z.array(line).max(3).default([]), accent: line.optional(),
});
export const StatementScene = z.strictObject({
  ...common, type: z.literal("statement"), layout: z.enum(["center", "left", "stack"]).default("left"),
  lines: z.array(line).min(1).max(5), accentWords: z.array(z.string().trim().min(1).max(30)).max(3).default([]), micro: z.string().trim().max(90).optional(),
});
export const PillsScene = z.strictObject({
  ...common, type: z.literal("pills"), layout: z.enum(["center", "left", "alternate"]).default("left"),
  title: line, pills: z.array(z.string().trim().min(1).max(32)).min(2).max(6),
});
export const HumanScene = z.strictObject({
  ...common, type: z.literal("human"), layout: z.enum(["center", "left", "stack"]).default("left"),
  question: z.array(line).min(1).max(3), answer: line, micro: z.string().trim().max(90).optional(),
});
export const TestimonialsScene = z.strictObject({
  ...common, type: z.literal("testimonials"), layout: z.enum(["horizontal", "diagonal", "stack"]).default("diagonal"),
  title: line, cards: z.array(z.strictObject({ quote: z.string().trim().min(3).max(140), author: z.string().trim().min(1).max(40) })).min(1).max(5),
  rating: z.strictObject({ value: z.number().min(0).max(5), count: z.string().trim().max(30).optional() }).optional(),
});
export const CtaScene = z.strictObject({
  ...common, type: z.literal("cta"), layout: z.enum(["center", "left", "stack"]).default("left"),
  lines: z.array(line).min(1).max(4), sub: z.string().trim().max(60).optional(), button: z.string().trim().min(2).max(32), brand: z.boolean().default(true),
});

export const SceneSchema = z.discriminatedUnion("type", [HookStatScene, StatementScene, PillsScene, HumanScene, TestimonialsScene, CtaScene]);
export type EditorialScene = z.infer<typeof SceneSchema>;
export type SceneType = EditorialScene["type"];

export const StoryboardSchema = z.strictObject({
  preset: z.literal("editorial-impact"),
  intensity: z.number().int().min(1).max(5).default(4),
  bpm: z.number().min(80).max(160).default(120),
  sfx: z.enum(["off", "subtle", "normal", "impact"]).default("normal"),
  /** Musique de la bibliothèque (licence vérifiée à l'ajout) ; absente = sans musique. */
  music: z.strictObject({ file: z.string().regex(/^[\w.-]+\.(mp3|wav|m4a|aac|ogg)$/i), volume: z.number().min(0).max(1).default(0.35) }).optional(),
  scenes: z.array(SceneSchema).min(2).max(10),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

export const SCENE_LABEL: Record<SceneType, string> = {
  "hook-stat": "Accroche chiffrée", statement: "Affirmation", pills: "Capsules", human: "Rupture humaine", testimonials: "Témoignages", cta: "Appel à l'action",
};
