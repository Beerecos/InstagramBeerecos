import { KIT_ANIMATIONS, type AnimationDef } from "./animations.ts";
import { USER_ANIMATIONS } from "./mes-animations/registre.ts";

/** Registre complet utilisé par la composition : kit, puis mes-animations (qui gagnent à nom égal). */
export const ANIMATIONS: Record<string, AnimationDef> = { ...KIT_ANIMATIONS, ...USER_ANIMATIONS };

/** Origine d'une animation, pour le catalogue. */
export const animationSource = (name: string) => (Object.hasOwn(USER_ANIMATIONS, name) ? "mes-animations" : "kit");
