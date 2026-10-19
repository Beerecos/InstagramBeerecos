import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AgentAvatar } from "@/components/missions/agent-avatar";
import { AutoRefresh } from "@/components/missions/auto-refresh";
import { DemoBadge, TaskStatusBadge } from "@/components/missions/task-status";
import { PageHeader } from "@/components/shell/page-header";
import { AGENTS } from "@/domain/missions/agents";
import { getTeam } from "@/server/missions/queries";

export const metadata: Metadata = { title: "Équipe IA" };

const STATE = {
  working: { label: "Travaille", cls: "bg-accent-soft text-brand" },
  waiting_validation: { label: "Attend votre validation", cls: "bg-[#fdf1d6] text-[#6b4700] dark:bg-[#3a2e10] dark:text-[#f6c860]" },
  blocked: { label: "En attente", cls: "bg-surface-2 text-ink-2" },
  idle: { label: "Disponible", cls: "bg-surface-2 text-ink-3" },
} as const;

export default function TeamPage() {
  return (
    <>
      <PageHeader eyebrow="Équipe IA" title="Votre équipe marketing" description="Chaque agent a un rôle précis. Ce que vous voyez ici est l'état réel de leurs tâches." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-2" />}>
        <Team />
      </Suspense>
    </>
  );
}

async function Team() {
  const team = await getTeam();
  return (
    <>
      <AutoRefresh active={team.some((a) => a.state === "working")} />
      <article className="mb-4 flex items-center gap-4 rounded-card bg-brand p-5 text-white">
        <AgentAvatar agent="queen_bee" size="lg" />
        <div>
          <h2 className="text-lg font-semibold">Queen Bee</h2>
          <p className="text-sm text-white/85">{AGENTS.queen_bee.instructions}</p>
        </div>
      </article>
      <Link href="/watchdog" className="mb-4 flex items-center gap-4 rounded-card bg-surface-1 p-5 ring-1 ring-line transition hover:ring-brand">
        <AgentAvatar agent="watchdog" size="lg" />
        <div>
          <h2 className="font-semibold text-ink-1">Chien de garde</h2>
          <p className="text-sm text-ink-3">{AGENTS.watchdog.instructions}</p>
        </div>
      </Link>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {team.map((a) => (
          <article key={a.agent} className="flex flex-col rounded-card bg-surface-1 p-5 ring-1 ring-line">
            <header className="flex items-start gap-3">
              <AgentAvatar agent={a.agent} size="lg" active={a.state === "working"} />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-ink-1">{AGENTS[a.agent].name}</h2>
                <p className="text-sm text-ink-3">{AGENTS[a.agent].role}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE[a.state].cls}`}>{STATE[a.state].label}</span>
            </header>
            <dl className="mt-4 flex-1 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-3">Mission</dt>
                <dd className="text-ink-1">
                  {a.current ? (
                    <span className="flex flex-wrap items-center gap-2">« {a.current.title} » <TaskStatusBadge status={a.current.status} /> {a.current.isDemo ? <DemoBadge /> : null}</span>
                  ) : (
                    <span className="text-ink-3">Aucune tâche en cours</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-3">Progression</dt>
                <dd className="tabular-nums text-ink-1">{a.done} / {a.total} tâches terminées</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-3">Dernière action</dt>
                <dd className="line-clamp-2 text-ink-2">{a.lastAction ?? "—"}</dd>
              </div>
            </dl>
            {a.current ? (
              <Link href={`/missions/${a.current.missionId}#task-${a.current.id}`} className="mt-4 text-sm font-medium text-brand">Voir le travail →</Link>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
