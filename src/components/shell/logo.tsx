import Image from "next/image";
import { cn } from "@/components/ui/cn";

/**
 * Logo officiel BeeMarketing (fichiers fournis par BeeRecos, jamais redessinés).
 * Règles de la charte : pas de contour, d'ombre, de rotation, de déformation ni d'insertion dans une forme ;
 * versions blanches uniquement sur fond bleu ou noir ; largeur minimale numérique 150 px pour le logo complet.
 */
export function Logo({ variant = "color", width = 180, className, priority }: { variant?: "color" | "white"; width?: number; className?: string; priority?: boolean }) {
  const src = variant === "white" ? "/brand/beemarketing-logo-white.png" : "/brand/beemarketing-logo.png";
  const w = Math.max(150, width);
  return <Image src={src} alt="BeeMarketing" width={w} height={Math.round((w * 410) / 1860)} className={cn("select-none", className)} priority={priority} />;
}

/** Symbole seul (version secondaire officielle). */
export function LogoSymbol({ variant = "color", size = 28, className }: { variant?: "color" | "white"; size?: number; className?: string }) {
  const src = variant === "white" ? "/brand/beemarketing-symbol-white.png" : "/brand/beemarketing-symbol.png";
  return <Image src={src} alt="" aria-hidden width={Math.round((size * 215) / 389)} height={size} className={cn("select-none", className)} />;
}
