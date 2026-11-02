import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ReelWorkspace from "@/components/reels/reel-workspace";

export const metadata: Metadata = { title: "Importer ma vidéo" };

export default function NewFilmedReelPage() {
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-ink-2"><Link href="/" className="underline">Mes réels</Link> › Importer ma vidéo</nav>
      <p className="mb-4 text-sm text-ink-2">Une ou plusieurs prises (MP4/MOV). Pour un long tournage qui contient plusieurs réels, passe par <Link href="/reels/tournage" className="text-brand underline">Découper un tournage</Link>.</p>
      <Suspense fallback={<p role="status">Chargement…</p>}>
        <ReelWorkspace source="reel" compact />
      </Suspense>
    </>
  );
}
