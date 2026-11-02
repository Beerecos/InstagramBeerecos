import type { AnimationDef } from "../animations";

/**
 * Animations créées pour BeeRecos (par Claude avec /nouvelle-animation, ou à la main).
 * Une animation = un fichier `<nom>.ts` dans ce dossier qui exporte `default defineAnimation({ … })`,
 * puis une ligne ici. À nom égal, elle remplace celle du kit. Ce dossier n'est jamais réécrit par le kit.
 */
import papier from "./papier-dechire";
import bandeau from "./bandeau-double";
import piliers from "./piliers-progressifs";
import impact from "./mot-impact";
export const USER_ANIMATIONS: Record<string, AnimationDef> = {
  "papier-dechire": papier, "bandeau-double": bandeau, "piliers-progressifs": piliers, "mot-impact": impact,
};
