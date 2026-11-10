import type { Metadata } from "next";
import { Suspense } from "react";
import AiEntry from "@/components/reels/ai-entry";

export const metadata: Metadata = { title: "Créer avec l'IA" };

export default function NewAiReelPage() {
  return (
    <Suspense fallback={<p role="status">Chargement…</p>}>
      <AiEntry />
    </Suspense>
  );
}
