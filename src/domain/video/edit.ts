import { z } from "zod";

/**
 * Montage d'une vidéo tournée, décrit par un seul fichier `<projet>.edit.json` (source de vérité).
 * Règle d'or : TOUS les temps sont en millisecondes de la prise d'origine, jamais du temps monté.
 * Recouper un silence ne décale donc aucune animation : chaque instant reste ancré sur un mot prononcé.
 */

const ms = z.number().int("nombre entier de millisecondes attendu").min(0, "doit être positif ou nul");
/** Nom de fichier simple, à côté du fichier edit.json : aucun chemin, aucun caractère spécial. */
const fileName = (ext: RegExp, kind: string) =>
  z.string().regex(/^[\w.-]+$/, "nom de fichier simple attendu (lettres, chiffres, . _ -)").regex(ext, `fichier ${kind} attendu`);

export const RangeSchema = z.strictObject({ fromMs: ms, toMs: ms });

export const CustomAnimationSchema = z.strictObject({
  name: z.string().regex(/^[a-z0-9-]+$/, "nom d'animation en minuscules (a-z, 0-9, -)"),
  fromMs: ms,
  toMs: ms,
  props: z.record(z.string(), z.unknown()).default({}),
  label: z.string().max(80).optional(),
});

export const SoundSchema = z.strictObject({
  file: fileName(/\.(mp3|wav|m4a|aac|ogg)$/i, "audio (.mp3, .wav, .m4a, .aac, .ogg)"),
  atMs: ms,
  volume: z.number().min(0).max(1).default(1),
  durationMs: ms.optional(),
});

export const EditSchema = z.strictObject({
  video: fileName(/\.(mp4|mov|m4v|webm)$/i, "vidéo (.mp4, .mov, .m4v, .webm)"),
  captions: fileName(/\.json$/i, "de sous-titres (.json)").optional(),
  /** Un seul accent par vidéo (STYLE.md). */
  accent: z.enum(["violet", "vert"]).default("violet"),
  /** Morceaux GARDÉS de la prise, dans l'ordre (coupes sèches entre eux). */
  ranges: z.array(RangeSchema).min(1, "au moins un morceau à garder"),
  subtitles: z.boolean().default(true),
  /** Gain de la voix (1 = inchangé, 3,98 = +12 dB au maximum). */
  voiceGain: z.number().min(0).max(3.98).default(1),
  custom: z.array(CustomAnimationSchema).default([]),
  sounds: z.array(SoundSchema).default([]),
});

export type Edit = z.infer<typeof EditSchema>;
export type Range = z.infer<typeof RangeSchema>;

/** Mot du transcript (fichier `<projet>.json`), temps en ms de la prise. */
export const CaptionWordSchema = z.object({ text: z.string(), startMs: ms, endMs: ms });
export const CaptionsSchema = z.array(CaptionWordSchema);
export type CaptionWord = z.infer<typeof CaptionWordSchema>;

const TYPES: Record<string, string> = { number: "nombre", string: "texte", boolean: "vrai/faux", array: "liste", object: "objet" };

function pathOf(path: PropertyKey[]): string {
  return path.reduce<string>((s, k) => (typeof k === "number" ? `${s}[${k}]` : s ? `${s}.${String(k)}` : String(k)), "") || "(racine)";
}

/** Traduit une erreur zod en une ligne française lisible : « • ranges[0].toMs → nombre attendu ». */
export function formatIssue(issue: z.core.$ZodIssue): string {
  const at = pathOf(issue.path);
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined ? `• ${at} → clé obligatoire manquante` : `• ${at} → ${TYPES[issue.expected] ?? issue.expected} attendu`;
    case "unrecognized_keys":
      return `• ${at} → clé inconnue : ${issue.keys.join(", ")}`;
    case "invalid_value":
      return `• ${at} → valeur non autorisée — choix possibles : ${issue.values.map(String).join(", ")}`;
    case "too_small":
      return issue.origin === "array" ? `• ${at} → ${issue.message.startsWith("au moins") ? issue.message : `au moins ${issue.minimum} élément(s)`}` : `• ${at} → ${/^(doit|au moins)/.test(issue.message) ? issue.message : `minimum ${issue.minimum}`}`;
    case "too_big":
      return issue.origin === "string" ? `• ${at} → ${issue.maximum} caractères maximum` : `• ${at} → maximum ${issue.maximum}`;
    default:
      return `• ${at} → ${issue.message}`;
  }
}

/** Vérifications que le schéma ne peut pas exprimer : ordre des morceaux, fenêtres valides. */
export function checkCoherence(edit: Edit): string[] {
  const errors: string[] = [];
  edit.ranges.forEach((r, i) => {
    if (r.toMs <= r.fromMs) errors.push(`• ranges[${i}] → toMs (${r.toMs}) doit être après fromMs (${r.fromMs})`);
    const prev = edit.ranges[i - 1];
    if (prev && r.fromMs < prev.toMs) errors.push(`• ranges[${i}] → chevauche ou précède le morceau précédent (début ${r.fromMs} < fin ${prev.toMs}) : les morceaux doivent être triés sans chevauchement`);
  });
  const end = edit.ranges[edit.ranges.length - 1]?.toMs ?? 0;
  edit.custom.forEach((c, i) => {
    if (c.toMs <= c.fromMs) errors.push(`• custom[${i}] → toMs (${c.toMs}) doit être après fromMs (${c.fromMs})`);
    if (c.fromMs >= end) errors.push(`• custom[${i}] → commence après la fin du montage (${end} ms)`);
  });
  edit.sounds.forEach((s, i) => {
    if (s.atMs >= end) errors.push(`• sounds[${i}] → placé après la fin du montage (${end} ms)`);
  });
  return errors;
}

export type ParseResult = { ok: true; edit: Edit } | { ok: false; errors: string[] };

/** Point d'entrée unique : schéma strict (clé inconnue = erreur) puis cohérence, erreurs en français. */
export function parseEdit(input: unknown): ParseResult {
  const parsed = EditSchema.safeParse(input, { reportInput: true });
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map(formatIssue) };
  const errors = checkCoherence(parsed.data);
  return errors.length ? { ok: false, errors } : { ok: true, edit: parsed.data };
}

/** Morceau posé sur la sortie : [fromMs, toMs) de la prise, joué à partir de `atMs` du montage. */
export type Segment = Range & { atMs: number };

/** Pose les morceaux gardés bout à bout. */
export function layout(ranges: Range[]): Segment[] {
  let at = 0;
  return ranges.map((r) => {
    const seg = { ...r, atMs: at };
    at += r.toMs - r.fromMs;
    return seg;
  });
}

export const totalMs = (segments: Segment[]) => {
  const last = segments[segments.length - 1];
  return last ? last.atMs + last.toMs - last.fromMs : 0;
};

/**
 * `F(ms)` : temps de la prise → temps du montage. Un instant tombé dans une coupe saute au début du
 * morceau suivant (l'animation démarre au raccord) ; après le dernier morceau, c'est la fin du montage.
 */
export function toOutputMs(segments: Segment[], sourceMs: number): number {
  for (const s of segments) {
    if (sourceMs < s.fromMs) return s.atMs;
    if (sourceMs < s.toMs) return s.atMs + sourceMs - s.fromMs;
  }
  return totalMs(segments);
}

/** Mot recalé sur le montage, avec le numéro du morceau qui le contient (pour changer de page à chaque raccord). */
export type PlacedWord = CaptionWord & { segment?: number };

/** Recale le transcript sur le montage : un mot est gardé si son milieu tombe dans un morceau. */
export function remapCaptions(words: CaptionWord[], segments: Segment[]): PlacedWord[] {
  const out: PlacedWord[] = [];
  for (const w of words) {
    const mid = (w.startMs + w.endMs) / 2;
    const segment = segments.findIndex((x) => mid >= x.fromMs && mid < x.toMs);
    if (segment < 0) continue;
    const s = segments[segment];
    const clamp = (t: number) => s.atMs + Math.min(Math.max(t, s.fromMs), s.toMs) - s.fromMs;
    out.push({ text: w.text, startMs: clamp(w.startMs), endMs: clamp(w.endMs), segment });
  }
  return out;
}

export type CaptionPage = { startMs: number; endMs: number; words: PlacedWord[] };

/**
 * Pages de sous-titres karaoké (temps du montage) : 4 mots et 26 caractères au plus en vertical,
 * nouvelle page après une fin de phrase, à chaque raccord et après un silence de plus de 650 ms. Une page reste affichée jusqu'à la suivante si l'écart est court.
 */
export function captionPages(words: PlacedWord[], opts: { maxWords?: number; maxChars?: number; gapMs?: number } = {}): CaptionPage[] {
  const { maxWords = 4, maxChars = 26, gapMs = 650 } = opts;
  const pages: CaptionPage[] = [];
  let cur: PlacedWord[] = [];
  const flush = () => {
    if (cur.length) pages.push({ startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs, words: cur });
    cur = [];
  };
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    const word = { ...w, text };
    const prev = cur[cur.length - 1];
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + text.length;
    const breakAfterPrev = prev && (/[.?!…]$/.test(prev.text) || prev.segment !== word.segment);
    if (cur.length && (breakAfterPrev || cur.length >= maxWords || chars > maxChars || word.startMs - prev.endMs > gapMs)) flush();
    cur.push(word);
  }
  flush();
  pages.forEach((p, i) => {
    const next = pages[i + 1];
    if (next && next.startMs - p.endMs <= gapMs) p.endMs = next.startMs;
  });
  return pages;
}
