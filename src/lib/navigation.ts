export type NavItem = { href: string; label: string; icon: string; mobile?: boolean };

/** Navigation principale (desktop) ; `mobile` = présent dans la barre compacte. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Mes réels", icon: "clapperboard", mobile: true },
  { href: "/library", label: "Bibliothèque", icon: "library", mobile: true },
  { href: "/settings", label: "Paramètres", icon: "settings", mobile: true },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
