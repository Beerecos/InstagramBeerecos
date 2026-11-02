import { KIT_ANIMATIONS, type AnimationDef } from "./animations";
import { USER_ANIMATIONS } from "./mes-animations/registre";

/** Registre complet utilisé par la composition : kit, puis mes-animations (qui gagnent à nom égal). */
export const ANIMATIONS: Record<string, AnimationDef> = { ...KIT_ANIMATIONS, ...USER_ANIMATIONS };

/**
 * Versions antérieures encore rendables (BeeMotion) : clé « nom@version », ex. « titre@1 » quand « titre » passe en v2.
 * Avant de modifier le rendu d'une animation approuvée : copier sa définition ici, puis incrémenter sa version dans
 * beemotion.ts. Une vidéo validée se rejoue ainsi avec la version qu'elle utilisait.
 */
export const ARCHIVED_ANIMATIONS: Record<string, AnimationDef> = {};

/** Origine d'une animation, pour le catalogue. */
export const animationSource = (name: string) => (Object.prototype.hasOwnProperty.call(USER_ANIMATIONS, name) ? "mes-animations" : "kit");
