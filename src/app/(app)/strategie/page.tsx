import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "Stratégie IA" };

export default function StrategyPage() {
  return (
    <>
      <PageHeader eyebrow="Stratégie IA" title="Ce que Claude doit privilégier" description="Pondération des piliers, mix humain / IA / hybride, rythme, CTA, ton et formats." />
      <ComingSoon phase={2} features={["% Réseau MONÉTISÉ · Formation · Digitalisation IA", "% humain · IA · hybride", "Publications par semaine, CTA prioritaires", "Formats interdits et prioritaires, audiences, ton"]} />
    </>
  );
}
