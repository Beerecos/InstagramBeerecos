import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCheck, Target, UsersRound } from "lucide-react";
import { ActivityFeed } from "@/components/missions/activity-feed";
import { AgentAvatar } from "@/components/missions/agent-avatar";
import { QueenBeeComposer } from "@/components/missions/queen-bee-composer";
import { Card, CardHeader, FunnelChart, MetricCard } from "@/components/ui";
import { AGENTS } from "@/domain/missions/agents";
import { getCurrentUser } from "@/server/auth/dal";
import { FUNNEL_STAGES } from "@/server/dashboard/home";
import { getDashboard, getTeam } from "@/server/missions/queries";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="mx-auto max-w-3xl pt-2 text-center sm:pt-6">
        <Suspense fallback={<div className="mx-auto mb-3 h-5 w-40 animate-pulse rounded bg-surface-2" />}>
          <Greeting />
        </Suspense>
        <h1 className="text-3xl font-light tracking-tight text-ink-1 sm:text-5xl">
          Que voulez-vous <span className="font-semibold text-brand">accomplir</span> aujourd&apos;hui&nbsp;?
        </h1>
        <div className="mt-8 text-left">
          <QueenBeeComposer />
        </div>
      </section>

      <Suspense fallback={<div className="h-80 animate-pulse rounded-card bg-surface-2" />}>
        <Today />
      </Suspense>
    </div>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  if (!user.organization) redirect("/bienvenue");
  return <p className="mb-3 text-sm text-ink-3">Bonjour {user.firstName || ""} · {user.organization.name}</p>;
}

async function Today() {
  const [d, team] = await Promise.all([getDashboard(), getTeam()]);
  return (
    <div className="space-y-8">
      <section aria-labelledby="aujourdhui">
        <h2 id="aujourdhui" className="mb-3 text-sm font-semibold text-ink-2">Aujourd&apos;hui</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile href="/approvals" icon={<CheckCheck size={18} />} label="Contenus à valider" value={String(d.pendingApprovals)} highlight={d.pendingApprovals > 0} />
          <Tile href="/missions" icon={<Target size={18} />} label="Missions actives" value={String(d.activeMissions)} />
          <Tile href="/team" icon={<UsersRound size={18} />} label="Agents au travail" value={String(d.activeAgents)} />
          <Tile href="/calendar" icon={<CalendarClock size={18} />} label="Publications prévues" value="—" hint="Connexion Instagram requise" />
        </div>
        {d.urgent.length > 0 ? (
          <div className="mt-3 rounded-2xl bg-[#fdf1d6] p-4 text-sm text-[#6b4700] dark:bg-[#3a2e10] dark:text-[#f6c860]">
            <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={16} aria-hidden /> Actions requises</p>
            <ul className="space-y-1">
              {d.urgent.map((t) => (
                <li key={t.id}>
                  <Link href={`/missions/${t.missionId}`} className="underline-offset-2 hover:underline">{t.title} — {t.waitingReason ?? t.error}</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="equipe">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="equipe" className="text-sm font-semibold text-ink-2">Votre équipe IA</h2>
          <Link href="/team" className="inline-flex items-center gap-1 text-sm text-brand">Voir l&apos;équipe <ArrowRight size={14} aria-hidden /></Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {team.map((a) => (
            <Link key={a.agent} href="/team" className="flex w-44 shrink-0 items-center gap-3 rounded-2xl bg-surface-1 p-3 ring-1 ring-line transition hover:ring-brand">
              <AgentAvatar agent={a.agent} active={a.state === "working"} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-1">{AGENTS[a.agent].name}</span>
                <span className="block truncate text-xs text-ink-3">{STATE_LABEL[a.state]}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Performance" description="Des vues aux adhésions. Données affichées uniquement quand elles sont réelles." />
          <div className="mb-5 grid grid-cols-3 gap-3">
            <MetricCard label="Prospects" value={null} />
            <MetricCard label="Visites" value={null} emphasis hint="KPI principal" />
            <MetricCard label="Adhésions" value={null} />
          </div>
          <FunnelChart title="Tunnel commercial" stages={FUNNEL_STAGES.map((s) => ({ ...s, value: null }))} />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Activité de l'équipe" action={<Link href="/missions" className="text-sm text-brand">Missions</Link>} />
          <ActivityFeed events={d.activity} emptyLabel="Donnez un objectif à Queen Bee pour mettre l'équipe au travail." />
        </Card>
      </div>
    </div>
  );
}

const STATE_LABEL = { working: "Travaille", waiting_validation: "Attend votre validation", blocked: "En attente", idle: "Disponible" } as const;

function Tile({ href, icon, label, value, hint, highlight }: { href: string; icon: React.ReactNode; label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`flex flex-col gap-2 rounded-2xl p-4 ring-1 transition hover:ring-brand ${highlight ? "bg-accent-soft ring-brand/30" : "bg-surface-1 ring-line"}`}>
      <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-brand">{icon}</span>
      <span className="text-xs text-ink-3">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-ink-1">{value}</span>
      {hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
    </Link>
  );
}
