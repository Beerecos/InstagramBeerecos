import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";
import { ButtonLink, Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Studio" };

export default function StudioPage() {
  return (
    <>
      <PageHeader eyebrow="Studio" title="Production vidéo" description="Toutes les vidéos en cours : génération IA, montage studio, hybrides, rendus." />
      <ComingSoon phase={3} features={["Progression en direct : scène 2/4, montage, sous-titres, export", "Détection des meilleurs passages d’une longue vidéo, avec score", "Génération de scènes Veo / Runway selon coût et qualité", "Rendu final déterministe FFmpeg en 1080×1920"]}>
        <Card>
          <EmptyState icon={<Clapperboard />} title="Aucune vidéo en production" action={<ButtonLink href="/creer">Créer une vidéo</ButtonLink>} />
        </Card>
      </ComingSoon>
    </>
  );
}
