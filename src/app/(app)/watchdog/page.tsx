import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { ActivityFeed } from "@/components/missions/activity-feed";
import { AgentAvatar } from "@/components/missions/agent-avatar";
import { DemoBadge } from "@/components/missions/task-status";
import { HealthBadge, WatchdogFindings } from "@/components/missions/watchdog-findings";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, CardHeader } from "@/components/ui";
import { AGENTS } from "@/domain/missions/agents";
import { WORKER_AGENT_KEYS } from "@/domain/missions/types";
import { agentHealth } from "@/domain/missions/watchdog";
import { watchdogReport } from "@/server/missions/service";
import { runWatchdogAction } from "../_actions/missions";

export const metadata: Metadata = { title: "Chien de garde" };

export default function WatchdogPage() {
  return (
    <>
      <PageHeader
        eyebrow="Surveillance"
        title="Chien de garde"
        description="Il surveille chaque agent sur chaque mission : tâches bloquées, erreurs, validations oubliées, livrables vides, boucles coûteuses. Il répare ce qui est sûr et vous signale le reste. Aucune IA : des règles vérifiables."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-2" />}>
        <Report />
      </Suspense>
    </>
  );
}

async function Report() {
  const { inspections, activity, tasks } = await watchdogReport();
  const active = inspections.filter((i) => i.mission.status !== "done");
  const global = active.length ? Math.round(active.reduce((n, i) => n + i.health, 0) / active.length) : 100;
  const critical = active.flatMap((i) => i.findings).filter((f) => f.severity === "critical").length;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AgentAvatar agent="watchdog" size="lg" />
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold text-ink-1">Santé globale <HealthBadge health={global} /></p>
              <p className="text-sm text-ink-3">{active.length} mission(s) active(s) surveillée(s) · {critical} alerte(s) critique(s)</p>
            </div>
          </div>
          <form action={runWatchdogAction}>
            <Button type="submit" size="sm" icon={<ShieldCheck size={14} />}>Lancer une inspection</Button>
          </form>
        </div>
      </Card>

      <section aria-labelledby="missions-surveillees">
        <h2 id="missions-surveillees" className="mb-3 text-sm font-semibold text-ink-2">Missions</h2>
        {inspections.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {inspections.map((i) => (
              <Card key={i.missionId}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <HealthBadge health={i.health} />
                  {i.mission.isDemo ? <DemoBadge /> : null}
                  <Link href={`/missions/${i.missionId}`} className="min-w-0 flex-1 truncate font-medium text-ink-1 hover:text-brand">{i.mission.title}</Link>
                </div>
                <WatchdogFindings findings={i.findings} empty={i.mission.status === "done" ? "Mission terminée." : "Rien à signaler."} />
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-3">Aucune mission à surveiller pour l&apos;instant.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Agents" description="Part des tâches sans erreur ni blocage, toutes missions confondues." />
          <ul className="divide-y divide-line">
            {WORKER_AGENT_KEYS.map((key) => {
              const h = agentHealth(tasks, key);
              return (
                <li key={key} className="flex items-center gap-3 py-2">
                  <AgentAvatar agent={key} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-1">{AGENTS[key].name}</span>
                  <span className="text-xs text-ink-3 tabular-nums">{h.total} tâche(s){h.errors ? ` · ${h.errors} erreur(s)` : ""}{h.stuck ? ` · ${h.stuck} en attente` : ""}</span>
                  {h.health === null ? <span className="text-xs text-ink-3">—</span> : <HealthBadge health={h.health} />}
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="h-fit lg:col-span-2">
          <CardHeader title="Interventions du chien de garde" />
          <ActivityFeed events={activity} emptyLabel="Aucune intervention pour l'instant." />
        </Card>
      </div>
    </div>
  );
}
