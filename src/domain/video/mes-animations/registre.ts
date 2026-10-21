import type { AnimationDef } from "../animations.ts";

/**
 * Animations créées pour BeeRecos (par Claude avec /nouvelle-animation, ou à la main).
 * Une animation = un fichier `<nom>.ts` dans ce dossier qui exporte `default defineAnimation({ … })`,
 * puis une ligne ici. À nom égal, elle remplace celle du kit. Ce dossier n'est jamais réécrit par le kit.
 */
export const USER_ANIMATIONS: Record<string, AnimationDef> = {};
