"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "@/components/social/router";
import {
  listEditorialDeliverables, listCampaigns, listClubWorkspaces, setDeliverableStatus,
  type Deliverable, type DeliverableStatus, type Campaign, type ClubWorkspace,
} from "@/lib/social/api";
import { calendarRange, localDayKey, shiftCalendar, type CalendarView } from "@/domain/social/editorial-calendar";
import { channelLabel } from "@/lib/social/content";
import PostPreview from "@/components/social/PostPreview";

const STATUS: Record<DeliverableStatus, string> = { draft: "Brouillon", review: "À valider", approved: "Validé", published: "Publié", archived: "Archivé" };
const inputClass = "rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-fg [&>option]:bg-ink";
const buttonClass = "rounded-lg border border-line px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50";
const PAGE_SIZE = 100;

/**
 * `embedded` : affichage Calendrier de la page Réseaux sociaux (2026-10-21) — la page fournit l'en-tête et les filtres
 * (mêmes paramètres d'URL : workspaceId, campaignId, channel, status) ; `match` applique sa recherche et son format.
 */
export default function Calendar({ embedded = false, match }: { embedded?: boolean; match?: (item: Deliverable) => boolean } = {}) {
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get("workspaceId") ?? "";
  const campaignId = params.get("campaignId") ?? "";
  const channel = params.get("channel") ?? "";
  const status = (params.get("status") ?? "") as DeliverableStatus | "";
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => localDayKey(new Date()));
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clubs, setClubs] = useState<ClubWorkspace[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [items, setItems] = useState<Deliverable[]>([]);
  const [drafts, setDrafts] = useState<Deliverable[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draftsHaveMore, setDraftsHaveMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState<Deliverable | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const generation = useRef(0);
  const range = useMemo(() => calendarRange(anchor, view), [anchor, view]);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    let active = true;
    Promise.all([listCampaigns(), listClubWorkspaces()]).then(([c, w]) => {
      if (active) { setCampaigns(c.items); setClubs(w.items); setReferenceError(null); }
    }).catch((e: Error) => { if (active) setReferenceError(e.message); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    const request = ++generation.current;
    let active = true;
    setLoading(true); setError(null); setDraftError(null); setItems([]); setDrafts([]);
    setHasMore(false); setDraftsHaveMore(false); setMoreBusy(false);
    const filter = { workspaceId: workspaceId || undefined, campaignId: campaignId || undefined, channel: channel || undefined, status: status || undefined, limit: PAGE_SIZE };
    Promise.allSettled([
      listEditorialDeliverables({ ...filter, from: range.from, to: range.to }),
      listEditorialDeliverables({ ...filter, unscheduled: true }),
    ]).then(([scheduled, unscheduled]) => {
      if (!active || request !== generation.current) return;
      if (scheduled.status === "fulfilled") {
        setItems(scheduled.value.items); setHasMore(scheduled.value.hasMore); setDemo(scheduled.value.demo);
      } else setError(scheduled.reason instanceof Error ? scheduled.reason.message : "Le calendrier n'a pas pu être chargé.");
      if (unscheduled.status === "fulfilled") { setDrafts(unscheduled.value.items); setDraftsHaveMore(unscheduled.value.hasMore); }
      else setDraftError(unscheduled.reason instanceof Error ? unscheduled.reason.message : "Les contenus sans date n'ont pas pu être chargés.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [workspaceId, campaignId, channel, status, range.from, range.to, revision]);

  const byDay = useMemo(() => {
    const grouped = new Map<string, Deliverable[]>();
    for (const item of items) {
      if (match && !match(item)) continue;
      if (!item.scheduledAt) continue;
      const key = localDayKey(new Date(item.scheduledAt));
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return grouped;
  }, [items, match]);
  const campaignNames = useMemo(() => new Map(campaigns.map((c) => [c.id, c.name])), [campaigns]);

  function filter(name: string, value: string) {
    setParams((old) => {
      const next = new URLSearchParams(old);
      if (value) next.set(name, value); else next.delete(name);
      if (name === "workspaceId") next.delete("campaignId");
      return next;
    });
    setPreview(null);
  }

  async function loadMore(unscheduled: boolean) {
    const request = generation.current;
    setMoreBusy(true);
    try {
      const page = await listEditorialDeliverables({
        workspaceId: workspaceId || undefined, campaignId: campaignId || undefined, channel: channel || undefined,
        status: status || undefined, limit: PAGE_SIZE, offset: unscheduled ? drafts.length : items.length,
        ...(unscheduled ? { unscheduled: true } : { from: range.from, to: range.to }),
      });
      if (request !== generation.current) return;
      if (unscheduled) { setDrafts((old) => [...old, ...page.items]); setDraftsHaveMore(page.hasMore); setDraftError(null); }
      else { setItems((old) => [...old, ...page.items]); setHasMore(page.hasMore); setError(null); }
    } catch (e) {
      if (request === generation.current) (unscheduled ? setDraftError : setError)((e as Error).message);
    } finally { if (request === generation.current) setMoreBusy(false); }
  }

  async function changeStatus(id: string, next: "approved" | "archived") {
    if (!preview || preview.id !== id || demo) return;
    setBusyId(id); setActionError(null);
    try {
      await setDeliverableStatus(id, next, preview.contentVersion);
      setPreview(null); setRevision((n) => n + 1);
    } catch (e) { setActionError((e as Error).message); }
    finally { setBusyId(null); }
  }

  function contentCard(item: Deliverable) {
    return <button key={item.id} onClick={() => { setPreview(item); setActionError(null); }} className="w-full rounded-lg border border-line bg-black/[0.02] p-2.5 text-left transition hover:border-brand focus-visible:outline-brand">
      <span className="text-[11px] font-semibold text-brand">{channelLabel(item.channel)} · {STATUS[item.status]}</span>
      <span className="mt-1 block break-words text-sm font-medium">{item.title || "Sans titre"}</span>
      {item.campaignId && <span className="mt-1 block truncate text-[11px] text-mut">{campaignNames.get(item.campaignId) ?? "Campagne associée"}</span>}
      {item.scheduledAt && <time dateTime={item.scheduledAt} className="mt-1 block text-xs text-mut">{new Date(item.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>}
    </button>;
  }

  const Shell = embedded ? "div" : "main";
  return <Shell className={embedded ? "" : "mx-auto max-w-7xl px-5 pb-28 pt-12"}>
    {!embedded && <><div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="kicker text-brand">Instagram BeeRecos</p><h1 className="mt-2 font-display text-4xl">Calendrier éditorial</h1><p className="mt-3 max-w-2xl text-sm text-mut">Prépare, organise et valide tes contenus. Les dates prévues ne déclenchent aucune publication automatique.</p></div>
      <Link className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white" to="/library">Ajouter un réel terminé</Link>
    </div>
    </>}
    {demo && <p role="status" className="card mt-4 p-3 text-sm">Démonstration — les modifications nécessitent une connexion au service.</p>}
    {referenceError && <p role="alert" className="card mt-4 p-3 text-sm">Chargement des clubs et campagnes : {referenceError} <button className="underline" onClick={() => setRevision((n) => n + 1)}>Réessayer</button></p>}
    {!embedded && <div className="mt-6 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-mut">Club<select aria-label="Filtrer par club" className={inputClass} value={workspaceId} onChange={(e) => filter("workspaceId", e.target.value)}><option value="">Tous les clubs autorisés</option>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-mut">Campagne<select aria-label="Filtrer par campagne" className={inputClass} value={campaignId} onChange={(e) => filter("campaignId", e.target.value)}><option value="">Toutes les campagnes</option>{campaigns.filter((c) => !workspaceId || c.workspace_id === workspaceId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-mut">Réseau<select aria-label="Réseau" className={inputClass} value={channel} onChange={(e) => filter("channel", e.target.value)}><option value="">Tous les canaux</option><option value="linkedin">LinkedIn</option><option value="instagram">Instagram</option><option value="email">Email</option></select></label>
      <label className="grid gap-1 text-xs text-mut">Statut<select aria-label="Statut" className={inputClass} value={status} onChange={(e) => filter("status", e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>}
    <div className={`${embedded ? "" : "mt-6 "}flex flex-wrap items-center gap-2`}>
      <button className={buttonClass} onClick={() => setAnchor(shiftCalendar(anchor, view, -1))} aria-label="Période précédente">←</button>
      <button className={buttonClass} onClick={() => setAnchor(localDayKey(new Date()))}>Aujourd’hui</button>
      <button className={buttonClass} onClick={() => setAnchor(shiftCalendar(anchor, view, 1))} aria-label="Période suivante">→</button>
      <label className="sr-only" htmlFor="editorial-date">Date du calendrier</label><input id="editorial-date" type="date" className={inputClass} value={anchor} onChange={(e) => { if (e.target.value) setAnchor(e.target.value); }} />
      <div className="ml-auto flex gap-1" aria-label="Vue du calendrier">{(["week", "month"] as const).map((value) => <button key={value} aria-pressed={view === value} className={`${buttonClass} ${view === value ? "border-brand text-brand" : ""}`} onClick={() => setView(value)}>{value === "week" ? "Semaine" : "Mois"}</button>)}</div>
    </div>
    <p className="mt-3 text-xs text-mut">Horaires : {timeZone}. {items.length} contenu(s) daté(s) chargé(s){hasMore ? " — d’autres contenus restent à charger." : "."}</p>
    {loading && <p role="status" className="card mt-4 p-4 text-sm">Chargement du calendrier…</p>}
    {error && <div role="alert" className="card mt-4 p-4 text-sm">{error} <button className="ml-2 underline" onClick={() => setRevision((n) => n + 1)}>Réessayer</button></div>}
    {!loading && !error && <>
      {items.length === 0 && <p className="mt-4 text-sm text-mut">Aucun contenu daté sur cette période avec ces filtres. Choisis un jour pour préparer un post.</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{range.days.map((day) => {
        const key = localDayKey(day);
        return <section key={key} aria-label={day.toLocaleDateString("fr-FR", { dateStyle: "full" })} className={`card min-h-32 p-2 ${key === localDayKey(new Date()) ? "border-brand/60" : ""}`}>
          <div className="mb-2 flex items-center justify-between gap-1"><h2 className="text-xs font-semibold">{day.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</h2><Link aria-label={`Créer un post le ${day.toLocaleDateString("fr-FR")}`} className="rounded px-2 py-1 text-brand hover:bg-brand/10" to="/library">+</Link></div>
          <div className="space-y-2">{(byDay.get(key) ?? []).map(contentCard)}</div>
        </section>;
      })}</div>
      {hasMore && <button disabled={moreBusy} className={`${buttonClass} mt-4`} onClick={() => loadMore(false)}>{moreBusy ? "Chargement…" : "Charger les autres contenus de cette période"}</button>}
    </>}
    <section className="mt-8 border-t border-line pt-6"><h2 className="font-display text-xl">Sans date prévue</h2><p className="mt-1 text-sm text-mut">Ouvre un contenu pour lui attribuer une date ou le rattacher à une campagne.</p>
      {draftError && <p role="alert" className="mt-3 text-sm">{draftError} <button className="underline" onClick={() => setRevision((n) => n + 1)}>Réessayer</button></p>}
      {!loading && !draftError && drafts.length === 0 && <p className="mt-3 text-sm text-mut">Aucun contenu sans date avec ces filtres.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(match ? drafts.filter(match) : drafts).map(contentCard)}</div>
      {draftsHaveMore && <button className={`${buttonClass} mt-4`} disabled={moreBusy} onClick={() => loadMore(true)}>{moreBusy ? "Chargement…" : "Charger d’autres contenus sans date"}</button>}
    </section>
    {actionError && <p role="alert" className="fixed bottom-4 left-1/2 z-[60] w-[90%] max-w-lg -translate-x-1/2 rounded-lg border border-red-300 bg-white p-3 text-sm text-red-800">{actionError}</p>}
    {preview && <PostPreview key={preview.id} item={preview} busy={busyId === preview.id || demo} onValidate={(id) => changeStatus(id, "approved")} onArchive={(id) => changeStatus(id, "archived")} onClose={() => setPreview(null)} onSaved={(item) => { setPreview(item); setRevision((n) => n + 1); }} />}
  </Shell>;
}
