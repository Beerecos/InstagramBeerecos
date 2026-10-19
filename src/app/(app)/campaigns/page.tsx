import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Megaphone } from "lucide-react";
import { AgentAvatar } from "@/components/missions/agent-avatar";
import { DemoBadge, MissionStatusBadge } from "@/components/missions/task-status";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState } from "@/components/ui";
import { listMissions } from "@/server/missions/queries";

export const metadata: Metadata = { title: "Campagnes" };

const CAMPAIGN_TEMPLATES = new Set(["club_invitation", "lead_campaign", "event_communication", "training_launch"]);
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default function CampaignsPage() {
  return (
    <>
      <PageHeader eyebrow="Campagnes" title="Campagnes" description="Les missions orientées acquisition : invitations club, leads, événements, lancements." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-surface-2" />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const missions = (await listMissions()).filter((m) => CAMPAIGN_TEMPLATES.has(m.template));
  if (missions.length === 0) return <Card><EmptyState icon={<Megaphone />} title="Aucune campagne">Ex. : « Crée une campagne pour inviter des dirigeants de Bayonne à visiter un club ».</EmptyState></Card>;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-ink-3">
          <tr className="border-b border-line">
            <th className="p-4 font-medium">Campagne</th><th className="p-4 font-medium">Objectif</th><th className="p-4 font-medium">Progression</th><th className="p-4 font-medium">Prospects</th><th className="p-4 font-medium">Statut</th><th className="p-4 font-medium">Date</th><th className="p-4 font-medium">Agents</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {missions.map((m) => (
            <tr key={m.id} className="hover:bg-surface-2/50">
              <td className="p-4"><Link href={`/missions/${m.id}`} className="font-medium text-ink-1 hover:text-brand">{m.title}</Link> {m.isDemo ? <DemoBadge /> : null}</td>
              <td className="max-w-xs p-4 text-ink-2">{m.objective}</td>
              <td className="p-4 tabular-nums">{m.progress.done}/{m.progress.total}</td>
              <td className="p-4 text-ink-3" title="Disponible avec le tunnel de leads (MVP 2)">—</td>
              <td className="p-4"><MissionStatusBadge status={m.status} /></td>
              <td className="p-4 text-ink-3">{dateFmt.format(new Date(m.createdAt))}</td>
              <td className="p-4"><div className="flex -space-x-1.5">{m.agents.map((a) => <AgentAvatar key={a} agent={a} size="sm" />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
