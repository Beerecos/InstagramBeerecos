import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronDown, RotateCw } from "lucide-react";
import { resumeMissionAction } from "@/app/(app)/_actions/missions";
import { ActivityFeed } from "@/components/missions/activity-feed";
import { AgentAvatar } from "@/components/missions/agent-avatar";
import { AutoRefresh } from "@/components/missions/auto-refresh";
import { HealthBadge, WatchdogFindings } from "@/components/missions/watchdog-findings";
import { missionWatchdog } from "@/server/missions/service";
import { AgentOutputView } from "@/components/missions/deliverables";
import { DemoBadge, MissionStatusBadge, TaskStatusBadge } from "@/components/missions/task-status";
import { Button, Card, CardHeader } from "@/components/ui";
import { AGENTS } from "@/domain/missions/agents";
import { MISSION_TEMPLATES } from "@/domain/missions/templates";
import { getMissionWorkspace } from "@/server/missions/queries";

export const metadata: Metadata = { title: "Mission" };

export default function MissionPage({ params }: PageProps<"/missions/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-2" />}>
      <Workspace params={params} />
    </Suspense>
  );
}

async function Workspace({ params }: { params: PageProps<"/missions/[id]">["params"] }) {
  const { id } = await params;
  const [w, guard] = await Promise.all([getMissionWorkspace(id), missionWatchdog(id)]);
  if (!w) notFound();
  const { mission, tasks, activity, progress } = w;
  const agents = [...new Set(tasks.map((t) => t.agent))];
  const working = tasks.some((t) => t.status === "in_progress" || t.status === "analysis") || (mission.status === "planned" && !mission.isDemo);
  const canResume = !mission.isDemo && tasks.some((t) => t.status === "waiting" || t.status === "todo");
  const byId = new Map(tasks.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <AutoRefresh active={working} />
      <header>
        <Link href="/missions" className="text-sm text-ink-3 hover:text-ink-1">← Missions</Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MissionStatusBadge status={mission.status} />
          {mission.isDemo ? <DemoBadge /> : null}
          <span className="text-xs text-ink-3">{MISSION_TEMPLATES[mission.template].label}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-1 sm:text-3xl">{mission.title}</h1>
        <p className="mt-1 max-w-3xl text-ink-2"><span className="font-medium text-ink-1">Objectif :</span> {mission.objective}</p>
      </header>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Équipe mobilisée</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft py-1 pl-1 pr-3 text-sm text-brand"><AgentAvatar agent="queen_bee" size="sm" /> Queen Bee</span>
              {agents.map((a) => (
                <span key={a} className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm text-ink-1">
                  <AgentAvatar agent={a} size="sm" active={tasks.some((t) => t.agent === a && t.status === "in_progress")} /> {AGENTS[a].name}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full sm:w-56">
            <div className="flex justify-between text-xs text-ink-3"><span>Progression</span><span className="tabular-nums">{progress.done}/{progress.total} tâches</span></div>
            <div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
            {canResume ? (
              <form action={resumeMissionAction.bind(null, mission.id)} className="mt-3">
                <Button size="sm" variant="secondary" icon={<RotateCw size={14} />} type="submit">Relancer l&apos;équipe</Button>
              </form>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="workflow">
          <h2 id="workflow" className="mb-3 text-sm font-semibold text-ink-2">Workflow</h2>
          <ol className="relative space-y-3 border-l border-line pl-6">
            {tasks.map((t) => (
              <li key={t.id} id={`task-${t.id}`} className="relative">
                <span aria-hidden className={`absolute -left-[31px] top-5 size-3 rounded-full ring-4 ring-surface-0 ${t.status === "in_progress" ? "bg-brand" : ["done", "validated"].includes(t.status) ? "bg-status-good" : t.status === "error" ? "bg-status-critical" : ["waiting", "to_validate"].includes(t.status) ? "bg-status-warning" : "bg-line"}`} />
                <details className="group rounded-2xl bg-surface-1 ring-1 ring-line open:ring-brand/40" open={["to_validate", "in_progress", "waiting", "error"].includes(t.status)}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                    <AgentAvatar agent={t.agent} active={t.status === "in_progress"} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-ink-3">{AGENTS[t.agent].name}</span>
                      <span className="block font-medium text-ink-1">{t.title}</span>
                      {t.dependsOn.length ? <span className="block text-xs text-ink-3">Après : {t.dependsOn.map((d) => byId.get(d)?.title).join(", ")}</span> : null}
                    </span>
                    <TaskStatusBadge status={t.status} />
                    <ChevronDown aria-hidden size={16} className="text-ink-3 transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-line p-4">
                    {t.waitingReason ? <p className="mb-3 text-sm text-[#6b4700] dark:text-[#f6c860]">{t.waitingReason}</p> : null}
                    {t.error ? <p className="mb-3 text-sm text-status-critical">{t.error}</p> : null}
                    {t.output ? <AgentOutputView output={t.output} /> : !t.waitingReason && !t.error ? <p className="text-sm text-ink-3">{t.status === "in_progress" ? "L'agent travaille…" : "Pas encore produit."}</p> : null}
                    {t.status === "to_validate" ? <Link href="/approvals" className="mt-3 inline-block text-sm font-medium text-brand">Valider dans la boîte de validation →</Link> : null}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </section>
        <div className="space-y-6 lg:col-span-2">
          {guard ? (
            <Card>
              <CardHeader title="Chien de garde" action={<HealthBadge health={guard.health} />} />
              <WatchdogFindings findings={guard.findings} empty={mission.status === "done" ? "Mission terminée." : "Rien à signaler : l'équipe avance."} />
            </Card>
          ) : null}
          <Card className="h-fit">
            <CardHeader title="Activité en direct" />
            <ActivityFeed events={activity} />
          </Card>
        </div>
      </div>
    </div>
  );
}
