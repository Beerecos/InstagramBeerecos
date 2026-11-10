"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReelWorkspace from "@/components/reels/reel-workspace";
import EditorialStudio from "@/components/social/editorial/EditorialStudio";

/**
 * Réel IA (2026-11-10) : par défaut le Studio ultra simple (idée + mascotte → structure Hook → CTA → aperçu, preset
 * Editorial Impact). L'éditeur détaillé reste disponible : lien « Éditeur détaillé », et toujours pour reprendre un
 * script (V01–V72) ou un projet enregistré (liens existants inchangés).
 */
export default function AiEntry() {
  const q = useSearchParams();
  const detailed = q.get("mode") === "detaille" || q.has("script") || q.has("studioAsset");
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
        <span><Link href="/" className="underline">Mes réels</Link> › Créer avec l&apos;IA</span>
        {detailed
          ? <Link href="/reels/nouveau/ia" className="text-brand underline">Revenir au Studio simple</Link>
          : <Link href="/reels/nouveau/ia?mode=detaille" className="text-brand underline">Éditeur détaillé</Link>}
      </nav>
      {detailed ? <ReelWorkspace source="ai" compact /> : <EditorialStudio />}
    </>
  );
}
