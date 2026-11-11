import { z } from "zod";

/**
 * Storyboard Editorial Impact : données seulement (aucun texte figé dans les scènes). L'IA ou le découpage déterministe
 * produisent ces données ; le moteur (schedule.ts) décide du COMMENT (temps, animations, sons) ; render.ts dessine.
 * Aucun témoignage ni note n'est inventé : ces scènes n'existent que si l'utilisateur les fournit.
 */
const line = z.string().trim().min(1).max(40);
const bg = z.enum(["dark", "light", "brand"]);
export const TRANSITIONS = ["wipe-lr", "wipe-rl", "cut", "none"] as const;
/** `voice` : la phrase dite par Audrey sur cette scène (le texte à l'écran reste court et éditorialisé). */
const common = { id: z.string().min(1).max(40), background: bg, transitionOut: z.enum(TRANSITIONS).default("wipe-lr"), locked: z.boolean().optional(), voice: z.string().trim().max(260).optional() };

export const HookStatScene = z.strictObject({
  ...common, type: z.literal("hook-stat"), layout: z.enum(["center", "left", "full"]).default("center"),
  lead: line.optional(),
  stat: z.strictObject({ value: z.number().min(0).max(1_000_000), prefix: z.string().max(4).default(""), suffix: z.string().max(4).default(""), decimals: z.number().int().min(0).max(1).default(0) }),
  lines: z.array(line).max(3).default([]), accent: line.optional(),
});
export const StatementScene = z.strictObject({
  ...common, type: z.literal("statement"), layout: z.enum(["center", "left", "stack"]).default("left"),
  lines: z.array(line).min(1).max(5), accentWords: z.array(z.string().trim().min(1).max(30)).max(3).default([]), micro: z.string().trim().max(90).optional(),
  /** Habillage des lignes (repris des Réels filmés) : sobre, titre en profondeur 3D, ou cartouches. */
  style: z.enum(["plain", "3d", "cartouche"]).default("plain"),
});
/** Mot-impact (style Punch des Réels filmés) : un seul mot énorme qui claque plein écran, avec un flash. */
export const ImpactScene = z.strictObject({
  ...common, type: z.literal("impact"), layout: z.enum(["center", "left"]).default("center"),
  word: z.string().trim().min(1).max(24), sub: z.string().trim().max(90).optional(),
});
/** Barré puis remplacé : un mot se fait barrer puis remplacer (erreur → bon réflexe, mythe → vérité). */
export const StrikeScene = z.strictObject({
  ...common, type: z.literal("strike"), layout: z.enum(["left", "center"]).default("left"),
  lead: line.optional(), before: line, after: line, micro: z.string().trim().max(90).optional(),
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

export const SceneSchema = z.discriminatedUnion("type", [HookStatScene, StatementScene, ImpactScene, StrikeScene, PillsScene, HumanScene, TestimonialsScene, CtaScene]);
export type EditorialScene = z.infer<typeof SceneSchema>;
export type SceneType = EditorialScene["type"];

export const VoiceAsset = z.strictObject({
  src: z.string().min(1).max(2000), duration: z.number().positive().max(60), text: z.string().max(260), voiceId: z.string().max(80),
  speed: z.number().min(0.5).max(1.5), pronunciationVersion: z.string().max(40), receiptId: z.string().regex(/^[a-f0-9]{64}$/),
});
export type EditorialVoiceAsset = z.infer<typeof VoiceAsset>;

export const StoryboardSchema = z.strictObject({
  preset: z.literal("editorial-impact"),
  intensity: z.number().int().min(1).max(5).default(4),
  bpm: z.number().min(80).max(160).default(120),
  sfx: z.enum(["off", "subtle", "normal", "impact"]).default("normal"),
  /** Musique de la bibliothèque (licence vérifiée à l'ajout) ; absente = sans musique. */
  music: z.strictObject({ file: z.string().regex(/^[\w.-]+\.(mp3|wav|m4a|aac|ogg)$/i), volume: z.number().min(0).max(1).default(0.35) }).optional(),
  /** Mascotte officielle BeeRecos (case à cocher du Studio IA). */
  mascot: z.boolean().default(false),
  /** Débit d'Audrey (92 % conseillé, comme le style Motion). */
  voiceSpeed: z.number().min(0.8).max(1.25).default(0.92),
  /** Voix générées (durées réelles, en secondes) : remplacent l'estimation quand elles existent. */
  voiceDurations: z.record(z.string(), z.number().positive().max(60)).optional(),
  /** Voix d'Audrey générées pour le rendu (preuve : receiptId vérifié par le serveur). Jamais saisies à la main. */
  assets: z.strictObject({ voice: z.record(z.string(), VoiceAsset) }).optional(),
  scenes: z.array(SceneSchema).min(2).max(10),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

export const SCENE_LABEL: Record<SceneType, string> = {
  "hook-stat": "Accroche chiffrée", statement: "Affirmation", impact: "Mot-impact", strike: "Barré puis remplacé", pills: "Capsules", human: "Rupture humaine", testimonials: "Témoignages", cta: "Appel à l'action",
};
