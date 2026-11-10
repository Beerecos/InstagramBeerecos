import type { CaptionWord, Edit } from "./edit";
import { layout, toOutputMs } from "./edit";
import { ANIMATIONS } from "./registry";
import { sceneCandidates, type Scene } from "./scenes";
import { removeSequence } from "./sequence-edit";
import { restoreSource } from "./studio";
import { studioSequences } from "./studio-sequences";
import { checkTimeline, type CustomAnimation } from "./suggest";
import type { KeptMotion, SceneIntent } from "./beemotion";
import { swapWordAnimation, wordProps, type WordAnimation } from "./bee-styles";

/**
 * STORYBOARD EN CARTES (refonte du Studio, 2026-11-10, « Tu parles. BeeMarketing monte. ») : le montage entier se lit
 * séquence par séquence, sans timeline. Une carte = une séquence du transcript (rôle, phrase dite, effets posés) avec
 * quatre décisions : Garder, Modifier (langage naturel, via les retours de Bee), Supprimer (coupe non destructive,
 * restaurable) et Régénérer (autre mise en scène pour CETTE séquence seulement). 100 % déterministe ici : aucun texte
 * inventé, les réglages viennent de ce qui est dit.
 */

export type CardStatus = "suggested" | "validated" | "modified" | "deleted";
export const STATUS_LABEL: Record<CardStatus, string> = { suggested: "Suggestion IA", validated: "Validé", modified: "Modifié", deleted: "Supprimé" };
export const ROLE_LABEL: Record<SceneIntent, string> = {
  HOOK: "Accroche", PROBLEM: "Problème", EXPLAIN: "Explication", DEMONSTRATION: "Démonstration", PROOF: "Preuve", STAT: "Chiffre",
  QUOTE: "Citation", LIST: "Étapes", EMPHASIS: "Phrase forte", TRANSITION: "Transition", CTA: "Appel à l'action", BRAND: "Marque",
};

export type StoryboardCard = {
  /** Clé stable : début de la séquence dans la prise (ms, temps source). */
  key: string;
  scene: Scene;
  role: string;
  status: CardStatus;
  /** Position dans la vidéo montée (ms), null si la séquence est supprimée. */
  outStartMs: number | null;
  outEndMs: number | null;
  /** Effets posés pendant la séquence (libellé lisible + texte affiché). */
  /** Effets qui commencent dans la séquence ; `ref` = position dans edit.custom. */
  effects: { ref: number; name: string; label: string; text: string | null }[];
};

const keyOf = (scene: Pick<Scene, "startMs">) => String(Math.round(scene.startMs));
const keptShare = (edit: Pick<Edit, "ranges">, scene: Pick<Scene, "startMs" | "endMs">) => {
  const len = Math.max(1, scene.endMs - scene.startMs);
  const kept = edit.ranges.reduce((n, r) => n + Math.max(0, Math.min(r.toMs, scene.endMs) - Math.max(r.fromMs, scene.startMs)), 0);
  return kept / len;
};
const overlaps = (a: { fromMs: number; toMs: number }, s: Pick<Scene, "startMs" | "endMs">) => a.fromMs < s.endMs && a.toMs > s.startMs;
const startsIn = (a: { fromMs: number }, s: Pick<Scene, "startMs" | "endMs">) => a.fromMs >= s.startMs && a.fromMs < s.endMs;
const shownText = (props: Record<string, unknown>) => {
  if (Array.isArray(props.items) && typeof props.items[0] === "string") return props.items.join(" · ");
  for (const k of ["texte", "mot", "titre", "legende"]) if (typeof props[k] === "string" && props[k]) return String(props[k]);
  return null;
};

/**
 * Cartes du storyboard : séquences calculées sur TOUT le transcript (une séquence coupée reste visible, « Supprimé »,
 * pour pouvoir la restaurer), dans l'ordre de la vidéo.
 */
export function storyboardCards(edit: Edit, words: CaptionWord[], durationMs: number, keyword?: string | null): StoryboardCard[] {
  const end = Math.max(durationMs, ...words.map((w) => w.endMs), ...edit.ranges.map((r) => r.toMs));
  const scenes = studioSequences(words, [{ fromMs: 0, toMs: end }], keyword);
  const segments = layout(edit.ranges);
  return scenes.map((scene) => {
    const key = keyOf(scene);
    const deleted = keptShare(edit, scene) < 0.3;
    const mark = edit.sceneMarks?.[key];
    const status: CardStatus = deleted ? "deleted" : mark ?? "suggested";
    // Un effet appartient à la séquence où il commence (jamais affiché sur deux cartes).
    const effects = deleted ? [] : edit.custom.flatMap((c, ref) => (startsIn(c, scene) ? [{ ref, name: c.name, label: ANIMATIONS[c.name]?.label ?? c.name, text: shownText(c.props) }] : []));
    const inside = edit.ranges.filter((r) => r.toMs > scene.startMs && r.fromMs < scene.endMs);
    return {
      key, scene, role: ROLE_LABEL[scene.intent] ?? "Séquence", status, effects,
      outStartMs: deleted || !inside.length ? null : toOutputMs(segments, Math.max(scene.startMs, inside[0].fromMs)),
      outEndMs: deleted || !inside.length ? null : toOutputMs(segments, Math.min(scene.endMs, inside[inside.length - 1].toMs)),
    };
  });
}

const withMark = (edit: Edit, key: string, mark: "validated" | "modified" | null): Edit => {
  const marks = { ...(edit.sceneMarks ?? {}) };
  if (mark) marks[key] = mark; else delete marks[key];
  return { ...edit, sceneMarks: Object.keys(marks).length ? marks : undefined };
};

/** Marque « Modifié » sur une proposition acceptée pour cette séquence (Modifier en langage naturel). */
export const markModified = (edit: Edit, card: Pick<StoryboardCard, "key">) => withMark(edit, card.key, "modified");

/** Garder : la séquence est validée telle quelle. */
export const keepCard = (edit: Edit, card: Pick<StoryboardCard, "key">) => withMark(edit, card.key, "validated");

/** Supprimer : coupe non destructive (fichiers et transcript intacts), effets de la séquence retirés. */
export function deleteCard(edit: Edit, card: Pick<StoryboardCard, "key" | "scene">): Edit {
  return withMark(removeSequence(edit, card.scene), card.key, null);
}

/** Restaurer une séquence supprimée : elle revient en « Suggestion IA ». */
export function restoreCard(edit: Edit, card: Pick<StoryboardCard, "key" | "scene">, durationMs?: number): Edit {
  return withMark({ ...edit, ranges: restoreSource(edit.ranges, card.scene.startMs, card.scene.endMs, durationMs) }, card.key, null);
}

/**
 * Régénérer : autre mise en scène pour CETTE séquence seulement (les autres restent inchangées). On prend la proposition
 * suivante parmi celles adaptées à la séquence (sans réglage à inventer), on retire les effets de la séquence, puis on
 * pose la nouvelle si elle respecte la timeline. Renvoie null si aucune autre proposition honnête n'existe.
 */
export function regenerateCard(edit: Edit, card: Pick<StoryboardCard, "key" | "scene">, opts: { canBehind: boolean; keyword?: string | null; kept?: KeptMotion[] }): { edit: Edit; name: string } | null {
  const current = edit.custom.filter((c) => overlaps(c, card.scene)).map((c) => c.name);
  const others = edit.custom.filter((c) => !overlaps(c, card.scene));
  const candidates = sceneCandidates(card.scene, { canBehind: opts.canBehind, keyword: opts.keyword, kept: opts.kept })
    .filter((c) => !current.includes(c.motion.id));
  for (const c of candidates) {
    const def = ANIMATIONS[c.motion.id];
    if (!def) continue;
    // Sur le mot fort s'il laisse le temps de lire l'animation, sinon dès le début de la séquence.
    const anchored = Math.max(card.scene.startMs, c.anchorMs);
    const fromMs = card.scene.endMs - anchored >= Math.min(def.lengthMs, 1500) ? anchored : card.scene.startMs;
    const toMs = Math.min(card.scene.endMs, fromMs + def.lengthMs);
    if (toMs - fromMs < 800) continue;
    const values: Record<string, string> = { ...c.values };
    // Chiffre : la légende reprend mot pour mot ce qui est dit juste après le nombre (jamais inventée).
    if (c.motion.id === "chiffre" && !values.legende?.trim()) values.legende = spokenAfterNumber(card.scene.text);
    const raw = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()).map(([k, v]) => [k, k === "valeur" && /^\d+([.,]\d+)?$/.test(v) ? Number(v.replace(",", ".")) : v]));
    // Seulement une proposition complète et conforme au schéma de l'animation : aucun réglage à deviner.
    const parsed = def.props.safeParse(raw);
    if (!parsed.success) continue;
    const next: CustomAnimation = { name: c.motion.id, fromMs, toMs, props: raw, label: "Storyboard · régénéré" };
    if (checkTimeline([...others, next]).length) continue;
    return { edit: withMark({ ...edit, custom: [...others, next] }, card.key, "modified"), name: def.label };
  }
  return null;
}

/** Mots dits juste après le premier nombre de la phrase (4 au plus, sans ponctuation finale). */
function spokenAfterNumber(text: string): string {
  const m = /\d[\d\s]*(?:[.,]\d+)?\s*(?:%|€)?\s+([^.!?…,;:]+)/.exec(text);
  return m ? m[1].trim().split(/\s+/).slice(0, 4).join(" ") : "";
}

/** Consigne de « Modifier » envoyée à Bee, limitée à la séquence (temps et phrase dite) : rien n'est inventé ici. */
export function modifyInstruction(card: Pick<StoryboardCard, "scene" | "outStartMs" | "outEndMs">, instruction: string): string {
  const sec = (ms: number | null) => (ms === null ? "?" : (ms / 1000).toFixed(1).replace(".", ","));
  const quote = card.scene.text.length > 140 ? `${card.scene.text.slice(0, 140)}…` : card.scene.text;
  return `Seulement pour la séquence de ${sec(card.outStartMs)} s à ${sec(card.outEndMs)} s (« ${quote} ») : ${instruction.trim()}`;
}

// ── Effets d'une séquence, modifiables en un clic (2026-11-10 : « quand je clique sur Modifier, je dois avoir la
// bibliothèque d'effets ou la possibilité de supprimer l'effet »). Chaque action marque la séquence « Modifié ».

/** Supprimer un effet de la séquence. */
export function removeCardEffect(edit: Edit, card: Pick<StoryboardCard, "key">, ref: number): Edit {
  return markModified({ ...edit, custom: edit.custom.filter((_, i) => i !== ref) }, card);
}

/** Changer l'animation d'un effet de mot (même texte, mêmes temps). */
export function swapCardEffect(edit: Edit, card: Pick<StoryboardCard, "key">, ref: number, name: WordAnimation): Edit {
  return markModified({ ...edit, custom: edit.custom.map((c, i) => (i === ref ? swapWordAnimation(c, name) : c)) }, card);
}

/** Texte proposé pour un nouvel effet : le mot pivot de la séquence, sinon ses premiers mots. */
export function defaultEffectText(card: Pick<StoryboardCard, "scene">): string {
  const pivot = card.scene.pivotWords[0]?.word?.replace(/[^\p{L}\p{N}%€'’ -]/gu, "").trim();
  if (pivot) return pivot.toUpperCase();
  return card.scene.text.split(/\s+/).slice(0, 4).join(" ").replace(/[.,!?…]+$/, "");
}

/**
 * Ajouter un effet de mot au début de la partie gardée de la séquence (2,5 s au plus, sans dépasser la séquence).
 * Les autres effets de la séquence sont remplacés (une idée par séquence). Renvoie une raison si c'est impossible.
 */
export function addCardEffect(edit: Edit, card: Pick<StoryboardCard, "key" | "scene">, name: WordAnimation, text: string): { edit: Edit } | { error: string } {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return { error: "Écris le texte à afficher." };
  const kept = edit.ranges.find((r) => r.toMs > card.scene.startMs && r.fromMs < card.scene.endMs);
  if (!kept) return { error: "Séquence retirée du montage : restaure-la d'abord." };
  const fromMs = Math.max(card.scene.startMs, kept.fromMs);
  const toMs = Math.min(fromMs + 2500, card.scene.endMs, kept.toMs);
  if (toMs - fromMs < 800) return { error: "Séquence trop courte pour un effet (moins d'une seconde)." };
  const custom = [...edit.custom.filter((c) => !startsIn(c, card.scene) || c.name === "logo-fin" || c.name === "mot-cle"), { name, fromMs, toMs, props: wordProps(name, t), label: "Storyboard · effet" }]
    .sort((a, b) => a.fromMs - b.fromMs);
  const errors = checkTimeline(custom);
  if (errors.length) return { error: `Effet impossible ici : ${errors[0]}` };
  return { edit: markModified({ ...edit, custom }, card) };
}
