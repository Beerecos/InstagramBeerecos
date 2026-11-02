import { FONT_FILES, LOGOS, PICTOGRAM } from "./brand";
import { buildStoryComposition } from "./composition";
import { buildSoundtrack, encodeWav } from "./soundtrack";
import type { StorySpec } from "./spec";
import { buildStudioComposition, type StudioSpec } from "./studio";
import { buildZip, type ZipEntry } from "./zip";

/**
 * Projet Hyperframes complet d'un Reel (index.html + bande son + polices + GSAP + fichiers officiels de marque),
 * assemblé en ZIP pour le rendu en ligne. MÊME composition que l'aperçu de BeeMarketing (buildStoryComposition).
 * `loadAsset` lit un fichier de public/hyperframes/ (disque en local, URL publique de l'application en production).
 */

export const GSAP_FILE = "gsap-3.14.2.min.js";
export const PROJECT_ASSETS: string[] = [
  ...FONT_FILES.map((f) => `fonts/${f.file}`),
  GSAP_FILE,
  LOGOS.endHorizontal.file,
  LOGOS.endBaseline.file,
  PICTOGRAM.blue,
  PICTOGRAM.white,
];

export type RenderProject = { zip: Uint8Array; files: string[]; html: string };

export async function buildRenderProject(spec: StorySpec, loadAsset: (path: string) => Promise<Uint8Array>): Promise<RenderProject> {
  const html = buildStoryComposition(spec, { assetBase: ".", soundtrackSrc: "bande-son.wav" });
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [
    { path: "index.html", data: enc.encode(html) },
    { path: "bande-son.wav", data: encodeWav(buildSoundtrack(spec, [])) },
  ];
  for (const path of PROJECT_ASSETS) {
    const data = await loadAsset(path);
    if (!data?.length) throw new Error(`Ressource de rendu introuvable : ${path}`);
    entries.push({ path, data });
  }
  return { zip: buildZip(entries), files: entries.map((e) => e.path), html };
}

/** Projet d'une vidéo studio : la vidéo fournie (dans le ZIP) + habillage BeeRecos. */
export async function buildStudioProject(spec: StudioSpec, video: Uint8Array, loadAsset: (path: string) => Promise<Uint8Array>): Promise<RenderProject> {
  const html = buildStudioComposition(spec, { assetBase: ".", videoSrc: "studio.mp4" });
  const entries: ZipEntry[] = [{ path: "index.html", data: new TextEncoder().encode(html) }, { path: "studio.mp4", data: video }];
  for (const path of PROJECT_ASSETS.filter((p) => !p.includes("logo"))) {
    const data = await loadAsset(path);
    if (!data?.length) throw new Error(`Ressource de rendu introuvable : ${path}`);
    entries.push({ path, data });
  }
  return { zip: buildZip(entries), files: entries.map((e) => e.path), html };
}
