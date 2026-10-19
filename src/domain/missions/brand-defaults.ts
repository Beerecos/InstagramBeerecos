import type { BrandMemory } from "./types";

/** Mémoire de marque initiale, issue de la charte BeeRecos 2026 et du cahier des charges. Modifiable dans /brand. */
export const DEFAULT_BRAND_MEMORY: BrandMemory = {
  company: "BeeRecos",
  description: "1er centre d'affaires digitalisé : un réseau d'affaires où les membres se recommandent mutuellement, se forment (BeeSchool) et se digitalisent avec l'IA.",
  positioning: "Le réseau d'affaires monétisé : la recommandation comme levier de chiffre d'affaires mesurable, avec formation et outils digitaux.",
  targets: ["Dirigeants de TPE/PME", "Indépendants et professions libérales", "Commerciaux et développeurs d'affaires"],
  offers: ["Clubs d'affaires BeeRecos (réunions de recommandation)", "BeeSchool (formations)", "Solutions de digitalisation IA (BeeMarketing, BeeBot, BeeLead)"],
  tone: "Professionnel, humain, direct, entrepreneurial, accessible, premium ; sans jargon IA ni ton de gourou ; tutoiement sur Instagram.",
  allowedWords: ["recommandation", "réseau monétisé", "club", "membres", "opportunités", "BeeSchool"],
  forbiddenWords: ["gourou", "devenir riche", "argent facile", "secret que personne", "garanti à 100 %"],
  ctas: ["Commente CLUB et je t'invite à découvrir un club BeeRecos.", "Viens assister gratuitement à une réunion BeeRecos près de chez toi."],
  references: ["Charte graphique BeeRecos (octobre 2026)", "Guide OPUS motion design"],
  pillarWeights: { reseau_monetise: 50, formation: 25, digitalisation_ia: 25 },
};
