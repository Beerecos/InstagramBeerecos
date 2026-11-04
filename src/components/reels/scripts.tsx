"use client";
/**
 * Scripts : les 72 scripts tournés (prompteur, texte, validation) et la création de nouveaux scripts avec l'IA.
 * Chaque script devient soit un réel filmé (sa prise), soit un réel IA (scènes reprises mot pour mot).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { studioAssets } from "@/lib/social/studio-assets-api";
import type { StudioAsset } from "@/domain/social/studio-assets";
import { Bot, Clapperboard, Scissors } from "lucide-react";
import { Uploader } from "@/components/social/MontageStudio";
import ReelsCatalogue from "@/components/social/studio/ReelsCatalogue";
import { isMontageConfigured } from "@/lib/social/montage-api";

function MyScripts() {
  const [list, setList] = useState<StudioAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { studioAssets.list("motion").then((r) => setList(r.assets.filter((a) => a.status !== "archived"))).catch((e: Error) => setError(e.message)); }, []);
  return (
    <section className="card p-4" aria-labelledby="mes-scripts">
      <div className="flex items-center justify-between gap-2"><h2 id="mes-scripts" className="font-semibold">Mes scripts</h2><Link href="/scripts/nouveau" className="btn-red min-h-10">Nouveau script</Link></div>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      {list === null && !error ? <p role="status" className="mt-2 text-sm text-mut">Chargement…</p> : null}
      {list?.length === 0 ? <p className="mt-2 text-sm text-mut">Aucun script enregistré pour l&apos;instant.</p> : null}
      <ul className="mt-2 divide-y divide-line">{list?.map((a) => <li key={a.id}><Link href={`/scripts/${a.id}`} className="flex justify-between gap-3 py-2 text-sm hover:text-brand"><span className="truncate font-medium">{a.title}</span><span className="shrink-0 text-xs text-mut">révision {a.revision} · {new Date(a.updatedAt).toLocaleDateString("fr-FR")}</span></Link></li>)}</ul>
    </section>
  );
}

export default function Scripts() {
  const router = useRouter();
  return (
    <div className="social-studio -mx-4 space-y-4 px-4 py-2 sm:-mx-8 sm:px-8">
      <header>
        <Link href="/" className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm text-mut hover:bg-black/[0.05]">← Post</Link>
        <h1 className="font-display text-3xl font-semibold">Scripts</h1>
        <p className="mt-1 text-sm text-mut">Écris ou reprends un script, puis transforme-le en réel filmé ou en réel IA.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/reels/tournage" className="card flex gap-3 p-4 hover:border-brand/40"><Scissors aria-hidden className="text-brand" /><span><span className="block font-semibold">J&apos;ai déjà mes prises</span><span className="text-sm text-mut">Importer les prises tournées et les associer aux 72 scripts, en une fois.</span></span></Link>
        <Link href="/scripts/nouveau" className="card flex gap-3 p-4 hover:border-brand/40"><Bot aria-hidden className="text-brand" /><span><span className="block font-semibold">Nouveau script</span><span className="text-sm text-mut">Éditeur du hook au call to action, avec proposition de l&apos;IA si tu veux.</span></span></Link>
        <Link href="/reels/nouveau/video" className="card flex gap-3 p-4 hover:border-brand/40"><Clapperboard aria-hidden className="text-brand" /><span><span className="block font-semibold">Une prise hors catalogue</span><span className="text-sm text-mut">Importer une vidéo filmée sans script associé.</span></span></Link>
      </div>
      {!isMontageConfigured ? <p role="status" className="card p-4 text-sm">Le serveur de montage n&apos;est pas configuré (NEXT_PUBLIC_BEE_API_URL) : les scripts ne peuvent pas être lus ni enregistrés sur le serveur. L&apos;éditeur garde ton brouillon sur cet appareil.</p> : <MyScripts />}
      {!isMontageConfigured ? null : (
        <section className="card p-4" aria-labelledby="catalogue">
          <h2 id="catalogue" className="font-semibold">Les 72 scripts</h2>
          <p className="mb-2 text-sm text-mut">Un script au catalogue n&apos;est pas une vidéo validée. « Envoyer la prise filmée » crée le réel filmé ; « Faire en réel IA » ouvre ses scènes dans l&apos;éditeur IA.</p>
          <ReelsCatalogue onOpenMontage={(id) => router.push(`/reels/${id}`)} uploader={(reelId, done) => <Uploader key={reelId} reelId={reelId} onDone={done} />} aiHref={(reelId) => `/reels/nouveau/ia?script=${reelId}`} />
        </section>
      )}
    </div>
  );
}
