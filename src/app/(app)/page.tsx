import type { Metadata } from "next";
import { Suspense } from "react";
import PostHub from "@/components/post/post-hub";

export const metadata: Metadata = { title: "Post" };

/** Accueil : tableau de bord des posts en cours. Le Studio ne s'ouvre que pour un réel. */
export default function HomePage() {
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm">Chargement…</p>}>
      <PostHub />
    </Suspense>
  );
}
