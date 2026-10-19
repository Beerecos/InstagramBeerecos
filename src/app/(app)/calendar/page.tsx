import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DemoBadge } from "@/components/missions/task-status";
import { PageHeader } from "@/components/shell/page-header";
import { Card, PillarTag } from "@/components/ui";
import { CREATION_MODE_LABELS } from "@/domain/content";
import { getStudioItems } from "@/server/missions/queries";

export const metadata: Metadata = { title: "Calendrier" };

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function CalendarPage() {
  return (
    <>
      <PageHeader eyebrow="Calendrier" title="Calendrier marketing" description="Plan éditorial proposé par l'équipe. Une publication n'est « programmée » qu'après validation et connexion du compte." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-2" />}>
        <Calendar />
      </Suspense>
    </>
  );
}

async function Calendar() {
  const items = await getStudioItems();
  const entries = items.filter((i) => i.kind === "calendar_entry" || i.scheduledFor);
  const byDay = new Map<string, typeof entries>();
  const dated: typeof entries = [];
  for (const e of entries) {
    if (e.scheduledFor) dated.push(e);
    else {
      const day = DAYS.find((d) => e.title.toLowerCase().startsWith(d.toLowerCase()));
      if (day) byDay.set(day, [...(byDay.get(day) ?? []), e]);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-brand px-3 py-1 text-white">Semaine</span>
        <span className="rounded-full px-3 py-1 text-ink-3 ring-1 ring-line" title="Disponible avec la programmation réelle (MVP 2)">Mois</span>
        <span className="rounded-full px-3 py-1 text-ink-3 ring-1 ring-line" title="Disponible avec la programmation réelle (MVP 2)">Liste</span>
      </div>
      <Card className="overflow-x-auto p-0">
        <div className="grid min-w-[56rem] grid-cols-7 divide-x divide-line">
          {DAYS.map((d) => (
            <div key={d} className="min-h-72 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{d}</p>
              <div className="space-y-2">
                {(byDay.get(d) ?? []).map((e) => (
                  <Link key={e.id} href={`/missions/${e.missionId}`} className="block rounded-xl bg-surface-0 p-2 text-xs ring-1 ring-line hover:ring-brand">
                    <span className="flex flex-wrap items-center gap-1">{e.pillar ? <PillarTag pillar={e.pillar} /> : null}{e.isDemo ? <DemoBadge /> : null}</span>
                    <span className="mt-1 block font-medium text-ink-1">{e.title.replace(new RegExp(`^${d}\\s*—\\s*`, "i"), "")}</span>
                    <span className="mt-0.5 block text-ink-3">{[e.platform === "linkedin" ? "LinkedIn" : "Instagram", e.mode ? CREATION_MODE_LABELS[e.mode] : null].filter(Boolean).join(" · ")} · proposé</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {dated.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Dates proposées</h2>
          <ul className="space-y-2 text-sm">{dated.map((e) => <li key={e.id}><span className="text-ink-3">{fmt.format(new Date(e.scheduledFor!))}</span> — {e.title}</li>)}</ul>
        </Card>
      ) : null}
      <p className="text-xs text-ink-3">Le glisser-déposer et la programmation réelle arrivent avec la connexion Instagram / LinkedIn (MVP 2).</p>
    </div>
  );
}
