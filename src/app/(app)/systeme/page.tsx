import type { Metadata } from "next";
import { Suspense } from "react";
import { History } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { listRecentAuditEvents } from "@/server/audit/audit";

export const metadata: Metadata = { title: "Système" };

export default function SystemPage() {
  return (
    <>
      <PageHeader eyebrow="Système" title="Runs & journal" description="Comprendre ce qui s'est passé — « pourquoi cette vidéo n'a pas été publiée ? » — sans lire les logs Vercel." />
      <ComingSoon phase={8} features={["Jobs, agent runs et appels d'outils", "Erreurs, retries, latence, fournisseur", "Coûts par job et par jour", "Raison lisible de chaque échec"]}>
        <Card>
          <CardHeader title="Journal d'audit" description="Publications, suppressions, DM automatiques, leads, invitations, changements d'Autopilot." />
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-surface-2" />}>
            <AuditList />
          </Suspense>
        </Card>
      </ComingSoon>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

async function AuditList() {
  const result = await listRecentAuditEvents();
  if (result.kind === "forbidden") return <EmptyState icon={<History />} title="Réservé aux administrateurs" />;
  if (result.events.length === 0) return <EmptyState icon={<History />} title="Aucun événement pour l'instant" />;
  return (
    <ul className="divide-y divide-line text-sm">
      {result.events.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
          <time className="w-32 shrink-0 tabular-nums text-ink-3">{dateFmt.format(new Date(e.created_at))}</time>
          <code className="text-xs text-ink-1">{e.action}</code>
          <span className="text-ink-2">{e.entity_type}</span>
          <span className="ml-auto text-xs text-ink-3">{e.actor_type}</span>
        </li>
      ))}
    </ul>
  );
}
