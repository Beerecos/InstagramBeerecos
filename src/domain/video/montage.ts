import { z } from "zod";
import type { CaptionWord, Edit, Range } from "./edit.ts";

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
  accent: "violet",
  ranges: [{ fromMs: 0, toMs: durationMs }],
  subtitles: true,
  voiceGain: 1,
  custom: [],
  sounds: [],
});

/** Nom du fichier de la prise, tiré du chemin de stockage. */
export const videoNameOf = (videoPath: string) => videoPath.slice(videoPath.lastIndexOf("/") + 1);

export const keptMs = (ranges: Range[]) => ranges.reduce((n, r) => n + r.toMs - r.fromMs, 0);
