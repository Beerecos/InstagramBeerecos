import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Bot, CalendarClock, Clapperboard, Flame, Inbox, Lightbulb, ShieldCheck, Sparkles, Ticket, Upload, Users } from "lucide-react";
import { ButtonLink, Card, CardHeader, EmptyState, FunnelChart, MetricCard } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/dal";
import { getHomeSnapshot } from "@/server/dashboard/home";

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-2" />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  if (!user.organization) redirect("/bienvenue");
  return (
    <header className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">{user.organization?.name ?? "BeeRecos"}</p>
      <h1 className="mt-1 text-4xl font-light tracking-tight text-ink-1 sm:text-6xl">
        Bonjour <span className="font-semibold text-brand">{user.firstName || "à toi"}</span>
      </h1>
    </header>
  );
}

function GreetingSkeleton() {
  return <div className="mb-8 h-24 animate-pulse rounded-2xl bg-surface-2" />;
}

async function Dashboard() {
  const snap = await getHomeSnapshot();
  return (
    <div className="space-y-6">
      <section aria-labelledby="aujourdhui" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <h2 id="aujourdhui" className="sr-only">Aujourd&apos;hui</h2>
        <TodayTile icon={<CalendarClock size={18} />} label="Prochaine publication" value={snap.today.nextPublication ?? "Aucune programmée"} />
        <TodayTile icon={<ShieldCheck size={18} />} label="Contenus à valider" value={String(snap.today.toReview ?? "—")} />
        <TodayTile icon={<Inbox size={18} />} label="DM entrants" value={String(snap.today.inboundDms ?? "—")} />
        <TodayTile icon={<Flame size={18} />} label="Prospects chauds" value={String(snap.today.hotLeads ?? "—")} />
        <TodayTile icon={<Ticket size={18} />} label="Invitations" value={String(snap.today.invitations ?? "—")} />
        <TodayTile icon={<Users size={18} />} label="Visiteurs à venir" value={String(snap.today.upcomingVisitors ?? "—")} />
      </section>

      <section aria-labelledby="kpis">
        <h2 id="kpis" className="mb-3 text-sm font-semibold text-ink-2">Les 30 derniers jours</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="Vues" value={snap.kpis.views} />
          <MetricCard label="Leads" value={snap.kpis.leads} />
          <MetricCard label="Invitations" value={snap.kpis.invitations} />
          <MetricCard label="Visites" value={snap.kpis.visits} emphasis hint="KPI principal" />
          <MetricCard label="Adhésions" value={snap.kpis.memberships} />
        </div>
        {!snap.connected ? (
          <p className="mt-2 text-xs text-ink-3">« — » : donnée pas encore disponible. Les chiffres apparaîtront une fois Instagram et LinkedIn connectés.</p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Du Reel à l'adhésion" description="Chaque étape du tunnel commercial Instagram." />
          <FunnelChart title="Tunnel commercial Instagram, 30 derniers jours" stages={snap.funnel} />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={<span className="inline-flex items-center gap-2"><Lightbulb aria-hidden size={16} className="text-accent" />Insight Claude</span>} />
          {snap.insight ? (
            <p className="text-ink-1">{snap.insight}</p>
          ) : (
            <EmptyState title="Pas encore assez de données">
              Claude formule un insight seulement au-dessus d&apos;un seuil minimum de contenus et de leads. Aucune conclusion n&apos;est tirée d&apos;un petit échantillon.
            </EmptyState>
          )}
        </Card>
      </div>

      <section aria-labelledby="actions">
        <h2 id="actions" className="mb-3 text-sm font-semibold text-ink-2">Que veux-tu faire ?</h2>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/creer/ai" variant="primary" icon={<Bot size={16} />}>Créer une vidéo IA</ButtonLink>
          <ButtonLink href="/creer/human" variant="secondary" icon={<Upload size={16} />}>Importer ma vidéo</ButtonLink>
          <ButtonLink href="/creer/hybrid" variant="secondary" icon={<Sparkles size={16} />}>Créer hybride</ButtonLink>
          <ButtonLink href="/calendrier" variant="secondary" icon={<Clapperboard size={16} />}>Préparer ma semaine</ButtonLink>
          <ButtonLink href="/leads?filtre=chauds" variant="secondary" icon={<Flame size={16} />}>Voir mes leads chauds</ButtonLink>
        </div>
      </section>
    </div>
  );
}

function TodayTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-1 p-4 ring-1 ring-line sm:flex-row sm:items-center sm:gap-3">
      <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-brand">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-ink-3">{label}</p>
        <p className="font-medium text-ink-1 sm:truncate">{value}</p>
      </div>
    </div>
  );
}
