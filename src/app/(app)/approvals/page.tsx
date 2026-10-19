import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCheck } from "lucide-react";
import { decideApprovalAction } from "@/app/(app)/_actions/missions";
import { AgentAvatar } from "@/components/missions/agent-avatar";
import { AgentOutputView } from "@/components/missions/deliverables";
import { DemoBadge } from "@/components/missions/task-status";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, EmptyState, StatusBadge } from "@/components/ui";
import { AGENTS } from "@/domain/missions/agents";
import { can } from "@/domain/roles";
import { getCurrentUser } from "@/server/auth/dal";
import { getApprovalsInbox } from "@/server/missions/queries";

export const metadata: Metadata = { title: "Validations" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const DECIDED = { approved: { label: "Validé", tone: "good" }, rejected: { label: "Refusé", tone: "critical" }, changes_requested: { label: "Nouvelle version demandée", tone: "warning" }, pending: { label: "En attente", tone: "warning" } } as const;

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader eyebrow="Validations" title="Boîte de validation" description="Rien n'est publié ni envoyé sans votre accord. Validez, demandez une autre version ou refusez." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-2" />}>
        <Inbox />
      </Suspense>
    </>
  );
}

async function Inbox() {
  const [items, user] = await Promise.all([getApprovalsInbox(), getCurrentUser()]);
  const canDecide = can(user.role, "content:approve");
  const pending = items.filter((a) => a.status === "pending");
  const history = items.filter((a) => a.status !== "pending").slice(0, 20);
  return (
    <div className="space-y-8">
      {pending.length === 0 ? (
        <Card><EmptyState icon={<CheckCheck />} title="Tout est validé">Les productions de l&apos;équipe qui demandent votre accord apparaîtront ici.</EmptyState></Card>
      ) : (
        <ul className="space-y-4">
          {pending.map((a) => (
            <li key={a.id}>
              <article className="rounded-card bg-surface-1 ring-1 ring-line">
                <header className="flex flex-wrap items-center gap-3 border-b border-line p-4">
                  <AgentAvatar agent={a.agent} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-ink-1">{a.title}</h2>
                    <p className="text-xs text-ink-3">{AGENTS[a.agent].name} · <Link href={`/missions/${a.missionId}`} className="hover:text-ink-1">{a.missionTitle}</Link> · {dateFmt.format(new Date(a.createdAt))}</p>
                  </div>
                  {a.isDemo ? <DemoBadge /> : null}
                </header>
                <div className="max-h-[28rem] overflow-y-auto p-4">{a.task?.output ? <AgentOutputView output={a.task.output} taskId={a.task.id} /> : <p className="text-sm text-ink-3">Production indisponible.</p>}</div>
                {canDecide ? (
                  <form className="flex flex-col gap-3 border-t border-line p-4 sm:flex-row sm:items-center">
                    <label htmlFor={`c-${a.id}`} className="sr-only">Commentaire</label>
                    <input id={`c-${a.id}`} name="comment" placeholder="Commentaire ou modification souhaitée (facultatif)" className="h-10 flex-1 rounded-xl bg-surface-0 px-3 text-sm ring-1 ring-line outline-none focus:ring-brand" />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" formAction={decideApprovalAction.bind(null, a.id, "approve")}>Valider</Button>
                      <Button size="sm" variant="secondary" formAction={decideApprovalAction.bind(null, a.id, "request_changes")}>Autre version</Button>
                      <Button size="sm" variant="ghost" formAction={decideApprovalAction.bind(null, a.id, "reject")}>Refuser</Button>
                    </div>
                  </form>
                ) : (
                  <p className="border-t border-line p-4 text-sm text-ink-3">Votre rôle ne permet pas de valider.</p>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
      {history.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-2">Historique</h2>
          <ul className="divide-y divide-line rounded-card bg-surface-1 ring-1 ring-line">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <StatusBadge label={DECIDED[a.status].label} tone={DECIDED[a.status].tone} />
                <span className="text-ink-1">{a.title}</span>
                <span className="text-ink-3">{a.missionTitle}</span>
                {a.comment ? <span className="text-ink-2">« {a.comment} »</span> : null}
                <span className="ml-auto text-xs text-ink-3">{a.decidedAt ? dateFmt.format(new Date(a.decidedAt)) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
