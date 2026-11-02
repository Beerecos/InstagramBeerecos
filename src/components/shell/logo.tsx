import Image from "next/image";
import { cn } from "@/components/ui/cn";

/** Libellé de l'application : distinct du logo, jamais intégré au dessin officiel. */
export const APP_NAME = "Instagram BeeRecos";

/**
 * Logo officiel BeeRecos (SVG extraits sans modification du brandguide 2026) suivi du libellé « Instagram » en texte.
 * Règles de la charte : pas de contour, d'ombre, de rotation, de déformation ni de retypage du logo ;
 * version blanche uniquement sur fond sombre.
 */
export function Logo({ variant = "auto", width = 150, className, priority }: { variant?: "auto" | "white"; width?: number; className?: string; priority?: boolean }) {
  const height = Math.round((width * 323) / 1146);
  if (variant === "white") {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <Image src="/brand/beerecos-logo-horizontal-white.svg" alt="BeeRecos" width={width} height={height} priority={priority} className="select-none" />
        <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand">Instagram</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image src="/brand/beerecos-logo-horizontal-blue.svg" alt="BeeRecos" width={width} height={height} priority={priority} className="select-none dark:hidden" />
      <Image src="/brand/beerecos-logo-horizontal-white.svg" alt="BeeRecos" width={width} height={height} priority={priority} className="hidden select-none dark:block" />
      <span className="rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Instagram</span>
    </span>
  );
}
