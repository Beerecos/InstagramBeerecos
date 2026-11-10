import type { CustomAnimation } from "./suggest";

/**
 * BEESTYLES (refonte du Studio, 2026-11-10) : « je veux pouvoir choisir mes animations, pas grave si je n'ai pas le
 * détourage ». Un style = le choix des animations que la pose automatique utilise pour l'accroche, les idées fortes et le
 * mot « à retenir ». Configuration seulement : le texte vient toujours de ce qui est dit (standard.ts), le rendu est le
 * même moteur. Avec un détourage, l'accroche et « à retenir » peuvent toujours passer derrière la personne.
 */

/** Animations d'un mot ou d'une courte phrase, interchangeables (même texte, autre mise en scène). */
export const WORD_ANIMATIONS = ["onglet", "titre", "mot-impact", "titre-profondeur", "papier-dechire"] as const;
export type WordAnimation = (typeof WORD_ANIMATIONS)[number];
export const WORD_LABEL: Record<WordAnimation, string> = {
  onglet: "Cartouche", titre: "Titre", "mot-impact": "Mot impact", "titre-profondeur": "Titre 3D", "papier-dechire": "Papier déchiré",
};

export type Look = { accroche: WordAnimation; idee: WordAnimation; retenir: WordAnimation };

export const BEE_STYLES = ["standard", "dynamic", "clean", "business", "story", "punch"] as const;
export type BeeStyle = (typeof BEE_STYLES)[number];
export const BEE_STYLE: Record<BeeStyle, { label: string; hint: string; look: Look }> = {
  standard: { label: "Standard", hint: "Cartouches partout (le style d'origine)", look: { accroche: "onglet", idee: "onglet", retenir: "onglet" } },
  dynamic: { label: "Bee Dynamic", hint: "Titre 3D d'accroche, mots qui claquent", look: { accroche: "titre-profondeur", idee: "mot-impact", retenir: "mot-impact" } },
  clean: { label: "Clean", hint: "Titres sobres, cartouches discrets", look: { accroche: "titre", idee: "onglet", retenir: "titre" } },
  business: { label: "Business", hint: "Titre net, idées en cartouche, fin marquante", look: { accroche: "titre", idee: "onglet", retenir: "mot-impact" } },
  story: { label: "Story", hint: "Papier déchiré, ton récit", look: { accroche: "titre-profondeur", idee: "papier-dechire", retenir: "titre" } },
  punch: { label: "Punch", hint: "Un grand mot à chaque idée", look: { accroche: "mot-impact", idee: "mot-impact", retenir: "mot-impact" } },
};

/** Propriétés d'une animation de mot pour un texte dit (bornées aux limites de chaque animation). */
export function wordProps(name: WordAnimation, text: string): Record<string, unknown> {
  const t = text.trim();
  if (name === "onglet") return { texte: t.slice(0, 48), variante: "blanc" };
  if (name === "papier-dechire") return { items: [t.slice(0, 38)] };
  if (name === "mot-impact") return { texte: t.slice(0, 48) };
  if (name === "titre-profondeur") return { texte: t.slice(0, 60) };
  return { texte: t.slice(0, 80) };
}

/** Texte d'une animation de mot (pour la changer d'animation sans retaper le texte). */
export function wordText(a: CustomAnimation): string | null {
  if (!(WORD_ANIMATIONS as readonly string[]).includes(a.name) && a.name !== "titre-derriere") return null;
  const p = a.props as { texte?: unknown; items?: unknown };
  if (typeof p.texte === "string") return p.texte;
  return Array.isArray(p.items) && typeof p.items[0] === "string" ? p.items.join(" · ") : null;
}

/** Même texte, autre animation (mêmes temps). */
export function swapWordAnimation(a: CustomAnimation, name: WordAnimation): CustomAnimation {
  const text = wordText(a);
  if (text === null) return a;
  return { ...a, name, props: wordProps(name, text) };
}

/** Style posé sur ce montage, d'après les libellés des animations posées automatiquement (« Bee Dynamic · accroche »). */
export function activeStyle(custom: CustomAnimation[]): BeeStyle | null {
  for (const k of BEE_STYLES) if (custom.some((a) => a.label?.startsWith(`${BEE_STYLE[k].label} · `))) return k;
  return null;
}
