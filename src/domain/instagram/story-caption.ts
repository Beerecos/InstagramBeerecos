/**
 * Légende « raconter toute l'histoire » des carrousels InspiBEEz'ness (consigne de Cédric du 2026-11-04, et § 2, 7 et 8
 * du prompt Carrousels BeeRecos du 4 novembre 2026 : presets/inspibeezness.ts).
 * La consigne est envoyée telle quelle à l'IA ; la fin (invitation + hashtags) est imposée mot pour mot par le code,
 * jamais laissée au modèle. Le budget est de 2 000 caractères, invitation et hashtags compris.
 */
export const STORY_BUDGET = 2000;

export const INSPI_CTA = "Tu veux, toi aussi, rencontrer des entrepreneurs inspirants ?\nCommente « INSPI » pour recevoir ton invitation à découvrir un club BeeRecos.";
export const INSPI_HASHTAGS = "#MonReseauCestTonReseau #BeeRecos #InspiBEEzness";
export const INSPI_KEYWORD = "INSPI";
export const INSPI_ENDING = `${INSPI_CTA}\n\n${INSPI_HASHTAGS}`;

export const STORY_RULES = `LÉGENDE — RACONTER TOUTE L'HISTOIRE
Rédige une légende complète, vivante et autonome pour ce carrousel. Une personne qui lit uniquement la légende doit comprendre toute l'histoire : son origine, son développement, ses étapes décisives et son résultat.
Construis le récit dans cet ordre, en l'adaptant au sujet :
1. L'ouverture : une première phrase qui donne envie de découvrir l'histoire.
2. Le contexte : qui sont les protagonistes, quelle est la situation de départ, quel besoin existe.
3. Le déclic : quelle observation, rencontre ou difficulté fait émerger l'idée.
4. La création : comment l'idée devient une solution concrète, quelles décisions comptent.
5. Le lancement : comment le produit, l'entreprise ou le projet rencontre son public.
6. L'évolution : transformations, nouveautés ou étapes importantes après le lancement.
7. Le résultat : où cette histoire conduit, avec les résultats documentés et leur date.
8. La réflexion entrepreneuriale : ce que cette histoire peut nous inspirer, en distinguant clairement cette interprétation des faits (par exemple « à notre avis »).
Écris un récit fluide, en paragraphes courts, avec des transitions naturelles. N'explique les liens entre les événements que lorsque les sources les établissent. Apporte les détails qui ne tiennent pas sur les slides. Va jusqu'au bout de l'histoire : ne t'arrête pas après le déclic et ne renvoie pas au carrousel pour la suite.
Fiabilité : utilise uniquement les faits fournis ci-dessous (texte des slides et sources). N'invente aucun dialogue, difficulté, rebondissement, scène, causalité, chiffre ou date. Attribue les anecdotes à leur source (« selon le récit de la marque »). Date les chiffres de vente ou de croissance. Si un fait manque, n'en crée pas : écris le récit sans lui.
Style : français naturel, concret et vivant. Préserve les noms, dates, faits et nuances utiles. Évite les superlatifs automatiques, les promesses de réussite et les leçons plaquées sur le récit. La légende n'est ni une accroche seule, ni une succession de titres de slides.
Longueur : ${STORY_BUDGET} caractères au total, invitation et hashtags compris ; raccourcis d'abord les détails secondaires en gardant l'origine, les étapes décisives et le résultat.
N'écris PAS l'invitation finale ni les hashtags : ils sont ajoutés automatiquement après ton texte. Ne mets aucune liste de sources dans le texte.`;

/** Brief complet envoyé au générateur : consigne, sujet, puis les faits fournis (seule matière autorisée). */
export function storyBrief(subject: string, facts: string): string {
  return `${STORY_RULES}\n\nSUJET : ${subject.trim()}\n\nFAITS FOURNIS (texte des slides et sources, seule matière autorisée) :\n${facts.trim()}`;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Termine le récit par l'invitation et les hashtags exacts : retire une invitation ou des hashtags que le modèle aurait
 * ajoutés malgré la consigne, puis ajoute la fin officielle.
 */
export function withInspiEnding(story: string): string {
  const lines = story.replace(/\r\n/g, "\n").trim().split("\n");
  while (lines.length) {
    const last = fold(lines[lines.length - 1].trim());
    const isTail = !last || /^(#[\p{L}\p{N}_]+\s*)+$/u.test(lines[lines.length - 1].trim()) || last.includes("commente") || last.includes("entrepreneurs inspirants");
    if (!isTail) break;
    lines.pop();
  }
  return `${lines.join("\n").trim()}\n\n${INSPI_ENDING}`;
}

/** Longueur affichée et contrôle du budget (Instagram limite à 2 200 ; la consigne vise 2 000). */
export function storyLength(text: string) {
  const length = [...text].length;
  return { length, overBudget: length > STORY_BUDGET };
}
