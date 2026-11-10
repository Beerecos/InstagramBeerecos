import type { CaptionWord } from "./edit";
import { ANIMATIONS } from "./registry";
import { fieldsOf, type CustomAnimation } from "./suggest";

/**
 * « ✨ Proposer avec l'IA » dans les réglages d'une animation (2026-11-10, « plus intuitif, adapté et dopé à l'IA ») :
 * l'IA écrit les textes de CETTE animation à partir de ce qui est dit autour d'elle. Contrôle déterministe : seulement
 * les champs texte de l'animation, longueurs de l'animation, aucun chiffre qui n'a pas été prononcé.
 */

/** Ce qui est dit autour de l'animation (1,5 s avant, 1,5 s après). */
export function spokenAround(words: CaptionWord[], a: Pick<CustomAnimation, "fromMs" | "toMs">): string {
  return words.filter((w) => w.endMs > a.fromMs - 1500 && w.startMs < a.toMs + 1500).map((w) => w.text).join(" ").replace(/\s+/g, " ").trim();
}

export function textFields(name: string) {
  const def = ANIMATIONS[name];
  return def ? fieldsOf(def).filter((f) => f.kind === "text" || f.kind === "list").filter((f) => !["fichier", "fond", "baseline"].includes(f.key)) : [];
}

export function animationAiBrief(name: string, spoken: string): string {
  const def = ANIMATIONS[name];
  const fields = textFields(name).map((f) => `- ${f.key}${f.kind === "list" ? " (liste de 2 à 4 éléments très courts)" : ""}${f.optional ? " (facultatif : \"\" si inutile)" : ""}`).join("\n");
  return `TEXTES D'UNE ANIMATION DE REEL — BeeRecos
Animation : ${def?.label ?? name}. ${def?.description ?? ""}
Écris des textes très courts et percutants (2 à 6 mots, capitales autorisées), tirés de ce que dit la personne à ce moment. Aucun chiffre, nom ou fait qui n'est pas dans la phrase. Ton direct, tutoiement.
Champs :
${fields}
Réponds UNIQUEMENT par un objet JSON avec ces clés.

CE QUI EST DIT À CE MOMENT :
${spoken || "(rien)"}`;
}

/** Propriétés validées par l'animation, ou une raison si la proposition est inutilisable. */
export function parseAnimationAi(raw: string, a: CustomAnimation, spoken: string): { props: Record<string, unknown> } | { error: string } {
  const def = ANIMATIONS[a.name];
  if (!def) return { error: "Animation inconnue." };
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); } catch { return { error: "Proposition illisible : réessaie." }; }
  const said = new Set((spoken.match(/\d+(?:[.,]\d+)?/g) ?? []).map((d) => d.replace(",", ".")));
  const props: Record<string, unknown> = { ...a.props };
  let filled = 0;
  for (const f of textFields(a.name)) {
    const v = data[f.key];
    const clean = (t: unknown) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim() : "");
    const value = f.kind === "list" ? (Array.isArray(v) ? v.map(clean).filter(Boolean) : []) : clean(v);
    const texts = ([value].flat() as string[]).filter(Boolean);
    if (texts.some((t) => (t.match(/\d+(?:[.,]\d+)?/g) ?? []).some((d) => !said.has(d.replace(",", "."))))) return { error: "La proposition contenait un chiffre qui n'a pas été dit : réessaie." };
    if (f.optional && !texts.length) { delete props[f.key]; continue; }
    if (texts.length) { props[f.key] = value; filled++; }
  }
  if (!filled) return { error: "Proposition illisible : réessaie." };
  // Raccourcir aux limites de l'animation si besoin.
  for (let round = 0; round < 4; round++) {
    const r = def.props.safeParse(props);
    if (r.success) return { props: r.data as Record<string, unknown> };
    let changed = false;
    for (const issue of r.error.issues) {
      const [key, index] = issue.path as (string | number)[];
      const max = (issue as { maximum?: unknown }).maximum;
      if (issue.code !== "too_big" || typeof key !== "string" || typeof max !== "number") continue;
      if (typeof index === "number" && Array.isArray(props[key])) { const items = [...(props[key] as string[])]; items[index] = String(items[index]).slice(0, max).trim(); props[key] = items; changed = true; }
      else if (typeof props[key] === "string") { props[key] = (props[key] as string).slice(0, max).trim(); changed = true; }
      else if (Array.isArray(props[key])) { props[key] = (props[key] as unknown[]).slice(0, max); changed = true; }
    }
    if (!changed) break;
  }
  return { error: "Proposition incomplète pour cette animation : réessaie ou écris le texte." };
}
