import { z } from "zod";
import { ANIMATIONS, ARCHIVED_ANIMATIONS, animationSource } from "./registry";
import { checkAnimation, type AnimationDef } from "./animations";
import { MANUAL_ONLY } from "./suggest";
import type { Edit } from "./edit";

/**
 * BeeMotion (MVP 1) : le design system vidéo de BeeRecos, posé AU-DESSUS du registre d'animations existant.
 * Le code d'une animation reste dans animations.ts / mes-animations/ (Git) ; BeeMotion ajoute ce qu'il faut pour la
 * retrouver et la réutiliser : catégorie, fonction de scène, intensité, statut, version. Rendu inchangé : Hyperframes.
 * Règle : chercher → réutiliser → adapter → créer. Seuls les motions « approved » se choisissent automatiquement.
 */

export const MOTION_CATEGORIES = {
  hooks: "Accroches",
  titles: "Titres",
  subtitles: "Sous-titres",
  transitions: "Transitions",
  stats: "Chiffres",
  highlights: "Mises en avant",
  cards: "Cartouches",
  overlays: "Médias",
  cta: "CTA",
  logos: "Logo",
} as const;
export type MotionCategory = keyof typeof MOTION_CATEGORIES;

export const SCENE_INTENTS = ["HOOK", "PROBLEM", "EXPLAIN", "DEMONSTRATION", "PROOF", "STAT", "QUOTE", "LIST", "EMPHASIS", "TRANSITION", "CTA", "BRAND"] as const;
export type SceneIntent = (typeof SCENE_INTENTS)[number];

export const MOTION_STATUSES = ["draft", "testing", "review", "approved", "deprecated"] as const;
export type MotionStatus = (typeof MOTION_STATUSES)[number];

export type MotionIntensity = "low" | "medium" | "high";

/** Intensité visée par fonction de scène : fort à l'accroche, à la preuve et au CTA, plus calme pour expliquer. */
export const INTENT_INTENSITY: Record<SceneIntent, MotionIntensity> = {
  HOOK: "high", PROBLEM: "medium", EXPLAIN: "medium", DEMONSTRATION: "medium", PROOF: "high", STAT: "high", QUOTE: "low",
  LIST: "medium", EMPHASIS: "medium", TRANSITION: "low", CTA: "high", BRAND: "low",
};

/** Schéma d'une fiche BeeMotion (validé par checkMotionRegistry). */
export const MotionMetaSchema = z.strictObject({
  category: z.enum(Object.keys(MOTION_CATEGORIES) as [MotionCategory, ...MotionCategory[]]),
  version: z.number().int().min(1).max(999),
  status: z.enum(MOTION_STATUSES),
  approval: z.string().trim().min(1).optional(),
  intensity: z.enum(["low", "medium", "high"]),
  intents: z.array(z.enum(SCENE_INTENTS)).min(1),
  tags: z.array(z.string().trim().min(1)).default([]),
  recommendedFor: z.string().trim().min(1),
  avoidFor: z.string().trim().min(1),
});

/** « ON GARDE » de Cédric : un motion (à une version précise) validé depuis le Studio, mémorisé dans les préférences. */
export const KeptMotionSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  version: z.number().int().min(1).max(999),
  at: z.string().max(40),
  by: z.string().max(200),
  montageId: z.string().max(80).optional(),
});
export type KeptMotion = z.infer<typeof KeptMotionSchema>;

export type MotionMeta = {
  category: MotionCategory;
  /** Version de l'implémentation courante. Une ancienne version reste rendable via ARCHIVED_ANIMATIONS["nom@v"]. */
  version: number;
  status: MotionStatus;
  /** D'où vient le statut « approved » (décision écrite de Cédric) ; absent tant que rien n'est validé. */
  approval?: string;
  intensity: MotionIntensity;
  intents: SceneIntent[];
  tags: string[];
  recommendedFor: string;
  avoidFor: string;
};

/**
 * Fiches des animations existantes (audit du 2026-10-24). « approved » seulement quand une décision de Cédric est écrite
 * dans beerecos-knowledge/decision-log.md ; le reste attend un « ON GARDE » explicite (statut review).
 */
export const MOTION_META: Record<string, MotionMeta> = {
  "papier-dechire": {category:"cards",version:1,status:"review",intensity:"medium",intents:["LIST", "EXPLAIN"],tags:["papier", "étiquette", "déchiré", "référence"],recommendedFor:"Une à quatre idées courtes, révélées successivement.",avoidFor:"Texte long ou superposition sur le visage et les sous-titres."},
  "bandeau-double": {category:"cards",version:1,status:"review",intensity:"medium",intents:["EXPLAIN", "EMPHASIS"],tags:["bandeau", "ruban", "incliné", "référence"],recommendedFor:"Deux lignes complémentaires, avec un mot qui change si nécessaire.",avoidFor:"Texte long ou superposition sur le visage et les sous-titres."},
  "piliers-progressifs": {category:"cards",version:1,status:"review",intensity:"medium",intents:["LIST", "EXPLAIN"],tags:["piliers", "lettres", "progressif", "référence"],recommendedFor:"Construire deux à quatre piliers de bas en haut.",avoidFor:"Texte long ou superposition sur le visage et les sous-titres."},
  "mot-impact": {category:"highlights",version:1,status:"review",intensity:"medium",intents:["EMPHASIS", "EXPLAIN"],tags:["mot", "impact", "question", "référence"],recommendedFor:"Une question ou une expression courte au premier plan.",avoidFor:"Texte long ou superposition sur le visage et les sous-titres."},
  "cube-3d": {category:"highlights",version:1,status:"review",intensity:"high",intents:["LIST", "EMPHASIS", "HOOK"],tags:["3d", "cube", "perspective", "mots"],recommendedFor:"Deux à quatre mots courts qui s'enchaînent sur les faces d'un cube.",avoidFor:"Mots longs, phrases, ou superposition sur le visage et les sous-titres."},
  "carte-retournee": {category:"cards",version:1,status:"review",intensity:"high",intents:["PROBLEM", "EXPLAIN", "EMPHASIS"],tags:["3d", "carte", "recto-verso", "révélation"],recommendedFor:"Une question puis sa réponse, un avant/après.",avoidFor:"Texte long ou superposition sur le visage et les sous-titres."},
  "titre-profondeur": {category:"titles",version:1,status:"review",intensity:"high",intents:["HOOK", "EMPHASIS"],tags:["3d", "titre", "perspective", "relief"],recommendedFor:"Une accroche courte au début du Reel.",avoidFor:"Plus d'une fois par Reel, ou sur le visage."},
  "cascade-3d": {category:"cards",version:1,status:"review",intensity:"medium",intents:["LIST", "EXPLAIN"],tags:["3d", "liste", "palettes", "cascade"],recommendedFor:"Deux à cinq étapes ou arguments courts.",avoidFor:"Texte long ou superposition sur le visage et les sous-titres."},
  "titre-derriere": {
    category: "titles", version: 1, status: "approved", approval: "decision-log 2026-10-22 (lot S5, « Réponse A »)",
    intensity: "high", intents: ["HOOK", "EMPHASIS"], tags: ["titre", "détourage", "sujet", "accroche"],
    recommendedFor: "Titre d'une nouvelle idée, 1 à 4 mots, sur un plan face caméra détouré.",
    avoidFor: "Prise sans détourage, texte long, scènes rapprochées (pas deux fois de suite).",
  },
  titre: {
    category: "titles", version: 1, status: "review",
    intensity: "medium", intents: ["HOOK", "EXPLAIN", "TRANSITION"], tags: ["titre", "accroche", "changement d'idée"],
    recommendedFor: "Accroche ou changement d'idée quand la prise n'est pas détourée.",
    avoidFor: "Doubler les sous-titres mot pour mot.",
  },
  "mot-cle": {
    category: "cta", version: 1, status: "approved", approval: "decision-log 2026-10-23 (lot S7, un mot-clé par Reel)",
    intensity: "high", intents: ["CTA"], tags: ["commentaire", "mot-clé", "dm", "fin"],
    recommendedFor: "Fin de vidéo : « commente MOT » avec le mot-clé créé dans le moteur de DM.",
    avoidFor: "Milieu de vidéo ; mot-clé non créé dans le moteur de DM.",
  },
  chiffre: {
    category: "stats", version: 1, status: "approved", approval: "Cédric, 2026-11-02 : animation validée",
    intensity: "high", intents: ["PROOF", "STAT"], tags: ["chiffre", "preuve", "compteur"],
    recommendedFor: "Chiffre réellement dit dans la vidéo et vérifié.",
    avoidFor: "Tout chiffre absent de la prise ou du brief (jamais inventé).",
  },
  liste: {
    category: "cards", version: 1, status: "approved", approval: "Cédric, 2026-11-02 : animation validée",
    intensity: "medium", intents: ["LIST", "EXPLAIN", "DEMONSTRATION"], tags: ["liste", "étapes", "bénéfices"],
    recommendedFor: "Résumer 2 à 4 étapes ou bénéfices énoncés.",
    avoidFor: "Plus de 4 points, phrases longues.",
  },
  barre: {
    category: "highlights", version: 1, status: "review",
    intensity: "medium", intents: ["PROBLEM", "EMPHASIS"], tags: ["contraste", "idée reçue", "mythe"],
    recommendedFor: "Contraste « idée reçue → bonne réponse ».",
    avoidFor: "Plus d'une fois par vidéo.",
  },
  onglet: {
    category: "cards", version: 1, status: "approved", approval: "decision-log 2026-10-21 (animation « onglet »)",
    intensity: "low", intents: ["EXPLAIN", "DEMONSTRATION", "LIST", "EMPHASIS"], tags: ["cartouche", "étape", "précision"],
    recommendedFor: "Un mot-clé, une étape ou une précision, à distance du visage et des sous-titres.",
    avoidFor: "Plusieurs idées dans un même onglet.",
  },
  image: {
    category: "overlays", version: 1, status: "review",
    intensity: "low", intents: ["PROOF", "EXPLAIN"], tags: ["image", "média", "bibliothèque"],
    recommendedFor: "Montrer ce dont parle la voix (lieu, produit, capture) avec une image sous licence.",
    avoidFor: "Image sans licence connue ; photo de membre non autorisée.",
  },
  "logo-fin": {
    category: "logos", version: 1, status: "approved", approval: "decision-log 2026-10-22 (logo de fin officiel avec baseline)",
    intensity: "low", intents: ["BRAND"], tags: ["logo", "baseline", "fin"],
    recommendedFor: "Dernières secondes de la vidéo.",
    avoidFor: "Ailleurs qu'en clôture ; logo jamais animé autrement qu'en opacité.",
  },
};

export type Motion = MotionMeta & {
  id: string;
  /** Référence versionnée, ex. « titre-derriere@1 ». */
  ref: string;
  name: string;
  description: string;
  durationMs: number;
  source: "kit" | "mes-animations";
  /** Exige le détourage de la prise. */
  behind: boolean;
  /** Se pose depuis un autre panneau (ex. image depuis Médias). */
  manualOnly: boolean;
};

export const motionRef = (id: string, version: number) => `${id}@${version}`;

/** « titre@2 » → { id, version } ; null si la référence n'est pas au bon format (aucune donnée externe n'est évaluée). */
export function parseMotionRef(ref: string): { id: string; version: number } | null {
  const m = /^([a-z0-9-]{1,40})@([1-9][0-9]{0,2})$/.exec(ref);
  return m ? { id: m[1], version: Number(m[2]) } : null;
}

export const currentMotionVersion = (id: string) => MOTION_META[id]?.version ?? 1;

/**
 * Clé de registre à rendre pour une animation posée dans un montage : sans version (montages antérieurs) ou à la
 * version courante → l'implémentation courante ; ancienne version → l'implémentation archivée « nom@v ». Une version
 * qui n'existe plus donne une clé inconnue, donc le bandeau d'erreur à l'aperçu, jamais une autre version en silence.
 */
export function motionRegistryKey(name: string, version?: number): string {
  return version === undefined || version === currentMotionVersion(name) ? name : motionRef(name, version);
}

/** Registre de rendu : implémentations courantes + versions archivées. */
export const renderRegistry = (registry: Record<string, AnimationDef> = ANIMATIONS): Record<string, AnimationDef> => ({ ...registry, ...ARCHIVED_ANIMATIONS });

/** Fige la version courante sur chaque animation qui n'en a pas encore (à l'enregistrement, côté serveur). */
export function stampMotionVersions<T extends { name: string; version?: number }>(custom: T[]): T[] {
  return custom.map((c) => (c.version === undefined ? { ...c, version: currentMotionVersion(c.name) } : c));
}

/** Un « ON GARDE » sur la version courante rend le motion « approved » (sauf s'il est retiré). */
function withKept(id: string, meta: MotionMeta, kept: KeptMotion[]): MotionMeta {
  const k = kept.find((x) => x.id === id && x.version === meta.version);
  if (!k || meta.status === "approved" || meta.status === "deprecated") return meta;
  return { ...meta, status: "approved", approval: `On garde — ${k.at.slice(0, 10)} (${k.by})` };
}

export function listMotions(registry: Record<string, AnimationDef> = ANIMATIONS, kept: KeptMotion[] = []): Motion[] {
  return Object.entries(MOTION_META)
    .filter(([id]) => Object.prototype.hasOwnProperty.call(registry, id))
    .map(([id, raw]) => {
      const meta = withKept(id, raw, kept);
      const def = registry[id];
      return {
        ...meta, id, ref: motionRef(id, meta.version), name: def.label, description: def.description, durationMs: def.lengthMs,
        source: animationSource(id), behind: Boolean(def.behind), manualOnly: MANUAL_ONLY.has(id),
      };
    });
}

/**
 * Enregistre un « ON GARDE » : seulement un motion existant, non retiré, à sa version courante, et sur demande explicite
 * (`confirm === "ON GARDE"` : une réaction positive ambiguë ne change rien). Idempotent.
 */
export function keepMotion(kept: KeptMotion[], req: { id: string; confirm: unknown; montageId?: string }, by: string, at: string): { kept: KeptMotion[]; error?: string } {
  if (req.confirm !== "ON GARDE") return { kept, error: "Confirmation « ON GARDE » explicite requise." };
  const meta = Object.prototype.hasOwnProperty.call(MOTION_META, req.id) ? MOTION_META[req.id] : undefined;
  if (!meta) return { kept, error: `Motion « ${req.id} » inconnu de BeeMotion.` };
  if (meta.status === "deprecated") return { kept, error: `Motion « ${req.id} » retiré : il ne peut pas être gardé.` };
  if (kept.some((k) => k.id === req.id && k.version === meta.version)) return { kept };
  const entry = KeptMotionSchema.parse({ id: req.id, version: meta.version, at, by, ...(req.montageId ? { montageId: req.montageId } : {}) });
  return { kept: [...kept, entry] };
}

/** Nombre d'utilisations de chaque motion dans les montages enregistrés (compte réel, jamais estimé). */
export function motionUsage(edits: Pick<Edit, "custom">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of edits) for (const c of e.custom ?? []) out[c.name] = (out[c.name] ?? 0) + 1;
  return out;
}

export type MotionQuery = {
  text?: string;
  category?: MotionCategory;
  intent?: SceneIntent;
  /** Durée disponible dans la scène, en ms. */
  maxDurationMs?: number;
  /** Vrai par défaut : une sélection automatique ne prend que des motions approuvés. Faux pour la galerie. */
  approvedOnly?: boolean;
  /** « ON GARDE » enregistrés (préférences du Studio). */
  kept?: KeptMotion[];
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Recherche déterministe : filtres stricts, puis tri par adéquation à la fonction de scène, puis par nom. */
export function searchMotions(q: MotionQuery = {}, registry: Record<string, AnimationDef> = ANIMATIONS): Motion[] {
  const approvedOnly = q.approvedOnly ?? true;
  const words = fold(q.text ?? "").split(/\s+/).filter(Boolean);
  return listMotions(registry, q.kept ?? [])
    .filter((m) => m.status !== "deprecated")
    .filter((m) => !approvedOnly || m.status === "approved")
    .filter((m) => !q.category || m.category === q.category)
    .filter((m) => !q.intent || m.intents.includes(q.intent))
    .filter((m) => q.maxDurationMs === undefined || m.durationMs <= q.maxDurationMs)
    .filter((m) => {
      const hay = fold([m.id, m.name, m.description, m.recommendedFor, ...m.tags].join(" "));
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => (q.intent ? a.intents.indexOf(q.intent) - b.intents.indexOf(q.intent) : 0) || a.name.localeCompare(b.name, "fr"));
}

/** Contrôle du registre BeeMotion : chaque animation a sa fiche et inversement, valeurs valides, versions archivées cohérentes. */
export function checkMotionRegistry(registry: Record<string, AnimationDef> = ANIMATIONS, archived: Record<string, AnimationDef> = ARCHIVED_ANIMATIONS): string[] {
  const errors: string[] = [];
  for (const id of Object.keys(registry)) if (!MOTION_META[id]) errors.push(`« ${id} » : fiche BeeMotion manquante (ajouter une entrée draft dans MOTION_META)`);
  for (const [id, m] of Object.entries(MOTION_META)) {
    if (!Object.prototype.hasOwnProperty.call(registry, id)) errors.push(`« ${id} » : fiche sans animation`);
    const parsed = MotionMetaSchema.safeParse(m);
    if (!parsed.success) errors.push(`« ${id} » : fiche invalide (${parsed.error.issues.map((i) => i.path.join(".") || "fiche").join(", ")})`);
    if (!(m.category in MOTION_CATEGORIES)) errors.push(`« ${id} » : catégorie « ${m.category} » inconnue`);
    if (!MOTION_STATUSES.includes(m.status)) errors.push(`« ${id} » : statut « ${m.status} » inconnu`);
    if (!Number.isInteger(m.version) || m.version < 1 || m.version > 999) errors.push(`« ${id} » : version entière de 1 à 999`);
    if (!m.intents.length || m.intents.some((i) => !SCENE_INTENTS.includes(i))) errors.push(`« ${id} » : fonctions de scène invalides`);
    if (!["low", "medium", "high"].includes(m.intensity)) errors.push(`« ${id} » : intensité invalide`);
    if (m.status === "approved" && !m.approval?.trim()) errors.push(`« ${id} » : « approved » sans source de validation`);
    if (!m.recommendedFor.trim() || !m.avoidFor.trim()) errors.push(`« ${id} » : recommandé / à éviter manquants`);
  }
  for (const [key, def] of Object.entries(archived)) {
    const ref = parseMotionRef(key);
    if (!ref) { errors.push(`version archivée « ${key} » : format nom@version attendu`); continue; }
    if (ref.version >= currentMotionVersion(ref.id)) errors.push(`version archivée « ${key} » : doit être antérieure à la version courante`);
    for (const e of checkAnimation(ref.id, def)) errors.push(`version archivée « ${key} » : ${e}`);
  }
  return errors;
}
