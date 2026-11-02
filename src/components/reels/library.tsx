"use client";
/**
 * Bibliothèque : les réels terminés (MP4 rendu de leur version) → « Créer le post » puis calendrier éditorial ;
 * les médias du studio (sons, images, licences) en second. Les 72 scripts sont dans « Scripts ».
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LibraryHome } from "@/components/social/MontageStudio";
import { isMontageConfigured, montage, type MontageSummary } from "@/lib/social/montage-api";
import { matchesQuery } from "@/domain/reels/project";

export default function Library() {
  const [list, setList] = useState<MontageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!isMontageConfigured) return;
    montage.list().then((r) => setList(r.montages)).catch((e: Error) => setError(e.message));
  }, []);
  const done = useMemo(() => (list ?? []).filter((m) => m.renderStatus === "done" && m.finalVideoUrl && matchesQuery(m.title, q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [list, q]);
  const pending = (list ?? []).filter((m) => !(m.renderStatus === "done" && m.finalVideoUrl)).length;
  return (
    <div className="social-studio -mx-4 space-y-4 px-4 py-2 sm:-mx-8 sm:px-8">
      <header>
        <p className="kicker">Instagram BeeRecos</p>
        <h1 className="font-display text-3xl font-semibold">Bibliothèque</h1>
        <p className="mt-1 text-sm text-mut">Les réels terminés : crée le post, puis ajoute-le au calendrier éditorial. Exporté n&apos;est pas publié.</p>
      </header>
      {!isMontageConfigured ? <p role="status" className="card p-4 text-sm">Le serveur de montage n&apos;est pas configuré (NEXT_PUBLIC_BEE_API_URL).</p> : <>
        <section aria-labelledby="termines" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="termines" className="font-semibold">Réels terminés{list ? ` (${done.length})` : ""}</h2>
            <input aria-label="Rechercher un réel terminé" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm" />
          </div>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          {list === null && !error ? <p role="status" className="text-sm text-mut">Chargement…</p> : null}
          {list && !done.length ? <p className="card p-4 text-sm">Aucun réel terminé{q ? " pour cette recherche" : ""}. {pending ? <>{pending} projet(s) en cours dans <Link href="/" className="text-brand underline">le studio</Link> : un réel arrive ici après son rendu MP4.</> : null}</p> : null}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {done.map((m) => (
              <li key={m.id} className="card overflow-hidden">
                <video src={`${m.finalVideoUrl}#t=0.5`} preload="metadata" muted playsInline controls className="aspect-[9/16] w-full bg-black" aria-label={`Réel « ${m.title} »`} />
                <div className="space-y-2 p-3">
                  <p className="truncate font-semibold" title={m.title}>{m.title}</p>
                  <p className="text-xs text-mut">{m.keptMs ? `${Math.round(m.keptMs / 1000)} s · ` : ""}{m.sentToReels ? "déjà transféré" : "MP4 prêt"}</p>
                  <Link href={`/reels/${m.id}?panel=post`} className="btn-red min-h-10 w-full">Créer le post</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <details className="card p-4"><summary className="cursor-pointer font-semibold">Médias du studio (sons et images)</summary><LibraryHome /></details>
      </>}
    </div>
  );
}
