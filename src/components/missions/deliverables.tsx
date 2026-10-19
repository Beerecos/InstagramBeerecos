import { PillarTag } from "@/components/ui/pillar-tag";
import type { AgentOutput } from "@/domain/missions/types";

const PLATFORM: Record<string, string> = { instagram: "Instagram", linkedin: "LinkedIn", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", email: "Email", landing: "Page d'atterrissage" };

/** Affiche la production d'un agent : résumé, décisions, livrables, limites. Jamais de raisonnement interne. */
export function AgentOutputView({ output }: { output: AgentOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-ink-1">{output.summary}</p>
      {output.decisions.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Décisions</p>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">{output.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
      ) : null}
      {output.deliverables.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Livrables</p>
          {output.deliverables.map((d, i) => (
            <article key={i} className="rounded-xl bg-surface-0 p-3 ring-1 ring-line">
              <header className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h4 className="font-medium text-ink-1">{d.title}</h4>
                {d.platform ? <span className="text-xs text-ink-3">{PLATFORM[d.platform]}</span> : null}
                {d.pillar ? <PillarTag pillar={d.pillar} /> : null}
              </header>
              <p className="whitespace-pre-line text-ink-2">{d.content}</p>
            </article>
          ))}
        </div>
      ) : null}
      {output.limitations.length > 0 ? (
        <div className="rounded-xl bg-[#fdf1d6] p-3 text-[#6b4700] dark:bg-[#3a2e10] dark:text-[#f6c860]">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Limites signalées par l&apos;agent</p>
          <ul className="list-disc space-y-1 pl-5">{output.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
