"use client";
/**
 * « Mes réels » : page d'entrée d'Instagram BeeRecos. Liste réelle des montages (fonction serveur `montage`) et des
 * brouillons IA (studio_assets) ; chaque carte affiche titre, miniature, source, statut réel et prochaine action.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bot, Clapperboard, Film, Plus, Search, Upload } from "lucide-react";
import { isMontageConfigured, montage, type MontageDetail, type MontageSummary } from "@/lib/social/montage-api";
import { studioAssets } from "@/lib/social/studio-assets-api";
import type { StudioAsset } from "@/domain/social/studio-assets";
import { matchesQuery, reelState, type ReelState } from "@/domain/reels/project";

type Detail = { montage: MontageDetail; videoUrl: string | null };

const TONE: Record<ReelState["tone"], string> = {
  neutral: "bg-black/[0.05] text-mut",
  busy: "bg-brand-soft text-brand",
  ok: "bg-acid/15 text-acid-dim",
  error: "bg-red-50 text-red-700",
};

export function CreateReelButtons({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Créer un réel">
      <Link href="/reels/nouveau/video" className="btn-red min-h-11"><Upload aria-hidden size={16} /> Importer ma vidéo</Link>
      <Link href="/reels/nouveau/ia" className="btn-ghost min-h-11"><Bot aria-hidden size={16} /> Créer avec l&apos;IA</Link>
      <Link href="/reels/tournage" className="btn-ghost min-h-11">J&apos;ai déjà mes prises</Link>
    </div>
  );
}

function ReelCard({ summary }: { summary: MontageSummary }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  useEffect(() => {
    let alive = true;
    montage.get(summary.id).then((d) => { if (alive) setDetail({ montage: d.montage, videoUrl: d.videoUrl }); }).catch(() => {});
    return () => { alive = false; };
  }, [summary.id, summary.updatedAt]);
  const state = reelState({ ...summary, previewApproved: detail?.montage.previewApproved, hasEdit: detail ? Boolean(detail.montage.edit) : undefined });
  const source = detail ? (detail.montage.aiSource ? "IA" : "Filmé") : "…";
  const thumb = summary.finalVideoUrl ?? detail?.videoUrl ?? null;
  return (
    <li>
      <Link href={`/reels/${summary.id}`} className="card flex gap-3 p-3 transition hover:border-brand/40">
        <div className="relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-lg bg-black/[0.06]">
          {thumb ? <video src={`${thumb}#t=0.5`} preload="metadata" muted playsInline aria-hidden className="h-full w-full object-cover" /> : <Film aria-hidden className="absolute inset-0 m-auto text-mut-2" size={22} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{summary.title}</p>
          <p className="mt-0.5 text-xs text-mut">{source} · modifié le {new Date(summary.updatedAt).toLocaleDateString("fr-FR")}{summary.keptMs ? ` · ${Math.round(summary.keptMs / 1000)} s` : ""}</p>
          <span className={`pill mt-2 ${TONE[state.tone]}`}>{state.label}</span>
          <p className="mt-2 text-sm text-fg">→ {state.next}</p>
        </div>
      </Link>
    </li>
  );
}

export default function MyReels() {
  const [list, setList] = useState<MontageSummary[] | null>(null);
  const [drafts, setDrafts] = useState<StudioAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!isMontageConfigured) return;
    let alive = true;
    montage.list().then((r) => { if (alive) setList(r.montages); }).catch((e: Error) => { if (alive) setError(e.message); });
    Promise.all([studioAssets.list("motion"), studioAssets.list("story")])
      .then(([m, s]) => { if (alive) setDrafts([...m.assets, ...s.assets].filter((a) => a.status !== "archived")); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const shown = useMemo(() => (list ?? []).filter((m) => matchesQuery(m.title, q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [list, q]);
  const shownDrafts = drafts.filter((d) => matchesQuery(d.title, q));

  return (
    <div className="social-studio -mx-4 min-h-full px-4 py-2 sm:-mx-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Instagram BeeRecos</p>
          <h1 className="font-display text-3xl font-semibold">Mes réels</h1>
          <p className="mt-1 text-sm text-mut">Le studio : tes prises deviennent des réels filmés, tes scripts des réels IA. Les réels terminés vont dans la Bibliothèque, puis au calendrier.</p>
        </div>
        <CreateReelButtons />
      </header>

      {!isMontageConfigured ? (
        <p role="status" className="card mt-6 p-4 text-sm">Le serveur de montage n&apos;est pas configuré : renseigne <code>NEXT_PUBLIC_BEE_API_URL</code> (Edge Functions du projet BeeMarketing). Aucun projet ne peut être lu ni enregistré sans lui.</p>
      ) : (
        <>
          <label className="mt-6 flex max-w-md items-center gap-2 rounded-lg border border-line bg-white px-3">
            <Search aria-hidden size={16} className="text-mut" />
            <span className="sr-only">Rechercher un réel</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un réel" className="min-h-11 flex-1 bg-transparent text-sm outline-none" />
          </label>
          {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
          {list === null && !error ? <p role="status" className="mt-6 text-sm text-mut">Chargement des projets…</p> : null}
          {list && shown.length === 0 && !shownDrafts.length ? (
            <div className="card mt-6 flex flex-col items-start gap-3 p-6">
              <Clapperboard aria-hidden className="text-brand" />
              <p className="font-medium">{q ? "Aucun réel ne correspond." : "Aucun réel pour l'instant."}</p>
              <p className="text-sm text-mut">Importe une vidéo filmée ou crée un réel avec l&apos;IA. Les 72 scripts sont proposés à la création.</p>
              <CreateReelButtons />
            </div>
          ) : null}
          {shown.length ? (
            <section className="mt-6" aria-labelledby="projets">
              <h2 id="projets" className="text-sm font-semibold uppercase tracking-wide text-mut">Projets ({shown.length})</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map((m) => <ReelCard key={m.id} summary={m} />)}</ul>
            </section>
          ) : null}
          {shownDrafts.length ? (
            <section className="mt-8" aria-labelledby="brouillons">
              <h2 id="brouillons" className="text-sm font-semibold uppercase tracking-wide text-mut">Brouillons IA pas encore rendus ({shownDrafts.length})</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shownDrafts.map((d) => (
                  <li key={d.id}>
                    <Link href={`/reels/nouveau/ia?studioAsset=${d.id}&studioRevision=${d.revision}&studioKind=${d.kind}`} className="card flex items-center gap-3 p-3 hover:border-brand/40">
                      <span className="flex size-12 items-center justify-center rounded-lg bg-brand-soft text-brand"><Bot aria-hidden size={20} /></span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{d.title}</span>
                        <span className="text-xs text-mut">IA · version {d.revision} · {d.status === "approved" ? "validé" : "brouillon"} → reprendre les scènes</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <p className="mt-10 text-xs text-mut"><Plus aria-hidden size={12} className="inline" /> Carrousels et autres formats : <Link href="/formats" className="text-brand underline">Autres formats</Link>.</p>
        </>
      )}
    </div>
  );
}
