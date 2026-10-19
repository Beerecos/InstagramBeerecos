import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Target } from "lucide-react";
import { AgentAvatar } from "@/components/missions/agent-avatar";
import { DemoBadge, MissionStatusBadge } from "@/components/missions/task-status";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState } from "@/components/ui";
import { MISSION_TEMPLATES } from "@/domain/missions/templates";
import { listMissions } from "@/server/missions/queries";

export const metadata: Metadata = { title: "Missions" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export default function MissionsPage() {
  return (
    <>
      <PageHeader eyebrow="Missions" title="Missions de l'équipe" description="Chaque objectif devient une mission : un plan, des tâches, des agents responsables et des validations." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-surface-2" />}>
        <MissionList />
      </Suspense>
    </>
  );
}

async function MissionList() {
  const missions = await listMissions();
  if (missions.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Target />} title="Aucune mission">Donnez un objectif à Queen Bee depuis l&apos;accueil ou la barre en bas de l&apos;écran.</EmptyState>
      </Card>
    );
  }
  return (
    <ul className="space-y-3">
      {missions.map((m) => (
        <li key={m.id}>
          <Link href={`/missions/${m.id}`} className="block rounded-card bg-surface-1 p-5 ring-1 ring-line transition hover:ring-brand">
            <div className="flex flex-wrap items-center gap-2">
              <MissionStatusBadge status={m.status} />
              {m.isDemo ? <DemoBadge /> : null}
              <span className="text-xs text-ink-3">{MISSION_TEMPLATES[m.template].label} · {dateFmt.format(new Date(m.createdAt))}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink-1">{m.title}</h2>
            <p className="text-sm text-ink-2">{m.objective}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex -space-x-1.5">{m.agents.map((a) => <AgentAvatar key={a} agent={a} size="sm" />)}</div>
              <div className="flex w-48 items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={m.progress.total} aria-valuenow={m.progress.done} aria-label="Progression">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${m.progress.total ? (m.progress.done / m.progress.total) * 100 : 0}%` }} />
                </div>
                <span className="text-xs tabular-nums text-ink-3">{m.progress.done}/{m.progress.total}</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
