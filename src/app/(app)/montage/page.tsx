import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Scissors } from "lucide-react";
import { MontageUploader } from "@/components/montage/uploader";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState } from "@/components/ui";
import { MONTAGE_STATUS_LABELS, keptMs } from "@/domain/video/montage";
import { listMontages, montageAvailability } from "@/server/montages/service";

export const metadata: Metadata = { title: "Montage" };

export default function MontagePage() {
  return (
    <>
      <PageHeader
        eyebrow="Vidéo"
        title="Montage en ligne"
        description="Envoyez une prise filmée : transcription, coupe des silences et des phrases ratées, aperçu en direct. Tout se fait depuis le site."
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-surface-2" />}>
        <Montages />
      </Suspense>
    </>
  );
}

async function Montages() {
  const available = montageAvailability();
  const montages = await listMontages();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card>
        <h2 className="mb-3 font-semibold">Nouveau montage</h2>
        {available.storage ? (
          <MontageUploader />
        ) : (
          <p className="text-sm text-ink-2">Le montage en ligne a besoin du stockage Supabase : il n&apos;est pas disponible en mode démo.</p>
        )}
        {!available.transcription ? <p className="mt-3 text-xs text-ink-3">Transcription : ajoutez ELEVENLABS_API_KEY dans les variables d&apos;environnement Vercel.</p> : null}
      </Card>
      <section aria-labelledby="montages">
        <h2 id="montages" className="mb-3 font-semibold">Vos montages</h2>
        {montages.length ? (
          <ul className="space-y-2">
            {montages.map((m) => (
              <li key={m.id}>
                <Link href={`/montage/${m.id}`} className="flex items-center gap-3 rounded-xl bg-surface-1 px-4 py-3 ring-1 ring-line hover:ring-brand">
                  <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                  <span className="text-xs text-ink-3">{m.edit ? `${(keptMs(m.edit.ranges) / 1000).toFixed(0)} s` : ""}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">{MONTAGE_STATUS_LABELS[m.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Scissors aria-hidden />} title="Aucun montage pour l'instant">
            Envoyez votre première prise : elle reste privée, dans le stockage de BeeRecos.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
