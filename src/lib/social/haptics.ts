/**
 * Retour haptique (vibration légère).
 *
 * - Dans l'app native Capacitor (iOS/Android) : vrai haptique via le pont
 *   `window.Capacitor.Plugins.Haptics` (plugin @capacitor/haptics installé côté
 *   natif). On passe par le global injecté au runtime → aucun import du plugin
 *   dans le bundle web (pas de couplage de build, marche même sans le plugin).
 * - Sur le web/PWA Android : repli sur `navigator.vibrate`.
 * - Sur iPhone en Safari/PWA : `navigator.vibrate` n'existe pas → aucun effet
 *   (limitation iOS). Le vrai haptique arrive avec l'app native (voir CAPACITOR.md).
 *
 * Toujours silencieux en cas d'échec (jamais d'erreur remontée à l'UI).
 */
type HapticKind = "light" | "medium" | "success";

export function haptic(kind: HapticKind = "light"): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repris tel quel de BeeMarketing
    const cap = (window as unknown as { Capacitor?: any }).Capacitor;
    if (cap?.isNativePlatform?.() && cap?.Plugins?.Haptics) {
      const H = cap.Plugins.Haptics;
      if (kind === "success") H.notification({ type: "SUCCESS" });
      else H.impact({ style: kind === "medium" ? "MEDIUM" : "LIGHT" });
      return;
    }
  } catch {
    /* pont natif indisponible → repli web */
  }
  try {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    const pattern: number | number[] = kind === "success" ? [8, 40, 14] : kind === "medium" ? 14 : 8;
    nav.vibrate?.(pattern);
  } catch {
    /* pas de vibration disponible → no-op */
  }
}
