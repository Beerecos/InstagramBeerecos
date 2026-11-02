import { BASELINE, BRAND_NAME } from "./brand";
import type { Edit } from "./edit";

/**
 * CONTRÔLE DE CHARTE DES VIDÉOS MONTÉES (charte BeeRecos + prompt maître des réseaux sociaux). Bloquant : nom de marque
 * mal écrit (toujours « BeeRecos ») ou baseline déformée dans un texte affiché. Avertissements (planche contact) :
 * pas de logo de fin, logo de fin sans baseline ou trop tôt. Les couleurs et polices des animations
 * viennent toutes de brand.ts (vérifié par test) : il n'y a rien à contrôler à la main.
 */

/** Textes affichés par une animation (réglages texte ou liste). */
export const shownTexts = (props: Record<string, unknown>) =>
  Object.values(props).flatMap((v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []));

/** Fautes de charte d'un texte : « Beerecos », « Bee Recos », « BEERECOS »… et toute baseline qui n'est pas l'exacte. */
export function charteIssues(text: string): string[] {
  const issues: string[] = [];
  const brand = [...new Set([...text.matchAll(/bee\s?-?recos/gi)].map((m) => m[0]).filter((m) => m !== BRAND_NAME))];
  if (brand.length) issues.push(`« ${brand.join(" », « ")} » : écrire ${BRAND_NAME}`);
  const baselines = [...text.matchAll(/#?\s*mon\s*r[ée]seau\s*c['’]?\s*est\s*ton\s*r[ée]seau/gi)].map((m) => m[0]).filter((m) => m !== BASELINE);
  if (baselines.length) issues.push(`baseline à écrire exactement ${BASELINE} (une ligne, sans espace ni accent)`);
  return issues;
}

/** Erreurs bloquantes d'un montage (chaque animation, chaque texte). */
export function charteErrors(edit: Edit): string[] {
  return edit.custom.flatMap((c, i) => shownTexts(c.props).flatMap((t) => charteIssues(t).map((x) => `• custom[${i}] (${c.name}) → ${x}`)));
}

/** Avertissements de charte pour la planche contact (ne bloquent pas). */
export function charteWarnings(edit: Edit): string[] {
  const warnings: string[] = [];
  const end = edit.ranges[edit.ranges.length - 1]?.toMs ?? 0;
  const logo = edit.custom.find((c) => c.name === "logo-fin");
  if (edit.outro) {
    if (!edit.outro.baseline) warnings.push(`Logo de fin sans la baseline ${BASELINE}.`);
  } else if (!logo) warnings.push("Pas de logo BeeRecos de fin (conclusion du prompt maître : logo officiel et baseline).");
  else {
    if (logo.props.baseline === false) warnings.push(`Logo de fin sans la baseline ${BASELINE}.`);
    if (end - logo.fromMs > 6000) warnings.push("Logo de fin posé plus de 6 s avant la fin : il doit clore la vidéo.");
  }
  return warnings;
}
