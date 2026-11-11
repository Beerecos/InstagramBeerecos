import { INTENT_INTENSITY, MOTION_META, listMotions, searchMotions, type KeptMotion, type Motion, type MotionIntensity, type SceneIntent } from "./beemotion";
import type { CaptionWord } from "./edit";
import { ANIMATIONS } from "./registry";
import { fieldsOf, type CustomAnimation } from "./suggest";

/**
 * Lecture d'une prise par le Studio (BeeMotion) : transcript → scènes par intention → mots pivots → motions proposés.
 * 100 % déterministe (règles, pas de modèle) : rien n'est inventé, tout texte proposé vient du transcript, et le mot-clé
 * du CTA n'est repris que s'il est celui du Reel lié (activé dans le moteur de DM). Rien n'est posé sans clic.
 */

export type PivotWord = { word: string; startMs: number };
export type Scene = {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  intent: SceneIntent;
  /** Intensité visée pour cette fonction de scène. */
  intensity: MotionIntensity;
  pivotWords: PivotWord[];
};

/** Une pause de cette durée entre deux mots coupe une scène, comme une fin de phrase. */
export const SCENE_PAUSE_MS = 700;
/** Une scène plus courte se rattache à la suivante (pas de scène d'un seul mot). */
export const MIN_SCENE_MS = 1200;
/** Au-delà, une scène sans aucune animation risque de perdre l'attention. */
export const ATTENTION_RISK_MS = 7000;

/**
 * Mots pivots BeeRecos : liste donnée par Cédric (script du 2026-10-25) + mots-clés de DM activés (decision-log
 * 2026-10-23). Comparaison sans accents ni casse ; deux par scène au plus.
 */
export const PIVOT_LEXICON = ["reseau", "reseaux", "monetise", "monetiser", "business", "recommandation", "recommandations", "recommande",
  "formation", "ia", "adhesion", "client", "clients", "club", "clubs", "invitation", "visite", "digitalisation"];
const MAX_PIVOTS = 2;

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const bare = (t: string) => fold(t).replace(/[^\p{L}\p{N}%€]/gu, "");
const endsSentence = (t: string) => /[.!?…]["»”]?$/.test(t.trim());

/** Intention d'une scène par règles lisibles, dans cet ordre ; sinon EXPLAIN. */
function intentOf(text: string, i: number, last: number, keyword: string | null): SceneIntent {
  const t = fold(text);
  if (i === last && (/\bcommente\b/.test(t) || (keyword && t.includes(fold(keyword))))) return "CTA";
  if (i === 0) return "HOOK";
  if (/\d/.test(t)) return /[%€]|\beuros?\b|\bpour ?cent\b/.test(t) ? "STAT" : "PROOF";
  if (/\b(probleme|jamais|personne ne|aucun|rien|perd|perdu|manque)\b/.test(t)) return "PROBLEM";
  if (/\b(d'abord|premierement|deuxiemement|troisiemement|ensuite|etape)\b/.test(t)) return "LIST";
  if (/\b(exemple|regarde|voici|imagine|concretement)\b/.test(t)) return "DEMONSTRATION";
  return "EXPLAIN";
}

/** Découpe le transcript (mots gardés au montage) en scènes : fin de phrase ou pause, scènes trop courtes regroupées. */
export function analyzeScenes(words: CaptionWord[], opts: { keyword?: string | null } = {}): Scene[] {
  const groups: CaptionWord[][] = [];
  let cur: CaptionWord[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (!next || endsSentence(w.text) || next.startMs - w.endMs >= SCENE_PAUSE_MS) { groups.push(cur); cur = []; }
  });
  const merged: CaptionWord[][] = [];
  for (const g of groups) {
    const prev = merged[merged.length - 1];
    if (prev && prev[prev.length - 1].endMs - prev[0].startMs < MIN_SCENE_MS) prev.push(...g);
    else merged.push([...g]);
  }
  // La dernière scène trop courte rejoint la précédente.
  if (merged.length > 1) {
    const tail = merged[merged.length - 1];
    if (tail[tail.length - 1].endMs - tail[0].startMs < MIN_SCENE_MS) merged[merged.length - 2].push(...merged.pop()!);
  }
  const keyword = opts.keyword ?? null;
  return merged.map((g, i) => {
    const text = g.map((w) => w.text.trim()).join(" ").replace(/\s+/g, " ").trim();
    const intent = intentOf(text, i, merged.length - 1, keyword);
    const pivots: PivotWord[] = [];
    for (const w of g) {
      const b = bare(w.text);
      const isPivot = PIVOT_LEXICON.includes(b) || (keyword && b === bare(keyword)) || (/^\d/.test(b) && /[%€]/.test(w.text));
      if (isPivot && !pivots.some((p) => bare(p.word) === b) && pivots.length < MAX_PIVOTS) pivots.push({ word: w.text.replace(/[^\p{L}\p{N}%€'-]/gu, ""), startMs: w.startMs });
    }
    return { index: i, startMs: g[0].startMs, endMs: g[g.length - 1].endMs, text, intent, intensity: INTENT_INTENSITY[intent], pivotWords: pivots };
  });
}

/** Scènes longues sans aucune animation : risque d'attention (proposer une relance, jamais en poser une d'office). */
export function attentionRisks(scenes: Scene[], custom: Pick<CustomAnimation, "fromMs" | "toMs">[]): number[] {
  return scenes
    .filter((s) => s.endMs - s.startMs >= ATTENTION_RISK_MS && !custom.some((c) => c.fromMs < s.endMs && c.toMs > s.startMs))
    .map((s) => s.index);
}

/** Trois animations fortes d'affilée : le rythme sature (HIGH HIGH HIGH). */
export function intensityWarnings(custom: Pick<CustomAnimation, "name" | "fromMs">[]): string[] {
  const sorted = [...custom].sort((a, b) => a.fromMs - b.fromMs);
  let run = 0;
  for (const c of sorted) {
    run = MOTION_META[c.name]?.intensity === "high" ? run + 1 : 0;
    if (run >= 3) return ["Trois animations fortes d'affilée : alternez avec une animation douce ou aucune (clarté avant variété)."];
  }
  return [];
}

export type Candidate = {
  motion: Motion;
  /** Réglages pré-remplis depuis le transcript (texte brut du formulaire), ou vides à compléter. */
  values: Record<string, string>;
  /** Mot (pivot) sur lequel poser l'animation, sinon le début de la scène. */
  anchorMs: number;
  note?: string;
};

const firstWords = (text: string, n: number) => text.replace(/[.!?…,;:]+/g, "").split(/\s+/).slice(0, n).join(" ");

/** Réglages tirés de la scène, ou null si le motion ne peut pas être rempli honnêtement (ex. chiffre sans nombre dit). */
function prefill(id: string, scene: Scene, keyword: string | null): { values: Record<string, string>; note?: string } | null {
  const pivot = scene.pivotWords[0]?.word;
  switch (id) {
    case "titre-derriere": return { values: { texte: (pivot ?? firstWords(scene.text, 3)).toUpperCase(), entree: "rebond" } };
    case "titre": return { values: { texte: firstWords(scene.text, 8) } };
    case "onglet": return { values: { texte: pivot ? pivot.toUpperCase() : firstWords(scene.text, 5) } };
    case "cta-saisie": return keyword ? { values: { mot: keyword, consigne: "" } } : { values: { mot: "" }, note: "Mot-clé à saisir : seulement un mot-clé déjà actif dans le moteur de DM." };
    case "mot-cle": return keyword ? { values: { mot: keyword } } : { values: { mot: "" }, note: "Mot-clé à saisir : seulement un mot-clé déjà actif dans le moteur de DM." };
    case "chiffre": {
      const m = /(\d[\d\s]*(?:[.,]\d+)?)\s*(%|€)?/.exec(scene.text);
      if (!m) return null;
      // Légende : les mots dits juste après le chiffre (« 500 personnes » → « personnes »), à ajuster si besoin.
      const after = firstWords(scene.text.slice(m.index + m[0].length).trim(), 4) || firstWords(scene.text, 4);
      return { values: { valeur: m[1].replace(/\s/g, "").replace(",", "."), apres: m[2] ?? "", legende: after }, note: "Légende reprise de ce qui est dit : ajuste-la si besoin." };
    }
    default: return fromSpeech(id, scene, pivot);
  }
}

/** Morceaux courts de ce qui est dit dans la scène (séparés aux pauses de ponctuation), pour les listes. */
function chunks(text: string, n: number): string[] {
  const parts = text.split(/[.,;:!?…]+|\s(?:et|puis|ensuite|enfin)\s/i).map((p) => p.trim()).filter((p) => p.split(/\s+/).length >= 1);
  const out = parts.length >= 2 ? parts : text.split(/\s+/).reduce<string[]>((acc, w, i) => { if (i % 3 === 0) acc.push(w); else acc[acc.length - 1] += ` ${w}`; return acc; }, []);
  return out.slice(0, n).map((p) => firstWords(p, 4));
}

/**
 * Pré-remplissage générique (2026-11-10 : « l'animation ne fonctionne pas », carte posée avec des champs vides) :
 * chaque texte obligatoire reçoit un morceau de ce qui est dit (jamais un texte d'exemple du catalogue), chaque liste
 * 2 à 3 morceaux de la phrase ; les réglages de style (choix, nombres facultatifs) gardent leur valeur par défaut.
 * Les textes trop longs sont raccourcis à la limite de l'animation. Renvoie null si le résultat reste invalide.
 */
function fromSpeech(id: string, scene: Scene, pivot: string | undefined): { values: Record<string, string>; note?: string } | null {
  const def = ANIMATIONS[id];
  if (!def) return null;
  const words = scene.text.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean);
  const example = (def.example ?? {}) as Record<string, unknown>;
  const values: Record<string, string> = {};
  let used = 0;
  for (const f of fieldsOf(def)) {
    if (f.kind === "list") {
      // Listes d'icônes (identifiants du catalogue) : décoratives, on garde celles de l'exemple.
      const ex = example[f.key];
      if (Array.isArray(ex) && ex.every((x) => typeof x === "string" && /^[a-z-]+$/.test(x))) { values[f.key] = ex.join("\n"); continue; }
      values[f.key] = chunks(scene.text, Math.max(2, Math.min(3, Array.isArray(ex) ? ex.length : 3))).join("\n");
      continue;
    }
    if (f.kind !== "text" || f.optional) continue;
    if (typeof example[f.key] !== "string") continue;
    const text = used === 0 ? (pivot ?? firstWords(words.join(" "), 3)).toUpperCase() : firstWords(words.slice(used === 1 ? 3 : 7).join(" ") || words.join(" "), 4);
    values[f.key] = text;
    used++;
  }
  // Raccourcir aux limites de l'animation, puis vérifier.
  for (let round = 0; round < 4; round++) {
    const props: Record<string, unknown> = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, fieldsOf(def).find((f) => f.key === k)?.kind === "list" ? v.split("\n").filter(Boolean) : v]));
    const r = def.props.safeParse(props);
    if (r.success) return { values };
    let changed = false;
    for (const issue of r.error.issues) {
      const [key, index] = issue.path as (string | number)[];
      if (issue.code !== "too_big" || typeof key !== "string" || typeof (issue as { maximum?: unknown }).maximum !== "number") continue;
      const max = Number((issue as { maximum: number }).maximum);
      if (typeof index === "number") { const items = values[key].split("\n"); items[index] = items[index].slice(0, max).trim(); values[key] = items.join("\n"); }
      else values[key] = values[key].slice(0, max).trim();
      changed = true;
    }
    if (!changed) break;
  }
  return null;
}

/**
 * Motions proposés pour une scène : recherche BeeMotion par fonction de scène et durée disponible, validés d'abord,
 * sans les motions qui exigent un détourage absent ni ceux qui se posent depuis un autre panneau. 3 au plus.
 */
export function sceneCandidates(scene: Scene, opts: { kept?: KeptMotion[]; canBehind: boolean; keyword?: string | null; allowedNames?: readonly string[] }): Candidate[] {
  const motions = searchMotions({ intent: scene.intent, maxDurationMs: Math.max(scene.endMs - scene.startMs, 2000) + 1000, approvedOnly: false, kept: opts.kept })
    .filter((m) => !m.manualOnly && (opts.canBehind || !m.behind) && (!opts.allowedNames || opts.allowedNames.includes(m.id)))
    .sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved"));
  const out: Candidate[] = [];
  for (const motion of motions) {
    const p = prefill(motion.id, scene, opts.keyword ?? null);
    if (!p) continue;
    out.push({ motion, values: p.values, anchorMs: scene.pivotWords[0]?.startMs ?? scene.startMs, ...(p.note ? { note: p.note } : {}) });
    if (out.length === 3) break;
  }
  return out;
}

/** Carte choisie à la main : préparer des réglages éditables pour CETTE scène, sans restriction d'intention. */
export function sceneCardCandidate(id: string, scene: Scene, opts: { canBehind: boolean; kept?: KeptMotion[]; keyword?: string | null }): Candidate | null {
  const motion = listMotions(undefined, opts.kept).find((m) => m.id === id);
  if (!motion || motion.manualOnly || (motion.behind && !opts.canBehind)) return null;
  const filled = prefill(id, scene, opts.keyword ?? null);
  const values = filled?.values ?? Object.fromEntries(fieldsOf(ANIMATIONS[id]).map((f) => [f.key, ""]));
  const pivot = scene.pivotWords[0]?.startMs ?? scene.startMs;
  return { motion, values, anchorMs: scene.endMs - pivot >= 500 ? pivot : scene.startMs,
    ...(filled?.note ? { note: filled.note } : !filled ? { note: "Réglages à compléter depuis le contenu de cette scène." } : {}) };
}
