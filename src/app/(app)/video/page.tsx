import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bot, Upload } from "lucide-react";
import { DemoBadge, TaskStatusBadge } from "@/components/missions/task-status";
import { ReelPreview } from "@/components/video/reel-preview";
import { getReels } from "@/server/missions/queries";
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
          <p className="mt-1 text-sm text-ink-2">Objectif → script → storyboard → Reel motion design (Hyperframes) → aperçu → validation → rendu MP4.</p>
          <p className="mt-2 text-xs text-ink-3">Le Reel motion design est prêt dès que Claude est connecté. Plans vidéo générés (Veo, Runway…) : moteur à connecter.</p>
        </Card>
        <Card>
          <span aria-hidden className="flex size-12 items-center justify-center rounded-2xl bg-brand-black text-white"><Upload size={24} /></span>
          <h2 className="mt-4 text-xl font-semibold">Importer ma vidéo</h2>
          <p className="mt-1 text-sm text-ink-2">Import → transcription → analyse → propositions de Reels → édition → validation → publication.</p>
          <p className="mt-2 text-xs text-ink-3">L&apos;import arrive avec la bibliothèque média (MVP 2). Vous pouvez déjà créer la mission : l&apos;équipe attendra la vidéo.</p>
        </Card>
      </div>
      <section className="mt-8" aria-labelledby="reels">
        <h2 id="reels" className="mb-3 font-semibold">Reels motion design</h2>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-surface-2" />}>
          <Reels />
        </Suspense>
      </section>
      <Card className="mt-6">
        <h2 className="mb-3 font-semibold">Décrivez la vidéo à préparer</h2>
        <QueenBeeComposer size="md" showSuggestions={false} />
      </Card>
    </>
  );
}

async function Reels() {
  const reels = await getReels();
  if (!reels.length) return <p className="text-sm text-ink-3">Aucun Reel pour l&apos;instant. Demandez à Queen Bee une « vidéo 100 % IA ».</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {reels.map((r) => (
        <Card key={`${r.taskId}-${r.index}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={r.status} />
            {r.isDemo ? <DemoBadge /> : null}
            <Link href={`/missions/${r.missionId}`} className="min-w-0 flex-1 truncate text-sm text-ink-3 hover:text-brand">{r.missionTitle}</Link>
          </div>
          <h3 className="mb-3 font-medium text-ink-1">{r.title}</h3>
          <ReelPreview taskId={r.taskId} index={r.index} title={r.title} />
        </Card>
      ))}
    </div>
  );
}
