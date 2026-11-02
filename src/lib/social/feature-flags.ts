/**
 * Interrupteurs de fonctionnalités (repris de BeeMarketing `src/lib/feature-flags.ts`, variables NEXT_PUBLIC_*).
 *
 * reelNarrativeEngine — moteur narratif des Reels dans le storyboard du montage et le style « Motion BeeRecos - Dynamique ».
 * Actif par défaut ; NEXT_PUBLIC_REEL_NARRATIVE_ENGINE=0 le masque.
 * reelNarrativeServer — partie serveur (fonction `montage`, action `narrative-propose`). Active par défaut ;
 * NEXT_PUBLIC_REEL_NARRATIVE_SERVER=0 la masque.
 */
export const reelNarrativeEngine = (process.env.NEXT_PUBLIC_REEL_NARRATIVE_ENGINE ?? "1").trim() !== "0";
export const reelNarrativeServer = reelNarrativeEngine && (process.env.NEXT_PUBLIC_REEL_NARRATIVE_SERVER ?? "1").trim() !== "0";
