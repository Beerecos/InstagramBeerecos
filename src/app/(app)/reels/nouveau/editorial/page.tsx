import type { Metadata } from "next";
import Link from "next/link";
import EditorialStudio from "@/components/social/editorial/EditorialStudio";

export const metadata: Metadata = { title: "Reel éditorial" };

export default function NewEditorialReelPage() {
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-ink-2"><Link href="/" className="underline">Mes réels</Link> › Reel éditorial</nav>
      <EditorialStudio />
    </>
  );
}
