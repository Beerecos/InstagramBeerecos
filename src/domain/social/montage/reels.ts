import { STANDARD_V1 } from "./standard";
import { z } from "zod";
import type { CaptionWord, Range } from "./edit";
import type { CustomAnimation } from "./suggest";
import { checkTimeline, MIN_GAP_MS } from "./suggest";
import { charteIssues } from "./charte";

/**
 * LES 72 REELS (lot S7) : structure éditoriale fournie par Cédric (BeeRecos_72_Reels_Structure.json, schéma 1.0.0)
 * importée dans le Studio de montage. Couche PURE partagée par la page Montage et la fonction serveur `montage`.
 *
 * Règles du fichier, appliquées ici :
 * - le script (`script.text`) est la source de vérité ; les paroles des scènes, jointes par « \n\n », le reproduisent
 *   EXACTEMENT, et toute modification d'une scène reconstruit le script ;
 * - quatre textes distincts : à lire (prompteur), à l'écran (overlay), sous-titres (audio final), légende du post ;
 * - `null` veut dire « à produire / non mesuré », jamais zéro ;
 * - temps en ms, fins exclusives ; `planned_*` est une proposition, `actual_*` reste null tant que rien n'est mesuré.
 */

export const REELS_SCHEMA_VERSION = "1.0.0";
export const EXPECTED_REELS = 72;
export const EXPECTED_SCENES = 384;

export const SCENE_ROLES = ["hook", "context", "example", "method", "takeaway", "cta"] as const;
export const ROLE_LABEL: Record<(typeof SCENE_ROLES)[number], string> = {
  hook: "Accroche", context: "Contexte", example: "Exemple", method: "Méthode", takeaway: "À retenir", cta: "Appel à l'action",
};
export const OVERLAY_MODES = ["behind_subject", "tab", "none"] as const;
export type OverlayMode = (typeof OVERLAY_MODES)[number];
export const OVERLAY_MODE_LABEL: Record<OverlayMode, string> = { behind_subject: "Derrière le sujet", tab: "Onglet (cartouche)", none: "Aucun" };

export const PILLAR_LABEL: Record<string, string> = {
  reseau: "Réseau d'apporteurs d'affaires", formation: "École de formation", digitalisation_ia: "Digitalisation IA",
};
/** Séries du fichier de configuration (BeeRecos_Configuration_Reels.json). */
export const SERIES: { id: string; label: string }[] = [
  { id: "S01", label: "Rencontres et développement du réseau" }, { id: "S02", label: "Recommandations et mises en relation" },
  { id: "S03", label: "Prospection et création de contenu" }, { id: "S04", label: "Rendez-vous commerciaux et objections" },
  { id: "S05", label: "Relation client et fidélisation" }, { id: "S06", label: "Le quotidien du dirigeant" },
  { id: "S07", label: "Communication et compréhension de l'autre" }, { id: "S08", label: "Organisation et formation" },
  { id: "S09", label: "Digitalisation et intelligence artificielle" }, { id: "S10", label: "Découvrir la vie de BeeRecos" },
  { id: "S11", label: "Visite adhésion et premiers pas" }, { id: "S12", label: "Animation et développement des clubs" },
];

/** Lisibilité d'un texte à l'écran (configuration : 2 à 6 mots conseillés, 8 au plus, 2 lignes au plus). */
export const OVERLAY_MAX_WORDS = 8;
/** Longueur maximale d'un texte à l'écran : celle de l'onglet et du titre derrière le sujet. */
export const OVERLAY_MAX_CHARS = 48;
/** Carte de fin : logo + #MonReseauCestTonReseau, 2 s. */
export const CLOSING_CARD_MS = 2000;
/** Durée d'affichage d'un texte de scène. */
export const OVERLAY_MS = 2500;

const nullableMs = z.number().int().min(0).nullable();
const SceneSchema = z.looseObject({
  scene_id: z.string().regex(/^V\d{2}_S\d{2}$/, "identifiant de scène attendu VNN_SNN"),
  role: z.enum(SCENE_ROLES),
  paragraph_indices: z.array(z.number().int().min(0)).min(1),
  spoken_text: z.string().min(1),
  visual_direction: z.string().nullable().optional(),
  overlay: z.looseObject({
    text: z.string().nullable(),
    preferred_mode: z.enum(OVERLAY_MODES),
    resolved_mode: z.enum(OVERLAY_MODES).nullable().optional(),
    fallback_mode: z.enum(OVERLAY_MODES).nullable().optional(),
    person_mask_asset_ref: z.string().nullable().optional(),
  }),
  source_clip: z.looseObject({ asset_ref: z.string().nullable(), in_ms: nullableMs, out_ms: nullableMs }).optional(),
  timing: z.looseObject({ planned_start_ms: nullableMs, planned_end_ms: nullableMs, actual_start_ms: nullableMs, actual_end_ms: nullableMs, status: z.string().optional() }),
});
export const ReelSchema = z.looseObject({
  reel_id: z.string().regex(/^V\d{2}$/, "identifiant de Reel attendu VNN"),
  revision: z.number().int().min(1),
  title: z.string().min(1).max(200),
  series_ref: z.string().nullable().optional(),
  primary_pillar: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  production_mode: z.enum(["studio", "ai", "hybrid"]),
  editorial_status: z.enum(["draft", "needs_review", "approved"]),
  script: z.looseObject({ text: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(), word_count: z.number().int().nullable().optional() }),
  scenes: z.array(SceneSchema).min(1).max(12),
  closing_card: z.looseObject({ planned_start_ms: nullableMs, planned_end_ms: nullableMs }).optional(),
  cta: z.looseObject({
    display_keyword: z.string().regex(/^[A-ZÀ-Ý0-9]{2,20}$/, "mot-clé en majuscules, sans espace"),
    normalized_keyword: z.string(),
    spoken_text: z.string().nullable().optional(),
    goal: z.string().nullable().optional(),
  }),
  social_caption: z.looseObject({ text: z.string().nullable(), status: z.string().optional() }).optional(),
  approval: z.looseObject({ approved_by: z.string().nullable(), approved_at: z.string().nullable(), approved_revision: z.number().int().nullable() }).optional(),
});
export type ReelScene = z.infer<typeof SceneSchema>;
export type Reel = z.infer<typeof ReelSchema>;

/** Mot-clé comparé sans accent ni casse (règle de correspondance du fichier de configuration). */
export const normalizeKeyword = (k: string) => k.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Le mot-clé figure en capitales, comme mot entier (« Commente RÉSEAU » ; « réseau » dans une phrase ne compte pas). */
export const hasKeyword = (text: string, keyword: string) =>
  text.split(/[^\p{L}\p{N}]+/u).some((t) => t.length > 1 && t === t.toUpperCase() && normalizeKeyword(t) === normalizeKeyword(keyword));

export const scriptFromScenes = (scenes: Pick<ReelScene, "spoken_text">[]) => scenes.map((s) => s.spoken_text).join("\n\n");
const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Empreinte du contenu éditorial d'un Reel (script, textes à l'écran, consignes visuelles, CTA) : détecte un changement de la source. */
export function editorialContent(r: Reel): string {
  return JSON.stringify({
    title: r.title, script: r.script.text, cta: [r.cta.display_keyword, r.cta.spoken_text ?? null],
    scenes: r.scenes.map((s) => [s.scene_id, s.role, s.spoken_text, s.overlay.text, s.overlay.preferred_mode, s.visual_direction ?? null]),
  });
}
export const editorialHash = (r: Reel) => sha256Hex(editorialContent(r));

/** Erreurs de lisibilité d'un texte à l'écran (vide = conforme). */
export function overlayIssues(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  const words = wordCount(text);
  if (words > OVERLAY_MAX_WORDS) out.push(`${words} mots (8 au plus)`);
  if (text.length > OVERLAY_MAX_CHARS) out.push(`${text.length} signes (48 au plus)`);
  out.push(...charteIssues(text));
  return out;
}

export type StructureReport = { ok: boolean; reels: Reel[]; errors: string[]; warnings: string[] };

/**
 * Contrôle d'un fichier de structure : version du schéma, nombre de Reels et de scènes, identifiants uniques,
 * références texte ↔ scènes, script reconstruit à l'identique, empreinte du script, mot-clé cohérent et prononcé.
 * `expected` permet d'importer une partie du catalogue (contrôle des 72 / 384 désactivé).
 */
export async function checkStructure(input: unknown, opts: { partial?: boolean } = {}): Promise<StructureReport> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const root = z.looseObject({ schema_version: z.string(), reels: z.array(z.unknown()) }).safeParse(input);
  if (!root.success) return { ok: false, reels: [], errors: ["Fichier illisible : « schema_version » et « reels » sont attendus (BeeRecos_72_Reels_Structure.json)."], warnings };
  if (root.data.schema_version !== REELS_SCHEMA_VERSION) errors.push(`Version du schéma ${root.data.schema_version} : seule la ${REELS_SCHEMA_VERSION} est prise en charge.`);
  const reels: Reel[] = [];
  root.data.reels.forEach((raw, i) => {
    const p = ReelSchema.safeParse(raw);
    if (!p.success) {
      const id = (raw as { reel_id?: unknown })?.reel_id;
      const issue = p.error.issues[0];
      errors.push(`Reel ${typeof id === "string" ? id : `n° ${i + 1}`} : ${issue.path.join(".")} → ${issue.message}`);
    } else reels.push(p.data);
  });
  const ids = reels.map((r) => r.reel_id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) errors.push(`Reels en double : ${[...new Set(dup)].join(", ")}.`);
  const sceneIds = reels.flatMap((r) => r.scenes.map((s) => s.scene_id));
  const dupS = sceneIds.filter((id, i) => sceneIds.indexOf(id) !== i);
  if (dupS.length) errors.push(`Scènes en double : ${[...new Set(dupS)].slice(0, 5).join(", ")}.`);
  if (!opts.partial) {
    if (reels.length !== EXPECTED_REELS) errors.push(`${reels.length} Reels lisibles : ${EXPECTED_REELS} attendus.`);
    const expectedIds = Array.from({ length: EXPECTED_REELS }, (_, i) => `V${String(i + 1).padStart(2, "0")}`);
    const missing = expectedIds.filter((id) => !ids.includes(id));
    if (missing.length && reels.length) errors.push(`Reels manquants : ${missing.join(", ")}.`);
    if (sceneIds.length !== EXPECTED_SCENES) errors.push(`${sceneIds.length} scènes : ${EXPECTED_SCENES} attendues.`);
  }
  for (const r of reels) {
    const where = `${r.reel_id}`;
    const paragraphs = r.script.text.split("\n\n");
    if (scriptFromScenes(r.scenes) !== r.script.text) errors.push(`${where} : les paroles des scènes ne reproduisent pas exactement le script.`);
    const indices = r.scenes.flatMap((s) => s.paragraph_indices);
    if (indices.some((n, i) => n !== i) || indices.length !== paragraphs.length) errors.push(`${where} : paragraph_indices incohérents avec les paragraphes du script.`);
    r.scenes.forEach((s) => {
      if (!s.scene_id.startsWith(`${r.reel_id}_`)) errors.push(`${where} : la scène ${s.scene_id} n'appartient pas à ce Reel.`);
      const joined = s.paragraph_indices.map((n) => paragraphs[n]).join("\n\n");
      if (joined !== s.spoken_text) errors.push(`${s.scene_id} : le texte ne correspond pas aux paragraphes ${s.paragraph_indices.join(", ")}.`);
      const issues = overlayIssues(s.overlay.text);
      if (issues.length) warnings.push(`${s.scene_id} : texte à l'écran « ${s.overlay.text} » — ${issues.join(" ; ")}.`);
    });
    if (r.script.sha256 && (await sha256Hex(r.script.text)) !== r.script.sha256) errors.push(`${where} : l'empreinte du script (sha256) ne correspond pas au texte.`);
    if (normalizeKeyword(r.cta.display_keyword) !== normalizeKeyword(r.cta.normalized_keyword)) errors.push(`${where} : mot-clé affiché et mot-clé normalisé différents.`);
    const last = r.scenes[r.scenes.length - 1];
    if (!normalizeKeyword(last.spoken_text).includes(normalizeKeyword(r.cta.display_keyword))) warnings.push(`${where} : le mot-clé ${r.cta.display_keyword} n'est pas prononcé dans la dernière scène.`);
  }
  return { ok: errors.length === 0, reels, errors, warnings };
}

/** Ligne de la table `reel_library` telle que l'import la compare. */
export type LibraryKey = { reel_id: string; source_hash: string; source_revision: number; edited: boolean };
export type ImportPlan = { insert: Reel[]; update: Reel[]; unchanged: string[]; protected: { reelId: string; why: string }[] };

/**
 * Import idempotent (par espace + reel_id) : nouveau → ajouté ; identique → rien ; changé à la source et jamais
 * retouché dans le Studio → mis à jour ; changé à la source ET retouché dans le Studio → protégé (jamais écrasé).
 */
export function planImport(incoming: { reel: Reel; hash: string }[], existing: LibraryKey[]): ImportPlan {
  const plan: ImportPlan = { insert: [], update: [], unchanged: [], protected: [] };
  const byId = new Map(existing.map((e) => [e.reel_id, e]));
  for (const { reel, hash } of incoming) {
    const row = byId.get(reel.reel_id);
    if (!row) plan.insert.push(reel);
    else if (row.source_hash === hash) plan.unchanged.push(reel.reel_id);
    else if (row.edited) plan.protected.push({ reelId: reel.reel_id, why: `modifié dans le Studio : la version du fichier (révision ${reel.revision}) n'écrase pas vos changements` });
    else if (reel.revision < row.source_revision) plan.protected.push({ reelId: reel.reel_id, why: `révision ${reel.revision} plus ancienne que celle déjà importée (${row.source_revision})` });
    else plan.update.push(reel);
  }
  return plan;
}

export const ScenePatchSchema = z.strictObject({
  spokenText: z.string().trim().min(1, "le texte à lire ne peut pas être vide").max(1200).optional(),
  overlayText: z.string().trim().max(OVERLAY_MAX_CHARS, `48 signes au plus`).nullable().optional(),
  preferredMode: z.enum(OVERLAY_MODES).optional(),
  visualDirection: z.string().trim().max(500).nullable().optional(),
});
export type ScenePatch = z.infer<typeof ScenePatchSchema>;

/**
 * Modifie une scène et garde le Reel cohérent : le script est reconstruit depuis les scènes (paragraphes recomptés),
 * l'empreinte et le nombre de mots recalculés, la révision augmentée, la validation éditoriale retirée.
 * Un texte à lire ne contient jamais de ligne vide (elle créerait un paragraphe hors scène).
 */
export async function patchScene(reel: Reel, sceneId: string, patch: ScenePatch): Promise<{ ok: true; reel: Reel } | { ok: false; error: string }> {
  const i = reel.scenes.findIndex((s) => s.scene_id === sceneId);
  if (i < 0) return { ok: false, error: "Scène introuvable." };
  const spoken = patch.spokenText?.replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n");
  if (patch.overlayText) {
    const issues = overlayIssues(patch.overlayText);
    if (issues.length) return { ok: false, error: `Texte à l'écran : ${issues.join(" ; ")}.` };
  }
  const scenes = reel.scenes.map((s, j) => (j !== i ? s : {
    ...s,
    spoken_text: spoken ?? s.spoken_text,
    visual_direction: patch.visualDirection === undefined ? s.visual_direction : patch.visualDirection,
    overlay: {
      ...s.overlay,
      text: patch.overlayText === undefined ? s.overlay.text : patch.overlayText || null,
      preferred_mode: patch.preferredMode ?? s.overlay.preferred_mode,
      resolved_mode: null,
    },
  }));
  // Une scène à plusieurs paragraphes les garde tant que son texte ne change pas ; un texte modifié = un paragraphe.
  let n = 0;
  const reindexed = scenes.map((s, j) => {
    const count = j === i && spoken !== undefined ? 1 : s.paragraph_indices.length;
    return { ...s, paragraph_indices: Array.from({ length: count }, () => n++) };
  });
  const text = scriptFromScenes(reindexed);
  const next: Reel = {
    ...reel,
    revision: reel.revision + 1,
    editorial_status: "needs_review",
    scenes: reindexed,
    script: { ...reel.script, text, sha256: await sha256Hex(text), word_count: wordCount(text) },
    approval: { approved_by: null, approved_at: null, approved_revision: null },
  };
  return { ok: true, reel: next };
}

/** Prompteur : le script, scène par scène (sauts de ligne conservés). */
export const prompteurBlocks = (reel: Reel) => reel.scenes.map((s) => ({ sceneId: s.scene_id, role: s.role, label: ROLE_LABEL[s.role], text: s.spoken_text }));

const tokens = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);

/**
 * Recale chaque scène sur la voix réelle : début de la scène = premier mot du transcript qui ouvre ses paroles.
 * Recherche séquentielle (une scène commence après la précédente), tolérante aux petits écarts de transcription
 * (au moins 2 des 4 premiers mots retrouvés dans l'ordre). Une scène non retrouvée vaut null (rien n'est inventé).
 */
export function alignScenes(reel: Reel, words: CaptionWord[]): { sceneId: string; startMs: number | null; wordIndex: number | null }[] {
  const flat: { tok: string; w: number }[] = [];
  words.forEach((w, i) => tokens(w.text).forEach((tok) => flat.push({ tok, w: i })));
  let cursor = 0;
  return reel.scenes.map((s) => {
    const head = tokens(s.spoken_text).slice(0, 4);
    let best: { at: number; score: number } | null = null;
    const limit = Math.min(flat.length, cursor + 400);
    for (let k = cursor; k < limit; k++) {
      if (flat[k].tok !== head[0] && flat[k].tok !== head[1]) continue;
      let score = 0, p = k;
      for (const h of head) {
        const found = flat.slice(p, p + 3).findIndex((f) => f.tok === h);
        if (found >= 0) { score++; p += found + 1; }
      }
      if (score >= Math.min(2, head.length) && (!best || score > best.score)) best = { at: flat[k].tok === head[0] ? k : Math.max(cursor, k - 1), score };
      if (best && best.score === head.length) break;
    }
    if (!best) return { sceneId: s.scene_id, startMs: null, wordIndex: null };
    cursor = best.at + 1;
    const wi = flat[best.at].w;
    return { sceneId: s.scene_id, startMs: words[wi].startMs, wordIndex: wi };
  });
}

export type SeedResult = { custom: CustomAnimation[]; resolved: Record<string, OverlayMode | null>; warnings: string[] };

/**
 * Pose les animations d'un Reel sur sa prise transcrite : texte de chaque scène au début de la scène (derrière le
 * sujet si la prise est détourée à cet instant, sinon en onglet — mode retenu noté dans `resolved`), pastille du
 * mot-clé du Reel sur le mot prononcé, carte de fin BeeRecos de 2 s sur la fin. Une seule animation à l'écran à la
 * fois (1 s d'écart) : ce qui ne tient pas est signalé, jamais forcé. Temps en ms de la prise.
 */
export function seedAnimations(reel: Reel, words: CaptionWord[], ranges: Range[], opts: { matteAt?: (ms: number) => string | null } = {}): SeedResult {
  const warnings: string[] = [];
  const resolved: Record<string, OverlayMode | null> = {};
  const kept = words.filter((w) => ranges.some((r) => (w.startMs + w.endMs) / 2 >= r.fromMs && (w.startMs + w.endMs) / 2 < r.toMs));
  const end = ranges.length ? ranges[ranges.length - 1].toMs : 0;
  const closingFrom = Math.max(0, end - CLOSING_CARD_MS);
  const align = alignScenes(reel, kept);
  const placed: CustomAnimation[] = [];
  const tryPlace = (a: CustomAnimation, why: string) => {
    if (a.toMs - a.fromMs < 800) { warnings.push(`${why} : pas assez de place avant l'animation suivante.`); return false; }
    if (checkTimeline([...placed, a]).length) { warnings.push(`${why} : chevaucherait une autre animation.`); return false; }
    placed.push(a);
    return true;
  };
  const keyword = reel.cta.display_keyword;
  reel.scenes.forEach((s, i) => {
    const at = align[i];
    const isCta = s.role === "cta";
    if (at.startMs == null) { resolved[s.scene_id] = null; warnings.push(`${s.scene_id} : début de scène introuvable dans le transcript (texte lu différent ?) — rien n'est posé.`); return; }
    const nextStart = align.slice(i + 1).find((x) => x.startMs != null)?.startMs ?? closingFrom;
    const limit = Math.min(nextStart, closingFrom) - MIN_GAP_MS;
    if (isCta) {
      // Pastille du mot-clé, calée sur le mot prononcé (ou le début de la scène).
      const kw = normalizeKeyword(keyword);
      const spoken = kept.find((w) => w.startMs >= at.startMs! && tokens(w.text).includes(kw));
      const from = spoken?.startMs ?? at.startMs;
      if (!spoken) warnings.push(`${s.scene_id} : le mot-clé ${keyword} n'est pas retrouvé dans le transcript — pastille posée au début de la scène.`);
      resolved[s.scene_id] = "tab";
      tryPlace({ name: "mot-cle", fromMs: from, toMs: Math.min(from + 3000, closingFrom - MIN_GAP_MS), props: { mot: keyword }, label: `${s.scene_id} · mot-clé` }, `${s.scene_id} (mot-clé)`);
      return;
    }
    const text = s.overlay.text?.trim();
    if (!text || s.overlay.preferred_mode === "none") { resolved[s.scene_id] = "none"; return; }
    const behind = s.overlay.preferred_mode === "behind_subject" && Boolean(opts.matteAt?.(at.startMs));
    if (s.overlay.preferred_mode === "behind_subject" && !behind) warnings.push(`${s.scene_id} : pas de détourage de la prise — « ${text} » passe en onglet.`);
    const mode: OverlayMode = behind ? "behind_subject" : "tab";
    const anim: CustomAnimation = behind
      // Standard v1 : accroche en blanc derrière la tête (rebond), « à retenir » en bleu derrière les épaules (verticale).
      ? { name: "titre-derriere", fromMs: at.startMs, toMs: Math.min(at.startMs + OVERLAY_MS, limit), props: { texte: text, ...(s.role === "takeaway" ? STANDARD_V1.takeaway : STANDARD_V1.hook) }, label: s.scene_id }
      : { name: "onglet", fromMs: at.startMs, toMs: Math.min(at.startMs + OVERLAY_MS, limit), props: { texte: text, variante: s.role === "hook" ? "bleu" : "blanc" }, label: s.scene_id };
    resolved[s.scene_id] = tryPlace(anim, `${s.scene_id} (« ${text} »)`) ? mode : null;
  });
  const lastWord = kept[kept.length - 1];
  if (end > 0) {
    if (lastWord && lastWord.endMs > closingFrom) warnings.push(`La carte de fin (2 s) couvre la fin de la parole : gardez 2 s de prise après le dernier mot.`);
    tryPlace({ name: "logo-fin", fromMs: closingFrom, toMs: end, props: { baseline: true }, label: "carte de fin" }, "Carte de fin");
  }
  return { custom: placed, resolved, warnings };
}

/** Ce qui manque à un Reel pour avancer (liste de la colonne de gauche). */
export function reelTodo(reel: Reel, linked: { hasTake: boolean; transcribed: boolean; seededRevision: number | null; previewApproved: boolean; finalReady: boolean } | null): string[] {
  const out: string[] = [];
  if (reel.editorial_status !== "approved") out.push("Texte à valider");
  if (!linked?.hasTake) out.push("Prise à filmer");
  else if (!linked.transcribed) out.push("Transcription");
  else if (linked.seededRevision == null) out.push("Animations à placer");
  else if (linked.seededRevision !== reel.revision) out.push("Texte changé : animations à replacer");
  else if (!linked.previewApproved) out.push("Aperçu à valider");
  else if (!linked.finalReady) out.push("Rendu MP4");
  if (!reel.social_caption?.text) out.push("Légende du post");
  return out;
}
