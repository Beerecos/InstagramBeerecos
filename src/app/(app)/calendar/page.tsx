import type { Metadata } from "next";
import { Suspense } from "react";
import Calendar from "@/components/social/Calendar";

export const metadata: Metadata = { title: "Calendrier" };

/** Calendrier éditorial partagé (base BeeMarketing) : les posts préparés depuis la bibliothèque des réels. */
export default function CalendarPage() {
  return (
    <div className="social-studio -mx-4 px-4 py-2 sm:-mx-8 sm:px-8">
      <Suspense fallback={<p role="status">Chargement du calendrier…</p>}>
        <Calendar />
      </Suspense>
    </div>
  );
}
