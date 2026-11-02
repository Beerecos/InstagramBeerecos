"use client";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "@/components/social/router";
import { listEditorialDeliverables, listClubWorkspaces, listPublications, setDeliverableStatus, type SocialPublicationRow, type Deliverable, type DeliverableStatus, type ClubWorkspace } from "@/lib/social/api";
import { montage, type MontageSummary } from "@/lib/social/montage-api";
import { FORMAT_LABEL, STATUS_LABEL, formatOf, matchesLocal, withoutEditor, studioHref, pipelineStage } from "@/lib/social/social-hub";
import PostPreview from "@/components/social/PostPreview";

const Calendar = lazy(() => import("@/components/social/Calendar"));
const field = "min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";
const button = `${field} inline-flex items-center justify-center font-medium hover:bg-brand-soft`;
const primary = "inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export default function SocialWorkspace({ display, reviewFocus, refreshKey = 0 }: { display: "list" | "calendar"; reviewFocus: boolean; refreshKey?: number }) {
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get("workspaceId") ?? "";
  const q = params.get("q") ?? "";
  const format = params.get("format") ?? "";
  const channel = params.get("channel") ?? "";
  const status = params.get("status") ?? (reviewFocus ? "review" : "");
  const [clubs, setClubs] = useState<ClubWorkspace[]>([]);
  const [items, setItems] = useState<Deliverable[]>([]);
  const [projects, setProjects] = useState<MontageSummary[]>([]);
  const [visuals, setVisuals] = useState<SocialPublicationRow[]>([]);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [demo, setDemo] = useState(false);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState<Deliverable | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const editHref = (id: string) => { const next = withoutEditor(params); next.delete("vue"); next.set("edit", id); return `/publication?${next}`; };
  const setFilter = (key: string, value: string) => setParams((old) => { const p = new URLSearchParams(old); if (value) p.set(key, value); else p.delete(key); if (key === "status" && p.get("vue") === "valider") p.delete("vue"); return p; }, { replace: true });
  const filters = useMemo(() => ({ workspaceId: workspaceId || undefined, channel: channel || undefined, status: (status || undefined) as DeliverableStatus | undefined }), [workspaceId, channel, status]);
  useEffect(() => { let active = true; listClubWorkspaces().then((r) => { if (active) setClubs(r.items); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => {
    if (display === "calendar") { setError(null); return; }
    const request = ++generation.current;
    let active = true;
    setLoading(true); setError(null);
    listEditorialDeliverables({ ...filters, limit: 100 }).then((r) => { if (active && request === generation.current) { setItems(r.items); setHasMore(r.hasMore); setDemo(r.demo); } }).catch((e: Error) => { if (active && request === generation.current) setError(e.message); }).finally(() => { if (active && request === generation.current) setLoading(false); });
    return () => { active = false; };
  }, [filters, refreshKey, revision, display]);
  useEffect(() => {
    let active = true; setMediaError(null); setVisualError(null);
    listPublications().then((r) => { if (active) setVisuals(r); }).catch((e: Error) => { if (active) setVisualError(e.message); });
    montage.list().then((r) => { if (active) setProjects(r.montages); }).catch((e: Error) => { if (active) setMediaError(e.message); });
    return () => { active = false; };
  }, [refreshKey, revision]);
  async function loadMore() {
    const request = generation.current; setBusy(true);
    try { const r = await listEditorialDeliverables({ ...filters, offset: items.length, limit: 100 }); if (request === generation.current) { setItems((old) => [...old, ...r.items.filter((d) => !old.some((x) => x.id === d.id))]); setHasMore(r.hasMore); } }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function approve(id: string, next: "approved" | "archived") {
    if (!preview || busy || demo) return; setBusy(true); setError(null);
    try { await setDeliverableStatus(id, next, preview.contentVersion); setPreview(null); setRevision((n) => n + 1); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const match = useCallback((d: Deliverable) => matchesLocal(d, q, format), [q, format]);
  const visible = items.filter(match);
  const drafts = visible.filter((d) => pipelineStage(d) === "prepare");
  const review = visible.filter((d) => pipelineStage(d) === "validate");
  const past = visible.filter((d) => pipelineStage(d) === "history");
  const media = projects.filter((m) => (!workspaceId || m.workspaceId === workspaceId) && (!format || format === "reel") && (!q || m.title.toLocaleLowerCase("fr").includes(q.toLocaleLowerCase("fr"))));
  const visibleVisuals = visuals.filter((v) => (!workspaceId || v.workspace_id === workspaceId) && (!q || (v.title ?? "").toLocaleLowerCase("fr").includes(q.toLocaleLowerCase("fr"))) && (!format || format === (Array.isArray((v.composition as { slides?: unknown[] } | undefined)?.slides) && ((v.composition as { slides: unknown[] }).slides.length > 1) ? "carrousel" : "post")) && v.status !== "archive");
  const card = (d: Deliverable) => <li key={d.id} className="rounded-xl border border-line bg-white p-4">
    <div className="flex gap-3"><Thumb d={d} /><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{d.title || "Sans titre"}</h3><p className="mt-1 text-xs text-mut">{FORMAT_LABEL[formatOf(d)]} · {d.channel}</p><span className="mt-2 inline-block rounded-md bg-brand-soft px-2 py-1 text-xs text-brand">{STATUS_LABEL[d.status]}</span></div></div>
    {d.scheduledAt && <p className="mt-3 text-xs text-mut">Date souhaitée : {new Date(d.scheduledAt).toLocaleString("fr-FR")}{d.status === "approved" ? " · à programmer" : ""}</p>}
    <div className="mt-4 flex flex-wrap gap-2">{d.status === "draft" ? <Link className={`${primary} w-full`} to={editHref(d.id)}>Préparer le post</Link> : <><button type="button" className={`${primary} flex-1`} onClick={() => { setPreview(d); setError(null); }}>{d.status === "review" ? "Relire et valider" : "Consulter"}</button>{d.status === "approved" && <Link className={button} to={editHref(d.id)}>Modifier</Link>}</>}</div>
  </li>;
  return <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="kicker text-brand">LE STUDIO SOCIAL</p><h1 className="mt-1 font-display text-3xl">Réseaux sociaux<span className="text-brand">.</span></h1><p className="mt-2 text-sm text-mut">Ton contenu avance. Tout reste sous les yeux.</p></div>
      <div className="flex flex-wrap gap-2"><button className={button} onClick={() => setFilter("vue", display === "calendar" ? "" : "calendrier")}>{display === "calendar" ? "Revenir au parcours" : "Calendrier"}</button><Link className={button} to="/library">Bibliothèque</Link><Link className={button} to="/publication?tab=parametres">Réglages</Link></div>
    </header>
    <div className="my-6 flex flex-wrap gap-2">
      <label className="w-full min-w-0 sm:w-auto sm:flex-1"><span className="sr-only">Rechercher un contenu</span><input className={`${field} w-full`} type="search" placeholder="Rechercher un contenu…" value={q} onChange={(e) => setFilter("q", e.target.value)} /></label>
      <select aria-label="Espace de publication" className={`${field} max-w-full`} value={workspaceId} onChange={(e) => setFilter("workspaceId", e.target.value)}><option value="">Tous les espaces autorisés</option>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select aria-label="Format" className={field} value={format} onChange={(e) => setFilter("format", e.target.value)}><option value="">Tous les formats</option>{Object.entries(FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select aria-label="Statut" className={field} value={status} onChange={(e) => setFilter("status", e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
    </div>
    {error && !preview && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-white p-3 text-sm">{error} <button className="underline" onClick={() => setRevision((n) => n + 1)}>Réessayer</button></p>}
    {demo && <p role="status" className="mb-4 text-sm text-mut">Démonstration : connecte le service pour retrouver tes contenus réels.</p>}
    {display === "calendar" ? <Suspense fallback={<p role="status">Chargement du calendrier…</p>}><Calendar key={refreshKey} embedded match={match} /></Suspense> : <>
      <section aria-label="Parcours de création en trois étapes" className="grid items-start gap-5 lg:grid-cols-3">
        <section aria-labelledby="create-heading" className="min-w-0 rounded-2xl border border-line bg-[#F7F7F9] p-4"><h2 id="create-heading" className="mb-1 text-lg font-semibold"><span className="mr-2 text-brand">01</span>Créer <span className="text-xs font-normal text-mut">{media.length + visibleVisuals.length} média(s)</span></h2><p className="mb-4 text-xs text-mut">Un média, puis un post.</p>
          <div className="grid gap-2">{([{ source: "reel", label: "Vidéo Reel", hint: "Importer et monter ta vidéo" }, { source: "ai", label: "Vidéo IA", hint: "Créer une source IA dans le montage" }, { source: "visual", label: "Carrousel / post simple", hint: "Commencer par un visuel" }] as const).map((choice) => <Link key={choice.source} className="rounded-xl border border-line bg-white p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand hover:border-brand" to={studioHref(params, choice.source)}><span className="block text-sm font-semibold">{choice.label}</span><span className="mt-1 block text-xs text-mut">{choice.hint}</span></Link>)}</div>
          {mediaError && <p role="status" className="mt-4 text-xs text-mut">Montages indisponibles : {mediaError}</p>}
          {visualError && <p role="status" className="mt-3 text-xs text-mut">Compositions indisponibles : {visualError}</p>}
          <ul className="mt-4 space-y-3">{visibleVisuals.map((v) => <li key={v.id} className="rounded-xl border border-line bg-white p-4"><h3 className="text-sm font-semibold">{v.title || "Composition sans titre"}</h3><p className="my-2 text-xs text-mut">{Array.isArray((v.composition as { slides?: unknown[] })?.slides) && (v.composition as { slides: unknown[] }).slides.length > 1 ? "Carrousel" : "Post simple"} · enregistré sur le serveur</p><Link className={button} to={`${studioHref(params, "visual")}&visual=${encodeURIComponent(v.id)}`}>Reprendre les visuels</Link></li>)}</ul>
          <ul className="mt-4 space-y-3">{media.map((m) => <li key={m.id} className="rounded-xl border border-line bg-white p-4"><h3 className="text-sm font-semibold">{m.title || "Montage sans titre"}</h3><p className="my-2 text-xs text-mut">Vidéo · {m.renderStatus === "done" ? "Rendu disponible · version à vérifier" : m.renderStatus === "failed" ? "Échec du rendu" : m.renderStatus === "rendering" ? "Rendu en cours" : "Montage en préparation"}</p><Link className={button} to={`${studioHref(params, "reel")}&montage=${encodeURIComponent(m.id)}`}>Reprendre le montage</Link></li>)}</ul>
        </section>
        <section aria-labelledby="prepare-heading" className="min-w-0 rounded-2xl border border-line bg-[#F7F7F9] p-4"><h2 id="prepare-heading" className="mb-1 text-lg font-semibold"><span className="mr-2 text-brand">02</span>Préparer le post <span className="text-xs font-normal text-mut">{drafts.length}</span></h2><p className="mb-4 text-xs text-mut">Média attaché, légende et comptes.</p>{loading ? <p role="status" className="py-6 text-sm text-mut">Chargement des contenus…</p> : drafts.length ? <ul className="space-y-3">{drafts.map(card)}</ul> : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-mut">Envoie un média vers le post depuis le montage ou l’éditeur visuel.</p>}</section>
        <section aria-labelledby="validate-heading" className="min-w-0 rounded-2xl border border-line bg-[#F7F7F9] p-4"><h2 id="validate-heading" className="mb-1 text-lg font-semibold"><span className="mr-2 text-brand">03</span>Valider <span className="text-xs font-normal text-mut">{review.length}</span></h2><p className="mb-4 text-xs text-mut">Relire la version complète avant diffusion.</p>{loading ? <p role="status" className="py-6 text-sm text-mut">Chargement des contenus…</p> : review.length ? <ul className="space-y-3">{review.map(card)}</ul> : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-mut">Les posts prêts à relire apparaîtront ici.</p>}</section>
      </section>
      <p className="mt-4 text-xs text-mut">Compteurs sur les contenus chargés et filtrés. Valider approuve une version ; publier ou programmer reste une action distincte.</p>
      {hasMore && <button className={`${button} mt-4`} disabled={busy} onClick={loadMore}>{busy ? "Chargement…" : "Charger plus de contenus"}</button>}
      {past.length > 0 && <details className="mt-6"><summary className="cursor-pointer text-sm font-medium">Historique · {past.length} contenu(s)</summary><ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{past.map(card)}</ul></details>}
    </>}
    {preview && error && <p role="alert" className="fixed bottom-24 left-1/2 z-[100] w-[90%] max-w-lg -translate-x-1/2 rounded-lg border border-red-300 bg-white p-4 text-sm text-red-800">{error}</p>}
    {preview && <PostPreview key={preview.id} item={preview} busy={busy || demo} onValidate={(id) => approve(id, "approved")} onArchive={(id) => approve(id, "archived")} onClose={() => setPreview(null)} onSaved={(d) => { setPreview(d); setRevision((n) => n + 1); }} />}
  </main>;
}

function Thumb({ d }: { d: Deliverable }) {
  const image = d.media.find((m) => m.type === "image");
  return image?.url ? <img src={image.url} alt={image.alt ?? ""} loading="lazy" className="h-20 w-16 shrink-0 rounded-lg object-cover" /> : <span aria-hidden className="grid h-20 w-16 shrink-0 place-items-center rounded-lg bg-brand-soft text-xs font-medium text-brand">{formatOf(d) === "reel" ? "Vidéo" : "Post"}</span>;
}
