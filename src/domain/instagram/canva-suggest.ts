/**
 * Suggestions IA pour les zones de texte d'un modèle Canva (demande de Cédric, 2026-11-10). L'IA propose les textes
 * rédactionnels (titre, sous-titre, accroche…) à partir du sujet et de la légende du post. Les zones factuelles (date,
 * horaire, lieu, adresse, club, prix, téléphone…) ne sont jamais inventées : gardées seulement si chaque chiffre et
 * chaque nom propre proposés figurent déjà dans le contexte, sinon laissées vides à remplir.
 */

const FACTUAL = /(date|jour|horaire|heure|lieu|adresse|ville|club|salle|prix|tarif|tel|telephone|mail|site|nom|prenom|metier|entreprise|code)/;
const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const isFactualField = (name: string) => FACTUAL.test(fold(name).replace(/[^a-z]/g, ""));

export function canvaSuggestBrief(fields: string[], context: string): string {
  return `TEXTES D'UN VISUEL CANVA — BeeRecos
Propose un texte court pour chaque zone du modèle, à partir du contexte du post ci-dessous. Respecte la marque BeeRecos (ton direct, tutoiement, aucune promesse chiffrée).
Règles :
- Titre : 3 à 7 mots. Sous-titre ou accroche : une phrase courte. Aucun texte de plus de 120 caractères.
- Zones factuelles (${fields.filter(isFactualField).join(", ") || "aucune"}) : recopie l'information exacte du contexte ; si elle n'y est pas, mets "" (n'invente jamais une date, une heure, un lieu, un nom ou un chiffre).
Réponds UNIQUEMENT par un objet JSON dont les clés sont exactement les noms des zones : ${JSON.stringify(fields)}.

CONTEXTE DU POST :
${context.trim() || "(vide)"}`;
}

/** Faits vérifiables d'un texte : nombres et mots à majuscule (noms propres). */
const facts = (t: string) => [...(t.match(/\d+/g) ?? []), ...(t.match(/\b\p{Lu}[\p{L}'’-]{2,}/gu) ?? []).map(fold)];

/** Lit la réponse : seulement les zones du modèle, textes bornés ; zone factuelle gardée si ses faits viennent du contexte. */
export function parseCanvaSuggestions(raw: string, fields: string[], context: string): { texts: Record<string, string>; skipped: string[] } {
  const m = raw.match(/\{[\s\S]*\}/);
  let data: Record<string, unknown> = {};
  try { data = m ? JSON.parse(m[0]) : {}; } catch { data = {}; }
  const ctx = fold(context);
  const ctxFacts = new Set(facts(context).map(fold));
  const texts: Record<string, string> = {};
  const skipped: string[] = [];
  for (const f of fields) {
    const v = typeof data[f] === "string" ? (data[f] as string).replace(/\s+/g, " ").trim().slice(0, 120) : "";
    if (!v) { if (isFactualField(f)) skipped.push(f); continue; }
    if (isFactualField(f) && !facts(v).every((x) => ctxFacts.has(fold(x)) || ctx.includes(fold(x)))) { skipped.push(f); continue; }
    texts[f] = v;
  }
  return { texts, skipped };
}
