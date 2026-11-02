// Jeu d'icônes SVG pour la composition finale (Lot b) — PUR, testable.
// Icônes de type « ligne » (line icons) minimalistes, cohérentes avec la maquette (blanc, fin).
// Dessinées à la main (formes géométriques simples) dans une grille 24×24 — aucune dépendance
// externe (CSP-safe) et aucun asset copyright. Le trait hérite de la couleur du groupe parent.

export type IconName =
  | "people" | "idea" | "growth" | "network" | "formation" | "digital"
  | "calendar" | "clock" | "location" | "quote" | "arrow" | "dot";

// Contenu interne d'un SVG 24×24 (le trait/fill est appliqué par le groupe parent).
export const ICONS: Record<IconName, string> = {
  people:
    '<circle cx="8" cy="8" r="3.2"/><circle cx="16.5" cy="9" r="2.6"/>' +
    '<path d="M2.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M15 14.5c2.6.2 4.5 2.1 4.5 4.5"/>',
  idea:
    '<path d="M12 3a6 6 0 0 0-3.5 10.8c.6.4 1 1.1 1 1.8V17h5v-1.4c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>' +
    '<path d="M9.5 20h5"/><path d="M10.5 22h3"/>',
  growth:
    '<path d="M3 17l5-5 3.5 3.5L20 8"/><path d="M15 8h5v5"/>',
  network:
    '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/>' +
    '<path d="M12 7.2v4M10.3 12.2 6.3 16M13.7 12.2 17.7 16"/>',
  formation:
    '<path d="M2.5 8.5 12 4l9.5 4.5L12 13 2.5 8.5Z"/><path d="M6 10.5V15c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5"/><path d="M21.5 8.5V14"/>',
  digital:
    '<path d="M5 20V13"/><path d="M12 20V8"/><path d="M19 20V4"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/>',
  clock:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  location:
    '<path d="M12 21s6.5-5.2 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.8 12 21 12 21Z"/><circle cx="12" cy="10.3" r="2.4"/>',
  quote:
    '<path d="M6 15c-1.7 0-3-1.3-3-3s1.3-3 3-3c0-2 0-3 3-4M17 15c-1.7 0-3-1.3-3-3s1.3-3 3-3c0-2 0-3 3-4"/>',
  arrow:
    '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
  dot:
    '<circle cx="12" cy="12" r="3"/>',
};

// Choisit une icône pertinente d'après le texte d'un item de liste (déterministe).
export function iconForText(text: string): IconName {
  const t = text.toLowerCase();
  if (/(rencontr|dirigeant|personnes|membre|réseau|reseau|contact)/.test(t)) return "network";
  if (/(échang|echang|enjeux|idée|idee|conseil)/.test(t)) return "idea";
  if (/(opportunit|créer|creer|business|croissance|projet)/.test(t)) return "growth";
  if (/(formation|compétence|competence|apprend|certifi)/.test(t)) return "formation";
  if (/(digital|outil|innov|ia\b|numérique|numerique)/.test(t)) return "digital";
  return "dot";
}

// Icône associée à un rôle d'information (date/heure/lieu).
export function iconForRole(role: string): IconName | null {
  if (role === "date") return "calendar";
  if (role === "time") return "clock";
  if (role === "location") return "location";
  if (role === "quote") return "quote";
  return null;
}
