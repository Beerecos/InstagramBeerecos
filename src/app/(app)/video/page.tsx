import type { Metadata } from "next";
import { Bot, Upload } from "lucide-react";
import { QueenBeeComposer } from "@/components/missions/queen-bee-composer";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Vidéo" };

export default function VideoPage() {
  return (
    <>
      <PageHeader eyebrow="Vidéo" title="Studio vidéo" description="Deux sources : votre vidéo tournée, ou une vidéo 100 % IA. L'équipe prépare tout ; aucun fichier n'est annoncé comme généré sans moteur vidéo connecté." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <span aria-hidden className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white"><Bot size={24} /></span>
          <h2 className="mt-4 text-xl font-semibold">Créer avec l&apos;IA</h2>
          <p className="mt-1 text-sm text-ink-2">Objectif → script → storyboard → génération des scènes → voix → montage → preview → validation.</p>
          <p className="mt-2 text-xs text-ink-3">Script et storyboard : prêts dès que Claude est connecté. Génération des scènes : moteur vidéo à connecter (Veo, Runway…).</p>
        </Card>
        <Card>
          <span aria-hidden className="flex size-12 items-center justify-center rounded-2xl bg-brand-black text-white"><Upload size={24} /></span>
          <h2 className="mt-4 text-xl font-semibold">Importer ma vidéo</h2>
          <p className="mt-1 text-sm text-ink-2">Import → transcription → analyse → propositions de Reels → édition → validation → publication.</p>
          <p className="mt-2 text-xs text-ink-3">L&apos;import arrive avec la bibliothèque média (MVP 2). Vous pouvez déjà créer la mission : l&apos;équipe attendra la vidéo.</p>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="mb-3 font-semibold">Décrivez la vidéo à préparer</h2>
        <QueenBeeComposer size="md" showSuggestions={false} />
      </Card>
    </>
  );
}
