"use client";
/** Espace de travail d'un réel : un seul studio (MontageStudio) pour les projets filmés et IA, routé par Next.js. */
import { useRouter } from "next/navigation";
import MontageStudio from "@/components/social/MontageStudio";

export default function ReelWorkspace({ montageId, source = "reel", compact = false }: { montageId?: string; source?: "reel" | "ai"; compact?: boolean }) {
  const router = useRouter();
  return (
    <div className="social-studio -mx-4 min-h-full sm:-mx-8">
      <MontageStudio source={source} montageId={montageId} compact={compact} onOpenMontage={(id) => router.push(id ? `/reels/${id}` : "/")} />
    </div>
  );
}
