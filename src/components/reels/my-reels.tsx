"use client";
/**
 * « Mes réels » : page d'entrée d'Instagram BeeRecos. Liste réelle des montages (fonction serveur `montage`) et des
 * brouillons IA (studio_assets) ; chaque carte affiche titre, miniature, source, statut réel et prochaine action.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bot, Clapperboard, Film, Plus, RotateCcw, Search, Trash2, Upload } from "lucide-react";
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

function ReelCard({ summary, onTrash }: { summary: MontageSummary; onTrash: (m: MontageSummary) => void }) {
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
    <li className="relative">
      <button type="button" aria-label={`Mettre « ${summary.title} » à la corbeille`} title="Mettre à la corbeille (récupérable)" disabled={summary.renderStatus === "rendering"}
        onClick={() => onTrash(summary)} className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-lg text-mut hover:bg-red-50 hover:text-red-700 disabled:opacity-40"><Trash2 aria-hidden size={16} /></button>
      <Link href={`/reels/${summary.id}`} className="card flex gap-3 p-3 pr-12 transition hover:border-brand/40">
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
  const [trash, setTrash] = useState<MontageSummary[]>([]);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<MontageSummary | null>(null);
  useEffect(() => {
    if (!isMontageConfigured) return;
    let alive = true;
    // Serveur pas encore à jour : il ignore la corbeille ; les filtres sur archivedAt évitent tout mélange.
    montage.list().then((r) => { if (alive) setList(r.montages.filter((m) => !m.archivedAt)); }).catch((e: Error) => { if (alive) setError(e.message); });
    montage.list({ archived: true }).then((r) => { if (alive) setTrash(r.montages.filter((m) => m.archivedAt)); }).catch(() => {});
    Promise.all([studioAssets.list("motion"), studioAssets.list("story")])
      .then(([m, s]) => { if (alive) setDrafts([...m.assets, ...s.assets].filter((a) => a.status !== "archived")); })
      .catch(() => {});
    return () => { alive = false; };
  }, [revision]);
  const shown = useMemo(() => (list ?? []).filter((m) => matchesQuery(m.title, q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [list, q]);
  const shownDrafts = drafts.filter((d) => matchesQuery(d.title, q));
  const trashIt = async (m: MontageSummary) => {
    setConfirming(null); setNotice(null);
    try { await montage.archive(m.id); setNotice(`« ${m.title} » est dans la corbeille : restaurable à tout moment, rien n'est effacé.`); setRevision((n) => n + 1); }
    catch (e) {
      const message = e instanceof Error ? e.message : "";
      setNotice(/inconnue|unknown/i.test(message) ? "La corbeille sera disponible après la mise en service du serveur (lot BeeMarketing en attente)." : `Impossible de mettre à la corbeille : ${message}`);
    }
  };
  const restore = async (m: MontageSummary) => {
    try { await montage.restore(m.id); setNotice(`« ${m.title} » est restauré.`); setRevision((n) => n + 1); }
    catch (e) { setNotice(`Restauration impossible : ${e instanceof Error ? e.message : ""}`); }
  };

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
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map((m) => <ReelCard key={m.id} summary={m} onTrash={setConfirming} />)}</ul>
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
          {confirming ? (
            <div role="alertdialog" aria-modal="true" aria-labelledby="corbeille-titre" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
              <div className="card max-w-md space-y-3 p-5">
                <h2 id="corbeille-titre" className="font-semibold">Mettre « {confirming.title} » à la corbeille ?</h2>
                <p className="text-sm text-mut">Le projet disparaît de la liste. Sa vidéo, son montage et ses fichiers sont conservés : tu peux le restaurer depuis la corbeille.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-ghost min-h-11" onClick={() => setConfirming(null)}>Annuler</button>
                  <button type="button" className="btn-red min-h-11" onClick={() => trashIt(confirming)}>Mettre à la corbeille</button>
                </div>
              </div>
            </div>
          ) : null}
          {notice ? <p role="status" className="mt-4 text-sm">{notice}</p> : null}
          {trash.length ? (
            <details className="mt-8"><summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-mut">Corbeille ({trash.length})</summary>
              <ul className="mt-3 space-y-2">{trash.map((m) => (
                <li key={m.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0 truncate">{m.title}<span className="ml-2 text-xs text-mut">mis à la corbeille le {new Date(m.archivedAt!).toLocaleDateString("fr-FR")}</span></span>
                  <button type="button" className="btn-ghost min-h-10" onClick={() => restore(m)}><RotateCcw aria-hidden size={14} /> Restaurer</button>
                </li>
              ))}</ul>
            </details>
          ) : null}
          <p className="mt-10 text-xs text-mut"><Plus aria-hidden size={12} className="inline" /> Carrousels et autres formats : <Link href="/formats" className="text-brand underline">Autres formats</Link>.</p>
        </>
      )}
    </div>
  );
}
