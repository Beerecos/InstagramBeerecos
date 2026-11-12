"use client";
/** Espace de travail d'un réel : un seul studio (MontageStudio) pour les projets filmés et IA, routé par Next.js. */
import { useRouter } from "next/navigation";
import MontageStudio from "@/components/social/MontageStudio";

export default function ReelWorkspace({ montageId, source = "reel", compact = false }: { montageId?: string; source?: "reel" | "ai"; compact?: boolean }) {
  const router = useRouter();
  return (
    <div className="social-studio -mx-4 min-h-full sm:-mx-8">
      <MontageStudio source={source} montageId={montageId} compact={compact}
        onOpenSource={(ref) => router.push(`/reels/nouveau/ia?${new URLSearchParams({ studioAsset: ref.assetId, studioRevision: String(ref.revision), studioKind: ref.kind })}`)}
        onOpenMontage={(id) => { if (!id || id === "__tous") router.push("/"); else if (id === "__video") router.push("/reels/nouveau/video"); else if (id === "__ia") router.push("/reels/nouveau/ia"); else if (id === "__tournage") router.push("/reels/tournage"); else router.push(`/reels/${id}`); }} />
    </div>
  );
}
