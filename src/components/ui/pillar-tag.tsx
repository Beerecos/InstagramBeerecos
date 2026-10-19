import { PILLAR_LABELS, type Pillar } from "@/domain/content";
import { cn } from "./cn";

const DOT: Record<Pillar, string> = {
  reseau_monetise: "bg-pillar-reseau",
  formation: "bg-pillar-formation",
  digitalisation_ia: "bg-pillar-ia",
};

/** Le nom du pilier est toujours écrit : la pastille n'est qu'un repère visuel. */
export function PillarTag({ pillar, className }: { pillar: Pillar; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-ink-2", className)}>
      <span aria-hidden className={cn("size-2 rounded-full", DOT[pillar])} />
      {PILLAR_LABELS[pillar]}
    </span>
  );
}
