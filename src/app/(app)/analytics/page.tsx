import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";
import { Card, CardHeader, FunnelChart } from "@/components/ui";
import { FUNNEL_STAGES } from "@/server/dashboard/home";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader eyebrow="Analytics" title="Ce qui crée des visites" description="Des vues jusqu’aux adhésions, par Reel, pilier, format, mode, hook, CTA et club." />
      <ComingSoon phase={7} features={["Attribution complète contenu → post → commentaire → DM → lead → visite → adhésion", "« Cette vidéo a généré 14 demandes CLUB, 8 invitations, 5 visites, 2 adhésions »", "Coût par lead, par visite, par membre", "Statistiques Instagram : portée, vues, rétention, sauvegardes"]}>
        <Card>
          <CardHeader title="Tunnel business" description="Données disponibles après connexion des sources." />
          <FunnelChart title="Tunnel business" stages={FUNNEL_STAGES.map((s) => ({ ...s, value: null }))} />
        </Card>
      </ComingSoon>
    </>
  );
}
