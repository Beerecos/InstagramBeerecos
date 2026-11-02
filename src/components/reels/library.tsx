"use client";
/** Bibliothèque : médias (sons, images, avec licence), modèles d'animation BeeMotion et les 72 scripts. */
import { useRouter } from "next/navigation";
import { LibraryHome, Uploader } from "@/components/social/MontageStudio";
import ReelsCatalogue from "@/components/social/studio/ReelsCatalogue";
import { isMontageConfigured } from "@/lib/social/montage-api";

export default function Library() {
  const router = useRouter();
  const open = (id: string) => router.push(`/reels/${id}`);
  return (
    <div className="social-studio -mx-4 space-y-4 px-4 py-2 sm:-mx-8 sm:px-8">
      <header>
        <p className="kicker">Instagram BeeRecos</p>
        <h1 className="font-display text-3xl font-semibold">Bibliothèque</h1>
        <p className="mt-1 text-sm text-mut">Médias, modèles d&apos;animation et les 72 scripts. Un script au catalogue n&apos;est pas une vidéo validée.</p>
      </header>
      {!isMontageConfigured ? <p role="status" className="card p-4 text-sm">Le serveur de montage n&apos;est pas configuré (NEXT_PUBLIC_BEE_API_URL).</p> : <>
        <section className="card p-4" aria-labelledby="scripts"><h2 id="scripts" className="font-semibold">Les 72 réels · scripts et prompteur</h2>
          <ReelsCatalogue onOpenMontage={open} uploader={(reelId, done) => <Uploader key={reelId} reelId={reelId} onDone={done} />} />
        </section>
        <section className="card p-4" aria-labelledby="medias"><h2 id="medias" className="font-semibold">Médias (sons et images)</h2><LibraryHome /></section>
      </>}
    </div>
  );
}
