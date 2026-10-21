import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CutPlan } from "@/components/montage/cut-plan";
import { MontagePlayer } from "@/components/montage/montage-player";
import { TranscribeButton } from "@/components/montage/transcribe-button";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui";
import { MONTAGE_STATUS_LABELS, keptMs } from "@/domain/video/montage";
import { can } from "@/domain/roles";
import { getCurrentUser } from "@/server/auth/dal";
import { getMontage, montageAvailability } from "@/server/montages/service";

export const metadata: Metadata = { title: "Montage" };
// La transcription (Scribe télécharge et transcrit la prise) peut prendre jusqu'à quelques minutes.
export const maxDuration = 300;

export default function MontageDetailPage({ params }: PageProps<"/montage/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-2" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/montage/[id]">["params"] }) {
  const { id } = await params;
  const [montage, user] = await Promise.all([getMontage(id), getCurrentUser()]);
  if (!montage) notFound();
  const canEdit = can(user.role, "content:edit");
  const available = montageAvailability();
  const transcript = montage.captions ?? [];

  return (
    <>
      <Link href="/montage" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-brand">
        <ArrowLeft size={14} aria-hidden /> Tous les montages
      </Link>
      <PageHeader eyebrow={MONTAGE_STATUS_LABELS[montage.status]} title={montage.title} description={montage.edit ? `Durée montée : ${(keptMs(montage.edit.ranges) / 1000).toFixed(1).replace(".", ",")} s sur ${((montage.durationMs ?? 0) / 1000).toFixed(1).replace(".", ",")} s de prise.` : "La prise n'est pas encore reçue."} />
      {montage.error ? <p role="alert" className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-status-critical">{montage.error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          {montage.edit ? <MontagePlayer montageId={montage.id} version={montage.updatedAt} title={montage.title} /> : null}
          <p className="text-xs text-ink-3">Aperçu en direct 1080×1920 : coupes et sous-titres karaoké. Le MP4 final arrive au lot 3 (rendu HeyGen).</p>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-1 font-semibold">1. Transcription</h2>
            <p className="mb-3 text-sm text-ink-2">Texte mot à mot de la prise (ElevenLabs Scribe, français), recalé sur la voix réellement entendue.</p>
            {transcript.length ? <p className="mb-3 max-h-48 overflow-y-auto rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">{transcript.map((w) => w.text).join("").trim()}</p> : null}
            {canEdit && montage.edit ? (
              <TranscribeButton montageId={montage.id} again={transcript.length > 0} disabled={!available.transcription || montage.status === "transcribing"} />
            ) : null}
            {!available.transcription ? <p className="mt-2 text-xs text-ink-3">Ajoutez ELEVENLABS_API_KEY dans les variables d&apos;environnement Vercel pour transcrire.</p> : null}
          </Card>

          <Card>
            <h2 className="mb-1 font-semibold">2. Coupe</h2>
            {transcript.length && montage.edit ? (
              canEdit ? (
                <CutPlan montageId={montage.id} captions={transcript} durationMs={montage.durationMs ?? keptMs(montage.edit.ranges)} ranges={montage.edit.ranges} canUndo={Boolean(montage.previousEdit)} />
              ) : (
                <p className="text-sm text-ink-2">Seuls les administrateurs et responsables contenu peuvent couper.</p>
              )
            ) : (
              <p className="text-sm text-ink-2">Transcrivez d&apos;abord la prise : le plan de coupe se construit phrase par phrase.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
