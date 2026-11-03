export type NavItem = { href: string; label: string; icon: string; mobile?: boolean };

/** Navigation principale (desktop) ; `mobile` = présent dans la barre compacte. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/scripts", label: "Scripts", icon: "script", mobile: true },
  { href: "/", label: "Studio", icon: "clapperboard", mobile: true },
  { href: "/reels", label: "Mes réels", icon: "layers" },
  { href: "/library", label: "Bibliothèque", icon: "library", mobile: true },
  { href: "/calendar", label: "Calendrier", icon: "calendar", mobile: true },
  { href: "/settings", label: "Paramètres", icon: "settings" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
