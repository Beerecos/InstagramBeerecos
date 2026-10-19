export type NavItem = { href: string; label: string; icon: string; mobile?: boolean };

/** Navigation principale (desktop) ; `mobile` = présent dans la barre compacte. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: "home", mobile: true },
  { href: "/missions", label: "Missions", icon: "target", mobile: true },
  { href: "/approvals", label: "Validations", icon: "check", mobile: true },
  { href: "/team", label: "Équipe IA", icon: "team" },
  { href: "/studio", label: "Studio", icon: "layers" },
  { href: "/video", label: "Vidéo", icon: "clapperboard" },
  { href: "/calendar", label: "Calendrier", icon: "calendar" },
  { href: "/campaigns", label: "Campagnes", icon: "megaphone" },
  { href: "/leads", label: "Leads", icon: "users" },
  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/library", label: "Bibliothèque", icon: "library" },
  { href: "/brand", label: "Marque", icon: "badge" },
  { href: "/settings", label: "Paramètres", icon: "settings" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
