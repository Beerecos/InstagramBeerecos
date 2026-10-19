import type { ContentStage, CreationMode, Pillar } from "@/domain/content";
import { CREATION_MODE_LABELS, PILLAR_LABELS } from "@/domain/content";
import { cn } from "./cn";

const BORDER: Record<Pillar, string> = {
  reseau_monetise: "border-l-pillar-reseau",
  formation: "border-l-pillar-formation",
  digitalisation_ia: "border-l-pillar-ia",
};

export function CalendarItem({ time, title, pillar, mode, stage }: { time: string; title: string; pillar: Pillar; mode: CreationMode; stage: ContentStage }) {
  return (
    <div className={cn("rounded-lg border-l-4 bg-surface-1 px-2 py-1.5 text-xs ring-1 ring-line", BORDER[pillar])} title={`${PILLAR_LABELS[pillar]} · ${CREATION_MODE_LABELS[mode]} · ${stage}`}>
      <span className="font-medium tabular-nums text-ink-2">{time}</span>
      <p className="truncate font-medium text-ink-1">{title}</p>
    </div>
  );
}
