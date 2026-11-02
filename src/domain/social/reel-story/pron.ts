/**
 * Prononciation des voix off BeeRecos (règles de Cédric, feedback-log du 2026-10-23) : le texte affiché ne change
 * jamais, seule la graphie donnée à la synthèse vocale est réécrite.
 *  - « BeeRecos » se dit « Bi-reu-co » ; « CLUB » se dit « Cleub ».
 *  - Liaisons obligatoires écrites pour la voix (sans graphie, « les informations » sortait sans /z/, contrôle au
 *    spectrogramme) : déterminant + nom commençant par une voyelle ou un h muet.
 * `restoreWord` rend au mot prononcé sa graphie écrite (sous-titres calés sur les temps de la voix).
 */

/** Mots de marque et mots-clés : [écrit, prononcé]. */
export const PRONUNCIATION: [RegExp, string][] = [
  [/\bbeerecos\b/gi, "Bi-reu-co"],
  [/\bCLUB\b/g, "Cleub"],
  // Retour de Cédric : Audrey omet le t dans « peut-être ».
  [/\bpeut(?:[-‐‑]|\s+)[eê]tre\b/gi, "peu-têtre"],
];

/** Débit posé conseillé pour Audrey ; le style Motion permet de le régler explicitement. */
export const DEFAULT_VOICE_SPEED = 0.92;

/**
 * Liaisons obligatoires : déterminant (ou adjectif court antéposé) devant un mot commençant par une voyelle.
 * Les liaisons facultatives (« c'est un », « tout à fait ») et le h ne sont pas forcés.
 */
const LIAISON: [RegExp, string][] = [
  [/\b(les|des|mes|tes|ses|nos|vos|leurs|ces|aux)\s+([aàâeéèêiîoôuûyœ])/gi, "$1 z$2"],
  [/\b(mon|ton|son|un|aucun|on)\s+([aàâeéèêiîoôuûyœ])/gi, "$1 n$2"],
  [/\b(petit|grand)\s+([aàâeéèêiîoôuûyœ])/gi, "$1 t$2"],
];

/** Texte prononcé : marque phonétisée, liaisons obligatoires écrites, mots en capitales lus comme des mots (sauf IA). */
export function spokenFrench(line: string): string {
  let out = line;
  for (const [re, say] of PRONUNCIATION) out = out.replace(re, say);
  for (const [re, rep] of LIAISON) out = out.replace(re, rep);
  return out.replace(/\b[A-ZÀ-Ý]{2,}\b/g, (w) => (w === "IA" ? w : w.toLowerCase())).replace(/\s+/g, " ").trim();
}

/** Mot renvoyé par la voix → mot écrit (« zinformations » → « informations », « Cleub » → « CLUB »). */
export function restoreWord(spoken: string, written: string[]): string {
  const bare = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/gi, "").toLowerCase();
  const b = bare(spoken);
  const hit = written.find((w) => bare(w) === b)
    ?? written.find((w) => /^[znt]/i.test(b) && bare(w) === b.slice(1))
    ?? (b === "cleub" ? written.find((w) => bare(w) === "club") : undefined)
    ?? (b === "bireuco" ? written.find((w) => bare(w) === "beerecos") : undefined)
    ?? (b === "peutetre" ? written.find((w) => bare(w) === "peutetre")
      ?? written.map((w, i) => `${w} ${written[i + 1] ?? ""}`).find((w) => bare(w) === "peutetre") : undefined);
  if (!hit) return spoken;
  const tail = spoken.match(/[.,;:!?…»]+$/)?.[0] ?? "";
  return hit.replace(/[.,;:!?…»]+$/, "") + tail;
}
