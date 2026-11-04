export type NavItem = { href: string; label: string; icon: string; mobile?: boolean };

/** Navigation principale (desktop) ; `mobile` = présent dans la barre compacte. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Post", icon: "send", mobile: true },
  { href: "/calendar", label: "Calendrier", icon: "calendar", mobile: true },
  { href: "/settings", label: "Paramètres", icon: "settings", mobile: true },
];

/** Retour à BeeMarketing (cet espace est l'onglet « Réseaux sociaux » de beemarketing.pro, option A du 2026-11-04). */
export const BEEMARKETING_URL = "https://beemarketing.pro";

/** L'accueil est l'onglet Post : il reste actif dans l'éditeur de post, les scripts et le Studio d'un réel. */
const HOME_SECTIONS = ["/post", "/reels", "/scripts"];

export function isActive(pathname: string, href: string): boolean {
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return href === "/" ? pathname === "/" || HOME_SECTIONS.some(under) : under(href);
}
