import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ReelWorkspace from "@/components/reels/reel-workspace";

export const metadata: Metadata = { title: "Créer avec l'IA" };

export default function NewAiReelPage() {
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-ink-2"><Link href="/" className="underline">Mes réels</Link> › Créer avec l&apos;IA</nav>
      <Suspense fallback={<p role="status">Chargement…</p>}>
        <ReelWorkspace source="ai" compact />
      </Suspense>
    </>
  );
}
