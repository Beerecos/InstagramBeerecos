"use client";
/**
 * Scripts : les 72 scripts tournés (prompteur, texte, validation) et la création de nouveaux scripts avec l'IA.
 * Chaque script devient soit un réel filmé (sa prise), soit un réel IA (scènes reprises mot pour mot).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Clapperboard, Scissors } from "lucide-react";
import { Uploader } from "@/components/social/MontageStudio";
import ReelsCatalogue from "@/components/social/studio/ReelsCatalogue";
import { isMontageConfigured } from "@/lib/social/montage-api";

export default function Scripts() {
  const router = useRouter();
  return (
    <div className="social-studio -mx-4 space-y-4 px-4 py-2 sm:-mx-8 sm:px-8">
      <header>
        <p className="kicker">Instagram BeeRecos</p>
        <h1 className="font-display text-3xl font-semibold">Scripts</h1>
        <p className="mt-1 text-sm text-mut">Écris ou reprends un script, puis transforme-le en réel filmé ou en réel IA.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/reels/tournage" className="card flex gap-3 p-4 hover:border-brand/40"><Scissors aria-hidden className="text-brand" /><span><span className="block font-semibold">J&apos;ai déjà mes prises</span><span className="text-sm text-mut">Importer les prises tournées et les associer aux 72 scripts, en une fois.</span></span></Link>
        <Link href="/reels/nouveau/ia" className="card flex gap-3 p-4 hover:border-brand/40"><Bot aria-hidden className="text-brand" /><span><span className="block font-semibold">Nouveau script avec l&apos;IA</span><span className="text-sm text-mut">Décris le sujet : l&apos;IA propose les scènes (voix, texte à l&apos;écran), tu corriges.</span></span></Link>
        <Link href="/reels/nouveau/video" className="card flex gap-3 p-4 hover:border-brand/40"><Clapperboard aria-hidden className="text-brand" /><span><span className="block font-semibold">Une prise hors catalogue</span><span className="text-sm text-mut">Importer une vidéo filmée sans script associé.</span></span></Link>
      </div>
      {!isMontageConfigured ? <p role="status" className="card p-4 text-sm">Le serveur de montage n&apos;est pas configuré (NEXT_PUBLIC_BEE_API_URL) : les 72 scripts ne peuvent pas être lus.</p> : (
        <section className="card p-4" aria-labelledby="catalogue">
          <h2 id="catalogue" className="font-semibold">Les 72 scripts</h2>
          <p className="mb-2 text-sm text-mut">Un script au catalogue n&apos;est pas une vidéo validée. « Envoyer la prise filmée » crée le réel filmé ; « Faire en réel IA » ouvre ses scènes dans l&apos;éditeur IA.</p>
          <ReelsCatalogue onOpenMontage={(id) => router.push(`/reels/${id}`)} uploader={(reelId, done) => <Uploader key={reelId} reelId={reelId} onDone={done} />} aiHref={(reelId) => `/reels/nouveau/ia?script=${reelId}`} />
        </section>
      )}
    </div>
  );
}
