import type { Metadata } from "next";
import { Suspense } from "react";
import SocialHub from "@/components/social/SocialHub";

export const metadata: Metadata = { title: "Réseaux sociaux" };

/** Réseaux sociaux (repris de BeeMarketing, route `/publication`) : données des Edge Functions BeeMarketing. */
export default function PublicationPage() {
  return (
    <Suspense fallback={<p role="status" className="px-5 py-6 text-sm text-ink-2">Chargement…</p>}>
      <SocialHub />
    </Suspense>
  );
}
