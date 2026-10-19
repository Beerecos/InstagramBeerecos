import type { Metadata } from "next";
import { MapPinned } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";
import { Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Clubs" };

export default function ClubsPage() {
  return (
    <>
      <PageHeader eyebrow="Clubs" title="Clubs BeeRecos" description="La source de vérité pour proposer une visite : clubs, réunions, places visiteurs." />
      <ComingSoon phase={6} features={["Import des clubs et du planning des réunions", "Matching : distance, prochaine date, places, profil", "Règles métier configurables (jamais supposées)", "Revue humaine si la confiance est insuffisante"]}>
        <Card>
          <EmptyState icon={<MapPinned />} title="Aucun club enregistré">Sans club ni réunion en base, BeeMarketing ne propose jamais de visite.</EmptyState>
        </Card>
      </ComingSoon>
    </>
  );
}
