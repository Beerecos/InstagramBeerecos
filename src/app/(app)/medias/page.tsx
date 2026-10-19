import type { Metadata } from "next";
import { Library } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";
import { Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Médias" };

const CATEGORIES = ["Rushs studio", "Vidéos IA", "Clips", "Témoignages", "Réunions clubs", "Formations", "Photos", "Logos", "B-roll", "Musique", "Vidéos publiées", "Archives"];

export default function MediaPage() {
  return (
    <>
      <PageHeader eyebrow="Médias" title="Mes médias" description="La bibliothèque où Claude cherche une séquence existante avant d’en générer une nouvelle." />
      <ComingSoon phase={3} features={["Recherche en langage naturel : « Cédric parlant d’IA en entreprise »", "Transcriptions horodatées et indexées", "Personnes, club, pilier, tags, nombre d’utilisations", "Import depuis Google Drive"]}>
        <div className="flex flex-wrap gap-2" aria-label="Catégories">
          {CATEGORIES.map((c) => (
            <span key={c} className="rounded-full bg-surface-1 px-3 py-1 text-sm text-ink-2 ring-1 ring-line">{c}</span>
          ))}
        </div>
        <Card>
          <EmptyState icon={<Library />} title="La bibliothèque est vide">Les médias importés et générés apparaîtront ici.</EmptyState>
        </Card>
      </ComingSoon>
    </>
  );
}
