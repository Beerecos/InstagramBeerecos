import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ReelWorkspace from "@/components/reels/reel-workspace";

export const metadata: Metadata = { title: "Créer avec l'IA" };

export default function NewAiReelPage() {
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-ink-2"><Link href="/" className="underline">Mes réels</Link> › Créer avec l&apos;IA</nav>
      <Link href="/reels/nouveau/editorial" className="mb-4 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand">
        <span><strong>Nouveau : Reel éditorial</strong> · gros titres, chiffres animés et balayages, générés depuis ton script.</span>
        <span aria-hidden>→</span>
      </Link>
      <Suspense fallback={<p role="status">Chargement…</p>}>
        <ReelWorkspace source="ai" compact />
      </Suspense>
    </>
  );
}
