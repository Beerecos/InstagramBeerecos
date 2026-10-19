import type { Metadata } from "next";
import { Library } from "lucide-react";
import { ComingSoon } from "@/components/shell/coming-soon";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Bibliothèque" };

const CATEGORIES = ["Logos", "Photos", "Vidéos", "Témoignages", "Interviews", "Rushs studio", "Musiques", "Documents", "Présentations", "Anciens contenus"];

export default function LibraryPage() {
  return (
    <>
      <PageHeader eyebrow="Bibliothèque" title="Bibliothèque média" description="Vos propres contenus, réutilisés par l'équipe avant toute génération : IA + humain, jamais une page 100 % artificielle." />
      <ComingSoon phase={2} features={["Upload vers Supabase Storage (fichiers privés, URLs signées)", "Transcription et recherche dans vos vidéos", "Réutilisation automatique par le Video Director", "Import depuis Google Drive"]}>
        <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <span key={c} className="rounded-full bg-surface-1 px-3 py-1 text-sm text-ink-2 ring-1 ring-line">{c}</span>)}</div>
        <Card><EmptyState icon={<Library />} title="La bibliothèque est vide">L&apos;import de médias arrive au MVP 2.</EmptyState></Card>
      </ComingSoon>
    </>
  );
}
