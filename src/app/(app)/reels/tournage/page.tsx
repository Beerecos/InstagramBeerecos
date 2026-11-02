import type { Metadata } from "next";
import Link from "next/link";
import Tournage from "@/components/reels/tournage";

export const metadata: Metadata = { title: "Découper un tournage" };

export default function TournagePage() {
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-ink-2"><Link href="/" className="underline">Mes réels</Link> › Découper un tournage</nav>
      <Tournage />
    </>
  );
}
