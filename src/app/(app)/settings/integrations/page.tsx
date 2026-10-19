import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui";
import { serverEnv } from "@/lib/env/server";
import { integrationStates } from "@/server/integrations/registry";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Intégrations" };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader eyebrow="Paramètres" title="Intégrations" description="BeeMarketing reste utilisable même si une intégration n'est pas encore configurée. Aucune clé n'est jamais affichée ni envoyée au navigateur." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-surface-2" />}>
        <IntegrationGrid />
      </Suspense>
    </>
  );
}

async function IntegrationGrid() {
  await connection(); // statut lu à l'exécution, jamais figé au build
  const states = integrationStates(serverEnv());
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {states.map((s) => (
        <article key={s.id} className="rounded-card bg-surface-1 p-5 ring-1 ring-line">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink-1">{s.name}</h2>
              <p className="text-sm text-ink-2">{s.role}</p>
            </div>
            <StatusBadge status={s.status === "connected" && !s.verified ? "configured" : s.status} />
          </header>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-3">Permissions</dt>
              <dd className="text-ink-2">{s.permissions.join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-3">Configuration</dt>
              <dd className="text-ink-2">
                {s.missing.length === 0 ? "Variables présentes. Test de connexion disponible avec l'adapter (phase " + s.phase + ")." : <>Manque : <code className="text-xs">{s.missing.join(", ")}</code></>}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-3">Dernière synchronisation</dt>
              <dd className="text-ink-2">Jamais</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
