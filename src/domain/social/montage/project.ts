import { buildZip, type ZipEntry } from "../reel-story/zip";
import { takeStrip, type CaptionWord, type Edit } from "./edit";
import { buildEditComposition } from "./edit-composition";
import { usedMedia } from "./media";
import { END_LOGO, END_VIDEO, STUDIO_LOGO } from "./brand";
import { usedMattes } from "./matte";
import { ANIMATIONS } from "./registry";
import { SFX_FILES } from "./fx";
import { usedSfxFiles } from "./sons";

/**
 * Projet Hyperframes complet d'un montage (index.html + prises + polices + GSAP + logo officiel), assemblé en ZIP pour
 * le rendu en ligne HeyGen. MÊME composition que l'aperçu de l'écran Montage (buildEditComposition) ; seules les prises
 * changent d'adresse (fichiers du ZIP au lieu des URL signées). `loadAsset` lit un fichier de public/hyperframes/.
 */

export const MONTAGE_GSAP = "gsap-3.14.2.min.js";
export const MONTAGE_ASSETS = [
  "fonts/poppins-latin-300-normal.woff2",
  "fonts/poppins-latin-500-normal.woff2",
  "fonts/poppins-latin-600-normal.woff2",
  "fonts/poppins-latin-700-normal.woff2",
  "fonts/caveat-latin-500-normal.woff2",
  MONTAGE_GSAP,
  END_LOGO.baseline.file,
  END_LOGO.plain.file,
  END_VIDEO.file,
  STUDIO_LOGO.file,
];

/** Le ZIP est limité à 200 Mo par HeyGen : les prises (toutes ensemble) doivent laisser la place aux ressources. */
export const MAX_RENDER_VIDEO_BYTES = 190 * 1024 * 1024;

export type MontageProject = { zip: Uint8Array; files: string[]; html: string };

/** HeyGen refuse un projet de plus de 200 Mo (prise + médias + ressources). */
export const MAX_PROJECT_BYTES = 200 * 1024 * 1024;

/**
 * Fichiers vidéo d'un montage, dans l'ordre de la bande (une seule prise : `video`), puis les détourages réellement
 * utilisés par un titre derrière le sujet (lot S5) : ils comptent dans les 190 Mo des prises.
 */
export const takeFiles = (edit: Edit) => [...takeStrip(edit).map((t) => t.file), ...usedMattes(edit, ANIMATIONS)];

/** `video` : octets d'une prise, par nom de fichier (une seule prise : le contenu de `edit.video` suffit). */
export async function buildMontageProject(edit: Edit, captions: CaptionWord[], video: Uint8Array | ((file: string) => Promise<Uint8Array>), loadAsset: (path: string) => Promise<Uint8Array>, loadMedia?: (file: string) => Promise<Uint8Array>): Promise<MontageProject> {
  const html = buildEditComposition(edit, captions, { assetBase: ".", mediaBase: "." });
  const entries: ZipEntry[] = [{ path: "index.html", data: new TextEncoder().encode(html) }];
  for (const file of takeFiles(edit)) {
    const data = typeof video === "function" ? await video(file) : video;
    if (!data?.byteLength) throw new Error(`${Object.values(edit.mattes ?? {}).includes(file) ? "Détourage" : "Prise"} introuvable : ${file}`);
    entries.push({ path: file, data });
  }
  const takesBytes = entries.slice(1).reduce((n, e) => n + e.data.byteLength, 0);
  if (takesBytes > MAX_RENDER_VIDEO_BYTES) throw new Error("Prises et détourages trop lourds pour le rendu en ligne (190 Mo au plus en tout) : exportez-les plus légers.");
  // Sons et images de la bibliothèque, à côté de la composition (mediaBase « . »).
  for (const file of usedMedia(edit)) {
    if (!loadMedia) throw new Error(`Média de la bibliothèque introuvable : ${file}`);
    const data = await loadMedia(file);
    if (!data?.length) throw new Error(`Média de la bibliothèque introuvable : ${file}`);
    entries.push({ path: file, data });
  }
  // Accents sonores des animations (Studio, 2026-11-11) : ajoutés seulement quand le montage les active.
  // Effets SFX Kit : seulement les fichiers qui sonnent (un effet muet n'est pas embarqué).
  const sfx = new Set(usedSfxFiles(edit));
  for (const path of [...MONTAGE_ASSETS, ...(edit.effetsSonores?.actif ? Object.values(SFX_FILES) : []), ...sfx]) {
    let data: Uint8Array | undefined;
    try { data = await loadAsset(path); } catch (e) { if (!sfx.has(path)) throw e; }
    if (!data?.length) throw new Error(sfx.has(path) ? `Effet sonore introuvable : ${path.split("/").pop()?.replace(/\.flac$/, "")} (remplacez-le ou supprimez-le)` : `Ressource de rendu introuvable : ${path}`);
    entries.push({ path, data });
  }
  if (entries.reduce((n, e) => n + e.data.byteLength, 0) > MAX_PROJECT_BYTES) throw new Error("Projet trop lourd pour le rendu en ligne (200 Mo au plus avec les médias) : allégez la prise ou retirez des médias.");
  return { zip: buildZip(entries), files: entries.map((e) => e.path), html };
}
