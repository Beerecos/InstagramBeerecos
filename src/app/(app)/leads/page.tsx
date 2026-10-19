import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "Leads" };

const COLUMNS = ["Nouveau", "À qualifier", "Qualifié", "Invitation proposée", "Invitation confirmée", "A participé", "À relancer", "Chaud", "Adhésion", "Perdu"];

export default function LeadsPage() {
  return (
    <>
      <PageHeader eyebrow="Leads" title="CRM Instagram" description="Chaque prospect avec son Reel d’origine, son score et son parcours jusqu’à l’adhésion." />
      <ComingSoon phase={5} features={["Fiche lead : identité, entreprise, ville, source, conversation, timeline", "Score Froid / Tiède / Chaud configurable", "Responsable de club : uniquement ses leads", "Export et suppression RGPD"]}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((c) => (
            <section key={c} aria-label={c} className="w-56 shrink-0 rounded-2xl bg-surface-2/60 p-3">
              <h2 className="flex items-center justify-between text-sm font-medium text-ink-1">{c}<span className="text-xs text-ink-3">0</span></h2>
              <div className="mt-3 h-32 rounded-xl border border-dashed border-line" />
            </section>
          ))}
        </div>
      </ComingSoon>
    </>
  );
}
