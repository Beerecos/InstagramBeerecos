"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ImportError, reels as api, type ImportReport, type ReelDetail, type ReelSummary } from "@/lib/social/montage-api";
import { OVERLAY_MODE_LABEL, OVERLAY_MODES, overlayIssues, PILLAR_LABEL, ROLE_LABEL, SERIES, type OverlayMode, type ReelScene } from "@/domain/social/montage/reels";
import Prompteur from "@/components/social/studio/Prompteur";

/**
 * LES 72 REELS (lot S7) dans le Studio de montage : liste (recherche, filtres, ce qui reste à faire), fiche du Reel
 * (objectif, pilier, mot-clé, scènes, légende), prompteur, prise filmée liée et états réels (lus sur le montage).
 * Quatre textes distincts : à lire, à l'écran, sous-titres (audio final, dans le montage), légende du post.
 */
const EDITORIAL: Record<ReelSummary["editorial"], string> = { draft: "Brouillon", needs_review: "À relire", approved: "Texte validé" };
const MEDIA: Record<string, string> = { missing: "Prise manquante", processing: "Transcription en cours", ready: "Prise prête", failed: "Prise en échec" };
const RENDER: Record<string, string> = { not_started: "Pas d'aperçu validé", rendering: "Rendu en cours", preview_ready: "Aperçu validé", final_ready: "MP4 final prêt", failed: "Rendu en échec" };
const PUBLICATION: Record<string, string> = { not_scheduled: "Non programmé", scheduled: "Dans la file Reels" };
const msLabel = (ms: number | null | undefined) => (ms == null ? "non mesuré" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);

function ImportCard({ onDone, compact }: { onDone: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<{ message: string; errors: string[] } | null>(null);
  const send = async (file: File | undefined, fromRepo = false) => {
    if (!file && !fromRepo) return;
    setBusy(true); setError(null); setReport(null);
    try {
      // Instagram BeeRecos : la structure versionnée dans le dépôt (content/reels-72) peut être importée directement.
      const text = fromRepo ? await fetch("/api/reels-72").then((r) => { if (!r.ok) throw new Error(`Structure du dépôt illisible (HTTP ${r.status}).`); return r.text(); }) : await file!.text();
      const r = await api.import(text);
      setReport(r.report);
      onDone();
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Import impossible.", errors: e instanceof ImportError ? e.errors : [] });
    } finally { setBusy(false); }
  };
  return (
    <section aria-label="Importer la structure des Reels" className={`card space-y-2 ${compact ? "p-3" : "p-5"}`}>
      {!compact ? <h3 className="font-display text-lg">Importer la structure des 72 Reels</h3> : null}
      <p className="text-xs text-mut">Fichier BeeRecos_72_Reels_Structure.json (schéma 1.0.0). Réimporter ne crée aucun doublon et n&apos;écrase jamais un Reel modifié dans le Studio.</p>
      <button type="button" className="btn-red mr-2 min-h-[40px] text-sm" disabled={busy} onClick={() => send(undefined, true)}>{busy ? "Contrôle et import…" : "Importer la structure du dépôt"}</button>
      <label className="btn-ghost inline-flex min-h-[40px] cursor-pointer items-center text-sm">
        {busy ? "Contrôle et import…" : "Choisir le fichier JSON"}
        <input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={(e) => send(e.target.files?.[0])} aria-label="Fichier de structure des Reels" />
      </label>
      {error ? (
        <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error.message}</p>
          {error.errors.length ? <ul className="mt-1 list-disc pl-5 text-xs">{error.errors.slice(0, 12).map((x) => <li key={x}>{x}</li>)}</ul> : null}
        </div>
      ) : null}
      {report ? (
        <p role="status" className="rounded-xl bg-brand/5 px-3 py-2 text-sm">
          {report.reels} Reels et {report.scenes} scènes contrôlés : {report.inserted} ajoutés, {report.updated.length} mis à jour, {report.unchanged} inchangés
          {report.protected.length ? `, ${report.protected.length} protégés (${report.protected.map((p) => p.reelId).join(", ")} : modifiés dans le Studio)` : ""}.
          {report.warnings.length ? ` ${report.warnings.length} remarque(s) de lisibilité.` : ""}
        </p>
      ) : null}
    </section>
  );
}

function SceneEditor({ scene, revision, reel, onSaved, disabled }: { scene: ReelScene; revision: number; reel: ReelDetail; onSaved: () => void; disabled: boolean }) {
  const [spoken, setSpoken] = useState(scene.spoken_text);
  const [overlay, setOverlay] = useState(scene.overlay.text ?? "");
  const [mode, setMode] = useState<OverlayMode>(scene.overlay.preferred_mode);
  const [visual, setVisual] = useState(scene.visual_direction ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = spoken !== scene.spoken_text || overlay !== (scene.overlay.text ?? "") || mode !== scene.overlay.preferred_mode || visual !== (scene.visual_direction ?? "");
  const issues = overlayIssues(overlay);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.saveScene(reel.reelId, revision, scene.scene_id, {
        ...(spoken !== scene.spoken_text ? { spokenText: spoken } : {}),
        ...(overlay !== (scene.overlay.text ?? "") ? { overlayText: overlay || null } : {}),
        ...(mode !== scene.overlay.preferred_mode ? { preferredMode: mode } : {}),
        ...(visual !== (scene.visual_direction ?? "") ? { visualDirection: visual || null } : {}),
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); }
  };
  const t = scene.timing;
  return (
    <li className="rounded-xl border border-line bg-white p-3" aria-label={`Scène ${scene.scene_id}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="pill bg-brand/10 font-semibold text-brand">{ROLE_LABEL[scene.role]}</span>
        <span className="text-mut">{scene.scene_id}</span>
        <span className="text-mut">Prévu {msLabel(t.planned_start_ms)} → {msLabel(t.planned_end_ms)} · mesuré {t.actual_start_ms == null ? "non mesuré" : `${msLabel(t.actual_start_ms)} → ${msLabel(t.actual_end_ms)}`}</span>
        {scene.overlay.resolved_mode ? <span className="text-mut">Affiché : {OVERLAY_MODE_LABEL[scene.overlay.resolved_mode]}</span> : null}
      </div>
      <label className="block text-xs font-semibold">Texte à lire
        <textarea className="rounded-xl border border-line bg-white px-3 py-2 mt-1 min-h-[72px] w-full text-sm font-normal" value={spoken} disabled={disabled || busy} onChange={(e) => setSpoken(e.target.value)} />
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="block text-xs font-semibold">Texte à l&apos;écran
          <input className="rounded-xl border border-line bg-white px-3 py-2 mt-1 w-full text-sm font-normal" value={overlay} maxLength={48} disabled={disabled || busy} onChange={(e) => setOverlay(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold">Affichage
          <select className="rounded-xl border border-line bg-white px-3 py-2 mt-1 text-sm font-normal" value={mode} disabled={disabled || busy} onChange={(e) => setMode(e.target.value as OverlayMode)}>
            {OVERLAY_MODES.map((m) => <option key={m} value={m}>{OVERLAY_MODE_LABEL[m]}</option>)}
          </select>
        </label>
      </div>
      {issues.length ? <p className="mt-1 text-xs text-red-700">Lisibilité : {issues.join(" ; ")}</p> : null}
      <label className="mt-2 block text-xs font-semibold">Direction visuelle
        <input className="rounded-xl border border-line bg-white px-3 py-2 mt-1 w-full text-sm font-normal" value={visual} disabled={disabled || busy} onChange={(e) => setVisual(e.target.value)} />
      </label>
      {dirty ? <button type="button" className="btn-red mt-2 min-h-[36px] px-3 text-sm" disabled={busy || issues.length > 0} onClick={save}>{busy ? "Enregistrement…" : "Enregistrer la scène"}</button> : null}
      {error ? <p role="alert" className="mt-1 text-xs text-red-700">{error}</p> : null}
    </li>
  );
}

function ReelSheet({ reelId, onChange, onOpenMontage, uploader }: { reelId: string; onChange: () => void; onOpenMontage: (id: string) => void; uploader: (reelId: string, onDone: (id: string) => void) => ReactNode }) {
  const [reel, setReel] = useState<ReelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompteur, setPrompteur] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [filming, setFilming] = useState(false);
  const load = useCallback(() => {
    api.get(reelId).then((r) => { setReel(r.reel); setCaption(r.reel.data.social_caption?.text ?? ""); setError(null); }).catch((e) => setError(e.message));
  }, [reelId]);
  useEffect(() => { setReel(null); setFilming(false); load(); }, [load]);
  const after = () => { load(); onChange(); };
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); after(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(false); }
  };
  if (error && !reel) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!reel) return <p role="status" className="text-sm text-mut">Chargement…</p>;
  const d = reel.data;
  const approved = reel.editorial === "approved" && reel.approvedRevision === reel.revision;
  const series = SERIES.find((s) => s.id === reel.series);
  const closing = d.closing_card;
  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4" aria-label={`Fiche ${reel.reelId}`}>
        <div>
          <p className="kicker text-brand">{reel.reelId} · {series ? `${series.id} ${series.label}` : "Série non renseignée"} · {reel.pillar ? PILLAR_LABEL[reel.pillar] ?? reel.pillar : "Pilier non renseigné"}</p>
          <h3 className="font-display text-xl">{reel.title}</h3>
          <p className="text-xs text-mut">Objectif : {d.objective === "club_visit" ? "demande de visite de club" : d.objective ?? "DONNÉE MANQUANTE"} · Mode : {reel.mode === "studio" ? "tourné en studio" : reel.mode === "ai" ? "100 % IA" : "hybride"} · Révision {reel.revision}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`pill ${approved ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{approved ? "Texte validé" : EDITORIAL[reel.editorial]}</span>
          <span className={`pill ${reel.keywordActive ? "bg-brand/10 text-brand" : "bg-red-50 text-red-700"}`}>Appel à l&apos;action : commente {reel.keyword} {reel.keywordActive ? "· actif dans le moteur de DM" : "· inactif dans le moteur de DM"}</span>
          <span className="pill bg-black/[0.05] text-mut">{MEDIA[reel.linked?.media ?? "missing"]}</span>
          <span className="pill bg-black/[0.05] text-mut">{RENDER[reel.linked?.render ?? "not_started"]}</span>
          <span className="pill bg-black/[0.05] text-mut">{PUBLICATION[reel.linked?.publication ?? "not_scheduled"]}</span>
        </div>
        {reel.linked?.stale ? <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Le texte a changé depuis la pose des animations : ouvrez le montage et replacez-les.</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-red min-h-[40px] px-3 text-sm" onClick={() => setPrompteur(true)}>Prompteur</button>
          {approved
            ? <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={busy} onClick={() => act(() => api.review(reel.reelId, reel.revision, "needs_review"))}>Rouvrir le texte</button>
            : <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={busy} onClick={() => act(() => api.review(reel.reelId, reel.revision, "approved"))}>Valider le texte (révision {reel.revision})</button>}
          {reel.linked ? <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" onClick={() => onOpenMontage(reel.linked!.montageId)}>Ouvrir le montage</button> : null}
          <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" onClick={() => setFilming((f) => !f)}>{reel.linked ? "Nouvelle prise" : "Envoyer la prise filmée"}</button>
        </div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        {filming ? uploader(reel.reelId, (id) => { onChange(); onOpenMontage(id); }) : null}
      </section>

      <section aria-label="Scènes" className="space-y-2">
        <h4 className="font-display text-lg">Scènes ({d.scenes.length})</h4>
        <ol className="space-y-2">
          {d.scenes.map((s) => <SceneEditor key={`${s.scene_id}-${reel.revision}`} scene={s} revision={reel.revision} reel={reel} onSaved={after} disabled={busy} />)}
        </ol>
        <p className="text-xs text-mut">Carte de fin : logo BeeRecos et #MonReseauCestTonReseau, 2 s (prévue {msLabel(closing?.planned_start_ms)} → {msLabel(closing?.planned_end_ms)}). Les sous-titres viennent de l&apos;audio final, dans le montage.</p>
      </section>

      <section aria-label="Légende du post" className="card space-y-2 p-4">
        <h4 className="font-display text-lg">Légende du post</h4>
        <p className="text-xs text-mut">Texte publié sous le Reel, distinct du texte lu et du texte à l&apos;écran. Il reprend le mot-clé {reel.keyword} en capitales.</p>
        <textarea className="rounded-xl border border-line bg-white px-3 py-2 min-h-[96px] w-full text-sm" value={caption} maxLength={2200} onChange={(e) => setCaption(e.target.value)} aria-label="Texte de la légende" placeholder="DONNÉE MANQUANTE : légende à écrire" />
        <button type="button" className="btn-ghost min-h-[36px] px-3 text-sm" disabled={busy || !caption.trim() || caption === (d.social_caption?.text ?? "")} onClick={() => act(() => api.saveCaption(reel.reelId, reel.revision, caption))}>Enregistrer la légende</button>
      </section>
      {prompteur ? <Prompteur reel={d} onClose={() => setPrompteur(false)} /> : null}
    </div>
  );
}

export default function ReelsCatalogue({ onOpenMontage, uploader }: { onOpenMontage: (id: string) => void; uploader: (reelId: string, onDone: (id: string) => void) => ReactNode }) {
  const [list, setList] = useState<ReelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [series, setSeries] = useState("");
  const [pillar, setPillar] = useState("");
  const [state, setState] = useState("");
  const refresh = useCallback(() => { api.list().then((r) => { setList(r.reels); setError(null); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const shown = useMemo(() => (list ?? []).filter((r) => {
    const needle = q.trim().toLowerCase();
    if (needle && !`${r.reelId} ${r.title} ${r.keyword}`.toLowerCase().includes(needle)) return false;
    if (series && r.series !== series) return false;
    if (pillar && r.pillar !== pillar) return false;
    if (state === "todo" && !r.todo.length) return false;
    if (state === "approved" && r.editorial !== "approved") return false;
    if (state === "filmed" && !r.linked?.hasTake) return false;
    if (state === "final" && r.linked?.render !== "final_ready") return false;
    return true;
  }), [list, q, series, pillar, state]);

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (list === null) return <p role="status" className="text-sm text-mut">Chargement…</p>;
  if (!list.length) return <ImportCard onDone={refresh} />;
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-2" aria-label="Liste des Reels">
        <input className="rounded-xl border border-line bg-white px-3 py-2 w-full text-sm" placeholder="Rechercher (V01, titre, mot-clé)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un Reel" />
        <div className="grid grid-cols-3 gap-1">
          <select className="rounded-xl border border-line bg-white px-3 py-2 text-xs" value={series} onChange={(e) => setSeries(e.target.value)} aria-label="Série">
            <option value="">Séries</option>{SERIES.map((s) => <option key={s.id} value={s.id}>{s.id} {s.label}</option>)}
          </select>
          <select className="rounded-xl border border-line bg-white px-3 py-2 text-xs" value={pillar} onChange={(e) => setPillar(e.target.value)} aria-label="Pilier">
            <option value="">Piliers</option>{Object.entries(PILLAR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="rounded-xl border border-line bg-white px-3 py-2 text-xs" value={state} onChange={(e) => setState(e.target.value)} aria-label="État">
            <option value="">États</option><option value="todo">À compléter</option><option value="approved">Texte validé</option><option value="filmed">Filmés</option><option value="final">MP4 prêt</option>
          </select>
        </div>
        <p className="text-xs text-mut">{shown.length} Reel(s) sur {list.length}</p>
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setSelected(r.reelId)} aria-current={selected === r.reelId || undefined}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selected === r.reelId ? "border-brand bg-brand/5" : "border-line bg-white"}`}>
                <span className="flex items-center gap-2"><span className="font-semibold">{r.reelId}</span><span className="pill bg-black/[0.05] text-[11px] text-mut">{r.keyword}</span>{r.editorial === "approved" && r.approvedRevision === r.revision ? <span className="text-[11px] text-green-700">✓ texte</span> : null}</span>
                <span className="line-clamp-2 block text-mut">{r.title}</span>
                {r.todo.length ? <span className="block text-[11px] text-amber-800">À faire : {r.todo.join(" · ")}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <ImportCard onDone={refresh} compact />
      </aside>
      <div className="min-w-0">
        {selected ? <ReelSheet reelId={selected} onChange={refresh} onOpenMontage={onOpenMontage} uploader={uploader} /> : <p className="text-sm text-mut">Choisissez un Reel dans la liste : son objectif, son texte, ses scènes et le prompteur s&apos;affichent ici.</p>}
      </div>
    </div>
  );
}
