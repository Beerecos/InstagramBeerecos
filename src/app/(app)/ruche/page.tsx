import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/missions/auto-refresh";
import { HiveOffice } from "@/components/ruche/hive-office";
import { PageHeader } from "@/components/shell/page-header";
import { getHive } from "@/server/missions/queries";

export const metadata: Metadata = { title: "La Ruche" };

export default function HivePage() {
  return (
    <>
      <PageHeader
        eyebrow="La Ruche"
        title="Votre équipe au bureau"
        description="Chaque personnage est un agent BeeMarketing. Il s'assoit et travaille quand une vraie tâche est en cours, lève une bulle quand il attend votre validation ou une connexion, et se promène quand il est disponible. Cliquez sur un agent pour voir ce qu'il fait."
      />
      <Suspense fallback={<div className="h-[560px] animate-pulse rounded-card bg-surface-2" />}>
        <Hive />
      </Suspense>
      <p className="mt-6 text-xs text-ink-3">
        Moteur et sprites : <a className="underline" href="https://github.com/pixel-agents-hq/pixel-agents" target="_blank" rel="noreferrer">Pixel Agents</a> (licence MIT), personnages inspirés de JIK-A-4 « Metro City ».
      </p>
    </>
  );
}

async function Hive() {
  const agents = await getHive();
  return (
    <>
      <AutoRefresh active intervalMs={5000} />
      <HiveOffice agents={agents} />
    </>
  );
}
