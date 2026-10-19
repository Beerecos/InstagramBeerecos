import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Calendrier" };

const FILTERS = ["Tous", "Réseau MONÉTISÉ", "Formation", "Digitalisation IA", "Humain", "IA", "Hybride", "Brouillon", "À valider", "Programmé", "Publié"];
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function CalendarPage() {
  return (
    <>
      <PageHeader eyebrow="Calendrier" title="Calendrier éditorial" description="Idée → script → production → validation → programmé → publié → analysé." />
      <ComingSoon phase={2} features={["Glisser-déposer pour reprogrammer", "Filtres par pilier, mode et statut", "Semaine préparée par Claude selon la pondération des piliers", "Validation obligatoire selon le mode d’autonomie"]}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtres">
          {FILTERS.map((f, i) => (
            <span key={f} className={i === 0 ? "rounded-full bg-brand px-3 py-1 text-sm text-brand-ink" : "rounded-full bg-surface-1 px-3 py-1 text-sm text-ink-2 ring-1 ring-line"}>{f}</span>
          ))}
        </div>
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[44rem] grid-cols-7 divide-x divide-line">
            {DAYS.map((d) => (
              <div key={d} className="min-h-56 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{d}</p>
              </div>
            ))}
          </div>
        </Card>
      </ComingSoon>
    </>
  );
}
