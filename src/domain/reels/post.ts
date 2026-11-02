/**
 * Préparation du post et fichiers livrés d'un réel (règles pures, testées).
 * - La légende reste liée au projet et à sa version (empreinte `version` = `updatedAt` du montage).
 * - Un mot-clé préparé n'est PAS une réponse automatique en DM vérifiée : l'avertissement le dit toujours.
 * - Les sous-titres SRT suivent la parole réellement enregistrée et les coupes : temps de SORTIE, pas de la prise.
 */
import { layout, toOutputMs, type CaptionWord, type Range } from "@/domain/social/montage/edit";

export const CAPTION_MAX = 2200; // limite Instagram d'une légende
export const HASHTAG_MAX = 30; // limite Instagram par publication
export const TARGET_MIN_MS = 35_000;
export const TARGET_MAX_MS = 60_000;

export type ReelPost = {
  /** Version du projet pour laquelle la légende a été préparée. */
  version: string;
  caption: string;
  cta: string;
  keyword: string;
  destination: string;
  hashtags: string[];
  /** Instant de la couverture dans la vidéo de sortie (ms). */
  coverMs: number;
};

export const emptyPost = (version: string, keyword = ""): ReelPost => ({ version, caption: "", cta: keyword ? `Commente ${keyword}` : "", keyword, destination: "", hashtags: [], coverMs: 0 });

/** « #BeeRecos, réseau  ia » → ["#BeeRecos", "#reseau", "#ia"] (sans doublon, sans accent ni espace). */
export function parseHashtags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const tag = raw.replace(/^#+/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}_]/gu, "");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${tag}`);
  }
  return out;
}

/** Texte final à coller dans Instagram : légende, CTA, hashtags. */
export function composeCaption(post: Pick<ReelPost, "caption" | "cta" | "hashtags">): string {
  return [post.caption.trim(), post.cta.trim(), post.hashtags.join(" ")].filter(Boolean).join("\n\n");
}

export function postWarnings(post: ReelPost, currentVersion: string): string[] {
  const w: string[] = [];
  const text = composeCaption(post);
  if (text.length > CAPTION_MAX) w.push(`Légende trop longue : ${text.length} caractères pour ${CAPTION_MAX} au plus.`);
  if (post.hashtags.length > HASHTAG_MAX) w.push(`${post.hashtags.length} hashtags : Instagram en accepte ${HASHTAG_MAX} au plus.`);
  if (!post.caption.trim()) w.push("Légende vide.");
  if (post.keyword && !text.toUpperCase().includes(post.keyword.toUpperCase())) w.push(`Le mot-clé ${post.keyword} n'apparaît pas dans la légende.`);
  if (post.keyword) w.push(`Mot-clé ${post.keyword} préparé : la réponse automatique en DM n'est pas vérifiée par le studio (étape distincte).`);
  if (post.version !== currentVersion) w.push("La vidéo a changé depuis la préparation de cette légende : relis-la avant d'exporter.");
  return w;
}

/** Avertissement de durée (cible éditoriale 35–60 s, CTA et carte de fin compris) — jamais de coupe automatique. */
export function durationWarning(outputMs: number | null | undefined): string | null {
  if (!outputMs) return null;
  const s = Math.round(outputMs / 1000);
  if (outputMs < TARGET_MIN_MS) return `Durée ${s} s : sous la cible de 35 à 60 s (CTA et carte de fin compris).`;
  if (outputMs > TARGET_MAX_MS) return `Durée ${s} s : au-delà de la cible de 35 à 60 s. Rien n'est coupé automatiquement.`;
  return null;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
export function srtTime(ms: number): string {
  const t = Math.max(0, Math.round(ms));
  return `${pad(Math.floor(t / 3_600_000))}:${pad(Math.floor((t % 3_600_000) / 60_000))}:${pad(Math.floor((t % 60_000) / 1000))},${pad(t % 1000, 3)}`;
}

/**
 * SRT du montage : seuls les mots entièrement conservés par les coupes, en temps de sortie ; 7 mots au plus par
 * sous-titre, coupure sur la ponctuation ou une pause, 3 s au plus. Renvoie "" sans mot conservé.
 */
export function montageSrt(words: CaptionWord[], ranges: Range[]): string {
  const segments = layout(ranges);
  const kept = words
    .filter((w) => w.text.trim() && ranges.some((r) => w.startMs >= r.fromMs && w.endMs <= r.toMs))
    .map((w) => ({ text: w.text.trim(), startMs: toOutputMs(segments, w.startMs), endMs: toOutputMs(segments, w.endMs) }));
  const cues: { startMs: number; endMs: number; text: string[] }[] = [];
  for (const w of kept) {
    const cue = cues.at(-1);
    const prev = cue?.text.at(-1) ?? "";
    const breaks = !cue || cue.text.length >= 7 || /[.!?…;:]$/.test(prev) || w.startMs - cue.endMs > 600 || w.endMs - cue.startMs > 3000;
    if (breaks) cues.push({ startMs: w.startMs, endMs: w.endMs, text: [w.text] });
    else { cue.text.push(w.text); cue.endMs = w.endMs; }
  }
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(Math.max(c.endMs, c.startMs + 300))}\n${c.text.join(" ")}\n`).join("\n");
}

/** Nom de fichier sûr : « V12 · Mon réseau ! » → « v12-mon-reseau ». */
export const fileSlug = (title: string) => title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "reel";
