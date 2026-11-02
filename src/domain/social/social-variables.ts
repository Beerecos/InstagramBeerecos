// Moteur de variables des templates visuels (Lot 3a) — PUR, testable.
// Résout les {{variables}} d'un texte (titre de slide, CTA, légende) depuis le contexte réel
// (club / événement / membre). §3 : une variable non renseignée n'est JAMAIS inventée — elle est
// listée dans `missing` et remplacée par un marqueur « donnée manquante » que l'utilisateur complète.
//
// Les variables MÉDIA ({{photo_club}}, {{photo_evenement}}, {{photo_membre}}, {{logo_club}}, ...) ne
// sont pas résolues ici (elles le sont par media-resolver.ts, qui pointe vers un fichier de la
// médiathèque) : elles sont reconnues comme « variables média » et signalées à part.

import type { TemplateData } from "./social-templates";

// Variables TEXTE reconnues (vocabulaire métier stable — français).
export const TEXT_VARIABLES = [
  "nom_club", "ville", "lieu", "adresse",
  "date_evenement", "heure_evenement", "nom_evenement", "theme_evenement",
  "lien_club", "cta",
  "prenom", "nom", "profession", "entreprise", "citation",
] as const;
export type TextVariable = (typeof TEXT_VARIABLES)[number];

// Variables MÉDIA (résolues par la médiathèque, pas ici).
export const MEDIA_VARIABLES = [
  "photo_club", "photo_evenement", "photo_membre",
  "logo_beerecos", "logo_club", "logo_partenaire", "logo_lieu", "logo_evenement",
] as const;
export type MediaVariable = (typeof MEDIA_VARIABLES)[number];

export function isTextVariable(v: string): v is TextVariable {
  return (TEXT_VARIABLES as readonly string[]).includes(v);
}
export function isMediaVariable(v: string): v is MediaVariable {
  return (MEDIA_VARIABLES as readonly string[]).includes(v);
}

export type VariableContext = Partial<Record<TextVariable, string>>;

/** Construit le contexte de variables TEXTE depuis les données structurées d'un template. */
export function buildVariableContext(data: TemplateData): VariableContext {
  const club = data.club ?? {};
  const ev = data.event ?? {};
  const mb = data.member ?? {};
  const pick = (...vals: (string | undefined | null)[]): string | undefined => {
    for (const v of vals) { const t = (v ?? "").toString().trim(); if (t) return t; }
    return undefined;
  };
  const ctx: VariableContext = {
    nom_club: pick(club.name, ev.club),
    ville: pick(club.city, ev.city),
    lieu: pick(ev.location),
    adresse: pick(ev.address),
    date_evenement: pick(ev.date),
    heure_evenement: pick(ev.time),
    nom_evenement: pick(ev.name),
    theme_evenement: pick(ev.theme),
    lien_club: pick(club.link, ev.url),
    prenom: pick(mb.first_name),
    nom: pick(mb.last_name),
    profession: pick(mb.profession),
    entreprise: pick(mb.company),
    citation: pick(mb.quote),
  };
  // Retire les clés indéfinies pour un contexte propre.
  for (const k of Object.keys(ctx) as TextVariable[]) if (ctx[k] === undefined) delete ctx[k];
  return ctx;
}

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type ResolveResult = {
  text: string;
  missing: string[];       // variables TEXTE connues mais non renseignées
  mediaVars: string[];     // variables MÉDIA rencontrées (à résoudre via la médiathèque)
  unknown: string[];       // variables non reconnues (ni texte ni média)
};

/** Marqueur inséré pour une variable texte manquante (jamais inventée). */
export function missingMarker(v: string): string {
  return `⟨donnée manquante : ${v}⟩`;
}

/**
 * Remplace les {{variables}} texte par leur valeur ; laisse un marqueur pour les manquantes ;
 * conserve les variables média telles quelles (résolues ailleurs) ; dédoublonne les listes.
 */
export function resolveVariables(text: string, ctx: VariableContext): ResolveResult {
  const missing = new Set<string>();
  const mediaVars = new Set<string>();
  const unknown = new Set<string>();
  const out = text.replace(VARIABLE_RE, (_m, name: string) => {
    if (isMediaVariable(name)) { mediaVars.add(name); return `{{${name}}}`; }
    if (isTextVariable(name)) {
      const val = (ctx[name] ?? "").toString().trim();
      if (val) return val;
      missing.add(name);
      return missingMarker(name);
    }
    unknown.add(name);
    return `{{${name}}}`;
  });
  return { text: out, missing: [...missing], mediaVars: [...mediaVars], unknown: [...unknown] };
}
