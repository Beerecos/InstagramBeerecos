export type NavItem = { href: string; label: string; icon: string; mobile?: boolean };

/** Ordre et libellés de la navigation principale (desktop) ; `mobile` = présent dans la barre compacte. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: "home", mobile: true },
  { href: "/creer", label: "Créer", icon: "plus", mobile: true },
  { href: "/studio", label: "Studio", icon: "clapperboard" },
  { href: "/medias", label: "Médias", icon: "library" },
  { href: "/calendrier", label: "Calendrier", icon: "calendar", mobile: true },
  { href: "/conversations", label: "Conversations", icon: "messages", mobile: true },
  { href: "/leads", label: "Leads", icon: "users" },
  { href: "/clubs", label: "Clubs", icon: "map" },
  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/strategie", label: "Stratégie IA", icon: "compass" },
  { href: "/reglages", label: "Réglages", icon: "settings" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
