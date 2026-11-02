import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CarouselStudio from "@/components/social/CarouselStudio";

export const metadata: Metadata = { title: "Autres formats" };

/** Accès secondaire aux formats non vidéo déjà existants (carrousels et visuels). */
export default function FormatsPage() {
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-ink-2"><Link href="/" className="underline">Mes réels</Link> › Autres formats</nav>
      <div className="social-studio -mx-4 px-4 sm:-mx-8 sm:px-8">
        <Suspense fallback={<p role="status">Chargement…</p>}><CarouselStudio /></Suspense>
      </div>
    </>
  );
}
