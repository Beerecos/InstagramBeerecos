import Image from "next/image";
import { cn } from "@/components/ui/cn";

/** Libellé de l'application : distinct du logo, jamais intégré au dessin officiel. */
export const APP_NAME = "Instagram BeeRecos";

/**
 * Logo officiel BeeMarketing (charte 2026, fichier validé par Cédric le 2026-10-25, identique à celui de BeeMarketing :
 * symbole BeeRecos + « Bee » noir + « Marketing » bleu #2851FF). Il n'existe pas de version blanche officielle : sur fond
 * sombre, le logo est posé sur une carte blanche (jamais recoloré, détouré, déformé ni retapé).
 */
const SRC = "/brand/beemarketing-logo-officiel.png";
const RATIO = 143 / 608;

export function Logo({ variant = "auto", width = 150, className, priority }: { variant?: "auto" | "white"; width?: number; className?: string; priority?: boolean }) {
  const height = Math.round(width * RATIO);
  const img = <Image src={SRC} alt="BeeMarketing" width={width} height={height} priority={priority} className="select-none" />;
  // Sur fond sombre (page de connexion, mode sombre) : carte blanche pour garder les couleurs du logo.
  if (variant === "white") return <span className={cn("inline-flex w-fit self-start rounded-xl bg-white px-3 py-2", className)}>{img}</span>;
  return <span className={cn("inline-flex dark:rounded-xl dark:bg-white dark:px-3 dark:py-2", className)}>{img}</span>;
}
