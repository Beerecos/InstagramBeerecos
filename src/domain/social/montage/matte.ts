import { takeIndexAt, takeStrip, type Edit } from "./edit";
import type { AnimationDef } from "./animations";

/**
 * TITRE DERRIÈRE LE SUJET (lot S5, étape B du prompt maître réseaux sociaux). La personne est détourée SUR LE POSTE
 * (`npx hyperframes remove-background`, modèle u2net_human_seg, Apache-2.0, aucun service tiers), le détourage est
 * envoyé à côté de sa prise, puis la composition l'empile au-dessus du titre : la silhouette passe devant les lettres.
 * Ce module dit quelle prise a un détourage et refuse un titre « derrière » posé sur une prise qui n'en a pas.
 */

/** Commande à lancer sur le poste pour détourer une prise (même fichier que celui envoyé au Montage). */
export const MATTE_COMMAND = (take: string) => `npx hyperframes@0.8.126 remove-background ${take} -o ${matteNameFor(take)}`;
/** Nom conseillé du détourage d'une prise : prise.mp4 → prise.matte.webm. */
export const matteNameFor = (take: string) => `${take.replace(/\.[^.]+$/, "")}.matte.webm`;
/** Taille maximale d'un détourage envoyé (VP9 alpha ≈ 1 Mo pour 4 s en 1080p). */
export const MATTE_MAX_BYTES = 100 * 1024 * 1024;
/** Écart de durée toléré entre une prise et son détourage (encodage WebM). */
export const MATTE_DURATION_TOLERANCE_MS = 500;

export const isBehind = (name: string, registry: Record<string, AnimationDef>) => Boolean(Object.prototype.hasOwnProperty.call(registry, name) && registry[name].behind);

/** Détourage de la prise qui contient cet instant de la bande (null s'il n'y en a pas). */
export function matteAt(edit: Pick<Edit, "video" | "takes" | "mattes">, ms: number): string | null {
  const strip = takeStrip(edit);
  return edit.mattes?.[strip[takeIndexAt(strip, ms)].file] ?? null;
}

export const hasMattes = (edit: Pick<Edit, "mattes">) => Object.keys(edit.mattes ?? {}).length > 0;

const sec = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

/** Un titre derrière le sujet exige le détourage de sa prise, et ne déborde pas sur la prise suivante. */
export function behindErrors(edit: Edit, registry: Record<string, AnimationDef>): string[] {
  const strip = takeStrip(edit);
  return edit.custom.flatMap((c, i) => {
    if (!isBehind(c.name, registry)) return [];
    const take = takeIndexAt(strip, c.fromMs);
    if (!matteAt(edit, c.fromMs)) return [`• custom[${i}] → « ${c.name} » à ${sec(c.fromMs)} : envoyez d'abord le détourage de la prise ${take + 1} (carte Prises)`];
    if (takeIndexAt(strip, Math.max(c.fromMs, c.toMs - 1)) !== take) return [`• custom[${i}] → « ${c.name} » à ${sec(c.fromMs)} : déborde sur la prise suivante`];
    return [];
  });
}

/** Détourages réellement utilisés (une prise sans titre derrière le sujet n'envoie pas le sien au rendu). */
export function usedMattes(edit: Edit, registry: Record<string, AnimationDef>): string[] {
  const out = new Set<string>();
  for (const c of edit.custom) {
    const m = isBehind(c.name, registry) ? matteAt(edit, c.fromMs) : null;
    if (m) out.add(m);
  }
  return [...out];
}
