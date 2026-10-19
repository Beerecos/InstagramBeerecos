import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Layers } from "lucide-react";
import { AgentAvatar } from "@/components/missions/agent-avatar";
import { DemoBadge, TaskStatusBadge } from "@/components/missions/task-status";
import { PageHeader } from "@/components/shell/page-header";
import { Card, EmptyState, PillarTag } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { PILLAR_LABELS, type Pillar } from "@/domain/content";
import { getStudioItems, type StudioItem } from "@/server/missions/queries";

export const metadata: Metadata = { title: "Studio" };

const SECTIONS: { key: string; label: string; kinds: StudioItem["kind"][] }[] = [
  { key: "idees", label: "Idées", kinds: ["idea", "calendar_entry", "research_note", "strategy_brief"] },
  { key: "scripts", label: "Scripts", kinds: ["script", "hook", "storyboard"] },
  { key: "images", label: "Images", kinds: ["visual_brief"] },
  { key: "carrousels", label: "Carrousels", kinds: ["carousel"] },
  { key: "captions", label: "Captions & posts", kinds: ["caption", "post", "story", "linkedin_post", "email", "landing_copy"] },
];
const PLATFORMS = { instagram: "Instagram", linkedin: "LinkedIn", email: "Email", landing: "Page d'atterrissage" } as const;

export default function StudioPage({ searchParams }: PageProps<"/studio">) {
  return (
    <>
      <PageHeader eyebrow="Studio" title="Studio de contenu" description="Tout ce que l'équipe a produit, avec le statut réel de chaque élément." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface-2" />}>
        <Studio searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function chip(active: boolean) {
  return cn("rounded-full px-3 py-1 text-sm ring-1", active ? "bg-brand text-white ring-brand" : "bg-surface-1 text-ink-2 ring-line hover:text-ink-1");
}

async function Studio({ searchParams }: { searchParams: PageProps<"/studio">["searchParams"] }) {
  const sp = await searchParams;
  const section = typeof sp.section === "string" ? sp.section : "all";
  const pillar = typeof sp.pilier === "string" ? (sp.pilier as Pillar) : null;
  const platform = typeof sp.plateforme === "string" ? sp.plateforme : null;
  const all = await getStudioItems();
  const kinds = SECTIONS.find((s) => s.key === section)?.kinds;
  const items = all.filter((i) => (!kinds || kinds.includes(i.kind)) && (!pillar || i.pillar === pillar) && (!platform || i.platform === platform));
  const q = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams({ ...(section !== "all" ? { section } : {}), ...(pillar ? { pilier: pillar } : {}), ...(platform ? { plateforme: platform } : {}) });
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `/studio?${s}` : "/studio";
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Sections" className="flex flex-wrap gap-2">
        <Link href={q({ section: null })} className={chip(section === "all")}>Tout</Link>
        {SECTIONS.map((s) => <Link key={s.key} href={q({ section: s.key })} className={chip(section === s.key)}>{s.label}</Link>)}
        <span className="rounded-full px-3 py-1 text-sm text-ink-3 ring-1 ring-line" title="Bibliothèque média (MVP 2)">Vidéos · Contenus importés</span>
      </nav>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="py-1 text-ink-3">Pilier :</span>
        {(Object.keys(PILLAR_LABELS) as Pillar[]).map((p) => <Link key={p} href={q({ pilier: pillar === p ? null : p })} className={chip(pillar === p)}>{PILLAR_LABELS[p]}</Link>)}
        <span className="py-1 pl-2 text-ink-3">Plateforme :</span>
        {Object.entries(PLATFORMS).map(([k, l]) => <Link key={k} href={q({ plateforme: platform === k ? null : k })} className={chip(platform === k)}>{l}</Link>)}
      </div>
      {items.length === 0 ? (
        <Card><EmptyState icon={<Layers />} title="Aucun contenu pour ces filtres">Les livrables apparaissent ici dès qu&apos;un agent les produit.</EmptyState></Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => (
            <li key={i.id} className="flex flex-col rounded-card bg-surface-1 p-4 ring-1 ring-line">
              <div className="flex items-center gap-2">
                <AgentAvatar agent={i.agent} size="sm" />
                <TaskStatusBadge status={i.taskStatus} />
                {i.isDemo ? <DemoBadge /> : null}
              </div>
              <h2 className="mt-3 font-semibold text-ink-1">{i.title}</h2>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink-3">
                {i.platform ? <span>{PLATFORMS[i.platform as keyof typeof PLATFORMS] ?? i.platform}</span> : null}
                {i.pillar ? <PillarTag pillar={i.pillar} /> : null}
              </div>
              <p className="mt-2 line-clamp-5 flex-1 whitespace-pre-line text-sm text-ink-2">{i.content}</p>
              <Link href={`/missions/${i.missionId}`} className="mt-3 truncate text-xs text-ink-3 hover:text-brand">{i.missionTitle}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
