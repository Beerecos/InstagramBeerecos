"use client";
/**
 * Onglet Post : un seul bouton « Créer » (réel IA, réel filmé, post simple) et toutes les créations au même endroit,
 * avec leur état réel (en montage, prêt, publié). Un réel s'ouvre dans le studio sur son panneau Post ; un post simple
 * s'ouvre dans sa fenêtre.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Film, Image as ImageIcon, Plus, Search, Upload, X } from "lucide-react";
import { isMontageConfigured, montage, type MontageSummary } from "@/lib/social/montage-api";
import { instagram } from "@/lib/instagram/api";
import { STATUS_LABELS, type Publication } from "@/domain/instagram/publication";
import { matchesQuery, reelState } from "@/domain/reels/project";
import PostForm from "./post-form";

type Filter = "tout" | "reels" | "posts";
const PUB_TONE: Record<Publication["status"], string> = {
  draft: "bg-black/[0.05] text-mut", publishing: "bg-brand-soft text-brand", published: "bg-acid/15 text-acid-dim", error: "bg-red-50 text-red-700",
};

function CreateDialog({ onClose, onPost }: { onClose: () => void; onPost: () => void }) {
  const choice = "card flex items-center gap-4 p-4 text-left transition hover:border-brand/50 hover:bg-brand-soft/30";
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="creer-titre" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between text-white">
          <h2 id="creer-titre" className="text-lg font-semibold">Que veux-tu créer ?</h2>
          <button type="button" aria-label="Fermer" className="grid size-10 place-items-center rounded-lg hover:bg-white/10" onClick={onClose}><X aria-hidden size={18} /></button>
        </div>
        <Link href="/reels/nouveau/ia" className={choice}>
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-white"><Bot aria-hidden size={22} /></span>
          <span><span className="block font-semibold">Réel IA</span><span className="text-sm text-mut">À partir d&apos;un script, sans tournage.</span></span>
        </Link>
        <Link href="/reels/nouveau/video" className={choice}>
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-black text-white"><Upload aria-hidden size={22} /></span>
          <span><span className="block font-semibold">Réel filmé</span><span className="text-sm text-mut">Importe ta vidéo déjà tournée, puis monte-la.</span></span>
        </Link>
        <button type="button" className={`${choice} w-full`} onClick={onPost}>
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-brand ring-1 ring-line"><ImageIcon aria-hidden size={22} /></span>
          <span><span className="block font-semibold">Post simple</span><span className="text-sm text-mut">Une photo ou un carrousel, avec sa légende.</span></span>
        </button>
      </div>
    </div>
  );
}

function ReelItem({ m, pub }: { m: MontageSummary; pub?: Publication }) {
  const state = reelState(m);
  const thumb = m.finalVideoUrl;
  return (
    <li>
      <Link href={`/reels/${m.id}?panel=post`} className="card flex gap-3 p-3 transition hover:border-brand/40">
        <div className="relative aspect-[9/16] w-16 shrink-0 overflow-hidden rounded-lg bg-black/[0.06]">
          {thumb ? <video src={`${thumb}#t=0.5`} preload="metadata" muted playsInline aria-hidden className="h-full w-full object-cover" /> : <Film aria-hidden className="absolute inset-0 m-auto text-mut-2" size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{m.title}</p>
          <p className="mt-0.5 text-xs text-mut">Réel · {new Date(m.updatedAt).toLocaleDateString("fr-FR")}</p>
          <span className={`pill mt-2 ${pub ? PUB_TONE[pub.status] : "bg-black/[0.05] text-mut"}`}>{pub && pub.status !== "draft" ? STATUS_LABELS[pub.status] : state.label}</span>
        </div>
      </Link>
    </li>
  );
}

function PostItem({ p, preview, onOpen }: { p: Publication; preview?: string; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="card flex w-full gap-3 p-3 text-left transition hover:border-brand/40">
        <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg bg-black/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element -- lien signé de 10 min, pas d'optimisation possible */}
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImageIcon aria-hidden className="absolute inset-0 m-auto text-mut-2" size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.title || "Post sans légende"}</p>
          <p className="mt-0.5 text-xs text-mut">{p.media.length > 1 ? `Carrousel · ${p.media.length} photos` : "Photo"} · {new Date(p.updatedAt).toLocaleDateString("fr-FR")}</p>
          <span className={`pill mt-2 ${PUB_TONE[p.status]}`}>{STATUS_LABELS[p.status]}</span>
        </div>
      </button>
    </li>
  );
}

export default function PostHub() {
  const [reels, setReels] = useState<MontageSummary[] | null>(isMontageConfigured ? null : []);
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("tout");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Publication | "new" | null>(null);

  const load = useCallback(() => {
    if (isMontageConfigured) montage.list().then((r) => setReels(r.montages.filter((m) => !m.archivedAt))).catch((e: Error) => setError(e.message));
    instagram.list().then((r) => { setPubs(r.items); setPreviews(r.previews); }).catch((e: Error) => setError(e.message));
    instagram.connection().then((c) => setConnected(c.connected)).catch(() => setConnected(false));
  }, []);
  useEffect(load, [load]);

  const byMontage = useMemo(() => new Map(pubs.filter((p) => p.montageId).map((p) => [p.montageId!, p])), [pubs]);
  const items = useMemo(() => {
    const r = filter === "posts" ? [] : (reels ?? []).filter((m) => matchesQuery(m.title, q)).map((m) => ({ at: m.updatedAt, key: `r${m.id}`, node: <ReelItem key={`r${m.id}`} m={m} pub={byMontage.get(m.id)} /> }));
    const p = filter === "reels" ? [] : pubs.filter((x) => x.kind === "post" && matchesQuery(`${x.title} ${x.caption}`, q))
      .map((x) => ({ at: x.updatedAt, key: `p${x.id}`, node: <PostItem key={`p${x.id}`} p={x} preview={previews[x.media[0]?.path ?? ""]} onOpen={() => setEditing(x)} /> }));
    return [...r, ...p].sort((a, b) => b.at.localeCompare(a.at));
  }, [reels, pubs, previews, byMontage, filter, q]);

  const upsert = (p: Publication) => setPubs((all) => [p, ...all.filter((x) => x.id !== p.id)]);
  const chip = (f: Filter, label: string) => (
    <button type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`min-h-10 rounded-full px-4 text-sm ${filter === f ? "bg-fg text-white" : "bg-black/[0.05] text-fg hover:bg-black/[0.08]"}`}>{label}</button>
  );

  return (
    <div className="social-studio -mx-4 min-h-full px-4 py-2 sm:-mx-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">Post</h1>
        <button type="button" className="btn-red min-h-12 px-5 text-base" onClick={() => setCreating(true)}><Plus aria-hidden size={18} /> Créer</button>
      </header>

      {connected === false ? (
        <p role="status" className="card mt-4 p-3 text-sm">Instagram n&apos;est pas encore connecté : tu peux tout préparer, la publication s&apos;active après <Link href="/settings#instagram" className="text-brand underline">Paramètres → Instagram</Link>.</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {chip("tout", "Tout")}{chip("reels", "Réels")}{chip("posts", "Posts")}
        <label className="ml-auto flex items-center gap-2 rounded-lg border border-line bg-white px-3">
          <Search aria-hidden size={16} className="text-mut" />
          <span className="sr-only">Rechercher</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className="min-h-10 w-40 bg-transparent text-sm outline-none" />
        </label>
      </div>

      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      {reels === null && !error ? <p role="status" className="mt-6 text-sm text-mut">Chargement…</p> : null}
      {reels !== null && items.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-medium">{q ? "Rien ne correspond." : "Rien pour l'instant."}</p>
          {!q ? <button type="button" className="btn-red min-h-11" onClick={() => setCreating(true)}><Plus aria-hidden size={16} /> Créer ma première publication</button> : null}
        </div>
      ) : null}
      {items.length ? <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((i) => i.node)}</ul> : null}

      <p className="mt-10 text-xs text-mut">Sons et images du studio : <Link href="/library" className="text-brand underline">médias</Link> · Projets supprimés : <Link href="/reels" className="text-brand underline">corbeille</Link></p>

      {creating ? <CreateDialog onClose={() => setCreating(false)} onPost={() => { setCreating(false); setEditing("new"); }} /> : null}
      {editing ? (
        <PostForm initial={editing === "new" ? null : editing} previews={previews} connected={Boolean(connected)} onClose={() => setEditing(null)}
          onSaved={upsert} onDeleted={(id) => setPubs((all) => all.filter((x) => x.id !== id))} />
      ) : null}
    </div>
  );
}
