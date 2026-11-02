import { z } from "zod";
import { MAX_STRIP_MS, MAX_TAKES, splitAtTakes, takeBreaks, type CaptionWord, type Edit, type Range, type Take } from "./edit";

/**
 * Page Montage : une prise envoyée depuis le site, son transcript (ElevenLabs Scribe) et son edit.json.
 * Ce module ne dépend ni de Supabase ni de Next : il est testé seul et partagé par le serveur et le navigateur.
 */

export const MONTAGE_STATUSES = ["uploading", "uploaded", "transcribing", "ready", "error"] as const;
export type MontageStatus = (typeof MONTAGE_STATUSES)[number];

export const MONTAGE_STATUS_LABELS: Record<MontageStatus, string> = {
  uploading: "Envoi en cours",
  uploaded: "Prise reçue",
  transcribing: "Transcription…",
  ready: "Prêt à monter",
  error: "Erreur",
};

export type Montage = {
  id: string;
  organizationId: string;
  title: string;
  videoPath: string;
  durationMs: number | null;
  status: MontageStatus;
  edit: Edit | null;
  previousEdit: Edit | null;
  captions: CaptionWord[] | null;
  speechIslands: Range[] | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Taille maximale d'une prise envoyée (Reels : quelques minutes au plus). */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
export const MAX_DURATION_MS = 600_000;
export const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm"] as const;

/**
 * Nom de fichier simple et sûr (le schéma edit.json n'accepte que `[\w.-]`) : accents retirés, espaces et signes
 * remplacés par des tirets, extension vidéo vérifiée. Renvoie null si ce n'est pas une vidéo acceptée.
 */
export function safeVideoName(original: string): string | null {
  const m = original.trim().match(/^(.*)\.([A-Za-z0-9]+)$/);
  if (!m) return null;
  const ext = m[2].toLowerCase();
  if (!(VIDEO_EXTENSIONS as readonly string[]).includes(ext)) return null;
  const base = m[1]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase();
  return `${base || "prise"}.${ext}`;
}

export const newMontageSchema = z.object({
  title: z.string().trim().min(1, "Donnez un titre au montage.").max(160),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "La prise dépasse 500 Mo : exportez-la plus légère."),
});

export const uploadedSchema = z.object({
  durationMs: z.number().int().min(1000, "Prise trop courte (1 s minimum).").max(MAX_DURATION_MS, "Prise trop longue (10 min maximum)."),
  islands: z.array(z.strictObject({ fromMs: z.number().int().min(0), toMs: z.number().int().min(0) })).max(5000).nullable(),
});

/** Réponse de l'API ElevenLabs Scribe (champs utilisés). */
export const ScribeResponseSchema = z.object({
  words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number(), type: z.string().optional() })),
});

/** Mots de Scribe (secondes) → transcript edit.json (ms de la prise) ; espaces et événements sonores ignorés. */
export function scribeToWords(response: unknown): CaptionWord[] {
  const { words } = ScribeResponseSchema.parse(response);
  return words
    .filter((w) => (w.type ?? "word") === "word" && w.text.trim())
    .map((w) => {
      const startMs = Math.max(0, Math.round(w.start * 1000));
      return { text: ` ${w.text.trim()}`, startMs, endMs: Math.max(Math.round(w.end * 1000), startMs + 1) };
    });
}

/** Montage initial : un seul morceau, toute la prise. */
export const initialEdit = (videoName: string, durationMs: number): Edit => ({
  video: videoName,
  accent: "bleu",
  ranges: [{ fromMs: 0, toMs: durationMs }],
  subtitles: true,
  captionStyle: {},
  voiceGain: 1,
  custom: [],
  sounds: [],
});

/** Prise supplémentaire (lot S3 bis) : même contrôle que la première, sans titre. */
export const newTakeSchema = z.object({
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "La prise dépasse 500 Mo : exportez-la plus légère."),
});

/** Nom de fichier libre parmi les prises du montage : « prise.mp4 », puis « prise-2.mp4 », « prise-3.mp4 »… */
export function uniqueTakeName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  const dot = name.lastIndexOf(".");
  for (let k = 2; ; k++) {
    const candidate = `${name.slice(0, dot)}-${k}${name.slice(dot)}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

/** Prises d'un montage (une seule prise sans liste : `video` sur toute la durée connue). */
export const takesOf = (edit: Edit, durationMs: number | null): Take[] => edit.takes?.length ? edit.takes : [{ file: edit.video, durationMs: durationMs ?? 0 }];

/** Une prise de plus est-elle possible ? Renvoie la raison du refus, sinon null. */
export function addTakeError(takes: Take[], durationMs?: number): string | null {
  if (takes.length >= MAX_TAKES) return `${MAX_TAKES} prises au plus par montage.`;
  if (durationMs !== undefined && takes.reduce((n, t) => n + t.durationMs, 0) + durationMs > MAX_STRIP_MS) return `${MAX_STRIP_MS / 60_000} min de prises au plus en tout : raccourcissez ou retirez une prise.`;
  return null;
}

/**
 * Montage remis à plat sur une nouvelle liste de prises (avant transcription) : toutes les prises gardées en entier,
 * bout à bout. Une seule prise : la forme d'origine, sans liste de prises.
 */
export function withTakes(edit: Edit, takes: Take[]): Edit {
  const total = takes.reduce((n, t) => n + t.durationMs, 0);
  const rest: Edit = { ...edit };
  delete rest.takes;
  // Le détourage d'une prise retirée part avec elle.
  const mattes = Object.entries(edit.mattes ?? {}).filter(([take]) => takes.some((t) => t.file === take));
  if (mattes.length) rest.mattes = Object.fromEntries(mattes);
  else delete rest.mattes;
  if (takes.length < 2) return { ...rest, video: takes[0].file, ranges: [{ fromMs: 0, toMs: total }] };
  return { ...rest, video: takes[0].file, takes, ranges: splitAtTakes([{ fromMs: 0, toMs: total }], takeBreaks({ video: takes[0].file, takes })) };
}

/** Îlots de parole d'une prise (temps de la prise) → temps de la bande. */
export const shiftRanges = (ranges: Range[], byMs: number): Range[] => ranges.map((r) => ({ fromMs: r.fromMs + byMs, toMs: r.toMs + byMs }));

/** Retire la prise `index` (ses îlots de parole partent avec, ceux des prises suivantes reculent d'autant). */
export function removeTake(takes: Take[], islands: Range[] | null, index: number): { takes: Take[]; islands: Range[] | null } {
  const from = takes.slice(0, index).reduce((n, t) => n + t.durationMs, 0);
  const len = takes[index].durationMs;
  const kept = islands?.filter((r) => r.toMs <= from || r.fromMs >= from + len).map((r) => (r.fromMs >= from + len ? { fromMs: r.fromMs - len, toMs: r.toMs - len } : r)) ?? null;
  return { takes: takes.filter((_, i) => i !== index), islands: kept };
}

/** Nom du fichier de la prise, tiré du chemin de stockage. */
export const videoNameOf = (videoPath: string) => videoPath.slice(videoPath.lastIndexOf("/") + 1);

export const keptMs = (ranges: Range[]) => ranges.reduce((n, r) => n + r.toMs - r.fromMs, 0);
