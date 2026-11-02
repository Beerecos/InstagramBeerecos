"use client";
import { useEffect, useState } from "react";
import { studioAssets } from "@/lib/social/studio-assets-api";
import type { StudioAsset } from "@/domain/social/studio-assets";
import type { StudioSourceKind, StudioSourceRef } from "@/domain/social/studio-sources";
type Props = {
  kind: StudioSourceKind; revision?: number; dirty: boolean; busy: boolean; disabled?: boolean; error: string | null;
  onSave: () => Promise<unknown>; onSaveCopy: () => Promise<unknown>; onOpen: (source: StudioSourceRef) => Promise<void>;
};
/** Private server projects: browser storage is only a draft cache, never the project registry. */
export default function StudioProjects({ kind, revision, dirty, busy, disabled, error, onSave, onSaveCopy, onOpen }: Props) {
  const [projects, setProjects] = useState<StudioAsset[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function refresh() {
    setLoading(true); setListError(null);
    try { const result = await studioAssets.list(kind); setProjects(result.assets.filter(a => a.status !== "archived")); }
    catch (e) { setListError(e instanceof Error ? e.message : "Projets indisponibles."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps -- fetch this source library
  return <section aria-label="Projets IA" className="card space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-sm">{revision ? dirty ? `Modifications non enregistrées · version ${revision}` : `Projet enregistré · version ${revision}` : "Nouveau projet · non enregistré"}</p>
      <button type="button" className="btn-ghost min-h-[44px]" disabled={busy || disabled || !dirty} onClick={async () => { try { await onSave(); await refresh(); } catch { /* error remains beside the intact draft */ } }}>{busy ? "Enregistrement…" : "Enregistrer le projet"}</button>
    </div>
    {revision ? <button type="button" className="btn-ghost min-h-[44px]" disabled={busy || disabled} onClick={async()=>{try{await onSaveCopy();await refresh();}catch{/* intact draft */}}}>Enregistrer une copie de cette version</button> : null}
    <p className="text-xs text-mut">Pour reprendre une ancienne version ou conserver des changements en conflit, enregistre une copie indépendante.</p>
    <p className="text-xs text-mut">Sources privées conservées sur le serveur. Rouvre les textes et animations depuis une autre session, puis génère explicitement un nouveau MP4.</p>
    {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
    <details><summary className="cursor-pointer py-3 text-sm font-semibold">Projets enregistrés</summary>
      <button type="button" className="btn-ghost min-h-[44px] text-xs" disabled={loading || busy || disabled} onClick={refresh}>Actualiser les projets</button>
      {listError ? <p role="alert" className="text-sm text-red-800">{listError}</p> : null}
      {!loading && !listError && !projects.length ? <p className="py-2 text-sm text-mut">Aucun projet enregistré pour ce style.</p> : null}
      <ul className="space-y-2">{projects.map(project => <li key={project.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
        <span className="min-w-0 break-words text-sm">{project.title} · version {project.revision}</span>
        <button type="button" className="btn-ghost min-h-[44px]" disabled={busy || disabled} aria-label={`Ouvrir ${project.title}`} onClick={() => onOpen({ assetId: project.id, revision: project.revision, kind })}>Ouvrir</button>
      </li>)}</ul>
    </details>
  </section>;
}
