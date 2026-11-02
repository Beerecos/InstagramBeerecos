/**
 * Informations VÉRIFIÉES sur BeeRecos que la production automatique a le droit d'utiliser (et rien d'autre).
 * Chaque fait cite sa source dans beerecos-knowledge/. Aucun chiffre de résultat, tarif, témoignage, club
 * ou avantage gratuit : la génération est refusée si le texte en contient (voir generation.ts).
 * Mettre à jour cette liste quand la base de connaissance change — c'est la seule entrée « faits » de l'IA.
 */
export type VerifiedFact = { id: string; pillar: "reseau_monetise" | "formation" | "digitalisation_ia" | "club"; text: string; source: string };

export const VERIFIED_FACTS: VerifiedFact[] = [
  { id: "clubs", pillar: "club", text: "BeeRecos est un réseau de clubs d'affaires pour entrepreneurs et dirigeants.", source: "business.md §1" },
  { id: "reunions", pillar: "club", text: "Chaque club se réunit deux fois par mois, environ deux heures.", source: "business.md §1, faq.md" },
  { id: "invites", pillar: "club", text: "Des invités peuvent découvrir une réunion de club.", source: "faq.md" },
  { id: "piliers", pillar: "club", text: "La valeur repose sur trois piliers : le réseau (recommandations qualifiées), la formation, les outils digitaux et l'IA.", source: "business.md §1" },
  { id: "recos", pillar: "reseau_monetise", text: "Les membres échangent des recommandations qualifiées entre eux : développement commercial mutuel.", source: "business.md §5" },
  { id: "portefeuille", pillar: "reseau_monetise", text: "Les apporteurs d'affaires disposent d'un portefeuille de recommandations.", source: "business.md §3" },
  { id: "formations", pillar: "formation", text: "Les membres ont accès à des formations actionnables.", source: "offers.md" },
  { id: "ia", pillar: "digitalisation_ia", text: "Les membres disposent d'outils IA pour développer leur activité.", source: "offers.md" },
  { id: "crm", pillar: "digitalisation_ia", text: "Un CRM intégré : pipeline, contacts, recommandations.", source: "offers.md (observé)" },
  { id: "beecard", pillar: "digitalisation_ia", text: "Chaque membre a une vitrine publique, la BeeCard.", source: "offers.md (observé)" },
  { id: "digitalise", pillar: "club", text: "Signature de marque : « Un réseau d'affaires digitalisé ».", source: "Brand Guidelines 2026 p. 4" },
];

/** Interdits éditoriaux appliqués à tout texte généré (forbidden-claims.md). */
export const FORBIDDEN_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\d/, reason: "aucun chiffre (résultat, nombre de membres, prix…)" },
  { re: /€|euros?\b|gratuit|offert|garanti|promo/i, reason: "aucun tarif, avantage gratuit ni garantie" },
  { re: /rémunér|commission|rétribu|gagne[rz]?\s+de\s+l'argent/i, reason: "aucune rémunération promise (conditions non documentées)" },
  { re: /n[°o]\s?1\b|le meilleur|la meilleure|leader/i, reason: "aucun superlatif non prouvé" },
  { re: /témoign|«[^»]*»\s*—|avis client/i, reason: "aucun témoignage" },
];
