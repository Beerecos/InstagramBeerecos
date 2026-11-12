import { z } from "zod";
import type { Edit } from "./edit";

/**
 * BIBLIOTHÈQUE DE MÉDIAS DU STUDIO (lot S3, Video Agent Kit §7 : « Bibliothèque », « Sons ») : sons et images posés
 * sur un montage. edit.json les désigne par leur NOM DE FICHIER (sounds[].file, animation « image » → fichier) ; ce
 * nom est unique dans la bibliothèque et devient un fichier du projet envoyé au rendu. Chaque média porte sa licence.
 * Les polices ne s'importent pas : la charte n'autorise que Poppins et Caveat (baseline), déjà fournies au rendu.
 */

export const MEDIA_KINDS = ["son", "image", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const MEDIA_EXTENSIONS: Record<MediaKind, readonly string[]> = { son: ["mp3", "wav", "m4a", "aac", "ogg"], image: ["png", "jpg", "jpeg", "webp"], video: ["mp4", "mov", "webm"] };
export const MEDIA_MAX_BYTES: Record<MediaKind, number> = { son: 20 * 1024 * 1024, image: 10 * 1024 * 1024, video: 200 * 1024 * 1024 };
export const MEDIA_KIND_LABELS: Record<MediaKind, string> = { son: "Son", image: "Image", video: "Clip vidéo" };

/** Média tel que le Studio le voit. */
export type MediaItem = { id: string; kind: MediaKind; title: string; fileName: string; durationMs: number | null; licence: string; sourceUrl: string | null; url?: string | null };
/** Ce que les contrôles ont besoin de savoir d'un média. */
export type MediaRef = { fileName: string; kind: MediaKind };

export const newMediaSchema = z.object({
  kind: z.enum(MEDIA_KINDS),
  title: z.string().trim().min(1, "Donnez un titre au média.").max(120),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
  licence: z.string().trim().min(2, "Indiquez la licence du média (ex. « Pixabay Content License », « Photo BeeRecos »).").max(200),
  sourceUrl: z.string().trim().regex(/^https:\/\//, "La source doit être une adresse https://").max(500).optional().or(z.literal("").transform(() => undefined)),
});

/**
 * Nom de fichier du média : base simple (accents retirés), suffixe court tiré de l'identifiant (unicité), extension
 * vérifiée pour le type. Null si l'extension ne correspond pas au type demandé.
 */
export function mediaFileName(original: string, kind: MediaKind, id: string): string | null {
  const m = original.trim().match(/^(.*)\.([A-Za-z0-9]+)$/);
  if (!m) return null;
  const ext = m[2].toLowerCase();
  if (!MEDIA_EXTENSIONS[kind].includes(ext)) return null;
  const base = [...m[1].normalize("NFD")].filter((c) => { const k = c.charCodeAt(0); return k < 0x300 || k > 0x36f; }).join("")
    .replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase();
  return `${base || kind}-${id.replace(/-/g, "").slice(0, 8)}.${ext}`;
}

/** Noms de fichiers de la bibliothèque utilisés par un montage (sons, son des animations, images), sans doublon. */
export function usedMedia(edit: Edit): string[] {
  const files = new Set<string>(edit.sounds.map((s) => s.file));
  if (edit.rythme?.sonAnimations) files.add(edit.rythme.sonAnimations);
  for (const c of edit.custom) if (c.name === "image" && typeof c.props.fichier === "string") files.add(c.props.fichier);
  for (const b of edit.broll ?? []) files.add(b.file);
  // Images des mosaïques (Studio, lot 2).
  for (const l of edit.miseEnPage ?? []) for (const f of l.images ?? []) files.add(f);
  return [...files];
}

/** Chaque son et chaque image d'un montage doit exister dans la bibliothèque, avec le bon type. */
export function mediaErrors(edit: Edit, library: MediaRef[]): string[] {
  const kindOf = new Map(library.map((x) => [x.fileName, x.kind]));
  const errors: string[] = [];
  edit.sounds.forEach((s, i) => {
    if (kindOf.get(s.file) !== "son") errors.push(`• sounds[${i}] → « ${s.file} » n'est pas un son de la bibliothèque`);
  });
  const son = edit.rythme?.sonAnimations;
  if (son && kindOf.get(son) !== "son") errors.push(`• rythme.sonAnimations → « ${son} » n'est pas un son de la bibliothèque`);
  edit.custom.forEach((c, i) => {
    if (c.name !== "image") return;
    const f = String(c.props.fichier ?? "");
    if (kindOf.get(f) !== "image") errors.push(`• custom[${i}] → « ${f} » n'est pas une image de la bibliothèque`);
  });
  (edit.broll ?? []).forEach((b, i) => {
    if (kindOf.get(b.file) !== "video") errors.push(`• broll[${i}] → « ${b.file} » n'est pas un clip vidéo de la bibliothèque`);
  });
  (edit.miseEnPage ?? []).forEach((l, i) => (l.images ?? []).forEach((f, j) => {
    if (kindOf.get(f) !== "image") errors.push(`• miseEnPage[${i}].images[${j}] → « ${f} » n'est pas une image de la bibliothèque`);
  }));
  return errors;
}
