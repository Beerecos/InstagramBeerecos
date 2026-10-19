import { Bot, Clapperboard, Sparkles } from "lucide-react";
import { CREATION_MODE_LABELS, type ContentStage, type CreationMode, type Pillar } from "@/domain/content";
import { PillarTag } from "./pillar-tag";
import { StatusBadge } from "./status-badge";

const MODE_ICON: Record<CreationMode, typeof Bot> = { ai: Bot, human: Clapperboard, hybrid: Sparkles };

export type ContentCardProps = { title: string; hook?: string; pillar: Pillar; mode: CreationMode; stage: ContentStage; date?: string; cta?: string };

export function ContentCard({ title, hook, pillar, mode, stage, date, cta }: ContentCardProps) {
  const Icon = MODE_ICON[mode];
  return (
    <article className="rounded-2xl bg-surface-1 p-4 ring-1 ring-line transition hover:ring-ink-3">
      <div className="flex items-center justify-between gap-2">
        <PillarTag pillar={pillar} />
        <StatusBadge status={stage} />
      </div>
      <h3 className="mt-3 font-semibold leading-snug text-ink-1">{title}</h3>
      {hook ? <p className="mt-1 line-clamp-2 text-sm text-ink-2">« {hook} »</p> : null}
      <footer className="mt-4 flex items-center gap-3 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1"><Icon aria-hidden size={14} />{CREATION_MODE_LABELS[mode]}</span>
        {cta ? <span>CTA {cta}</span> : null}
        {date ? <time className="ml-auto">{date}</time> : null}
      </footer>
    </article>
  );
}
