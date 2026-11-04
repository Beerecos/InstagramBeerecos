"use client";
/**
 * Onglet Post (accueil) = tableau de bord des posts en cours : compteurs par étape (cliquables), « à reprendre »,
 * « prêts à publier », scripts, publiés récemment. Un bouton « Créer » (réel IA, réel filmé, post). Le Studio ne s'ouvre
 * que pour un réel ; un post s'ouvre dans l'éditeur de post. La vue choisie est dans l'adresse (?vue=…).
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Bot, FileText, Film, GalleryHorizontal, Image as ImageIcon, Plus, Search, Upload, X } from "lucide-react";
import { studioAssets } from "@/lib/social/studio-assets-api";
import type { StudioAsset } from "@/domain/social/studio-assets";
import { STAGES, STAGE_LABELS, countByStage, stageOf, type Stage } from "@/domain/instagram/dashboard";
import { isMontageConfigured, montage, type MontageSummary } from "@/lib/social/montage-api";
import { instagram } from "@/lib/instagram/api";
import { STATUS_LABELS, type Publication } from "@/domain/instagram/publication";
import { matchesQuery, reelState } from "@/domain/reels/project";

const PUB_TONE: Record<Publication["status"], string> = {
  draft: "bg-black/[0.05] text-mut", publishing: "bg-brand-soft text-brand", published: "bg-acid/15 text-acid-dim", error: "bg-red-50 text-red-700",
};

type Choice = { href: string; title: string; text: string; points: string[]; icon: typeof Bot; art: string };
const CHOICES: Choice[] = [
  { href: "/reels/nouveau/ia", title: "Réel IA", text: "Une vidéo créée à partir d'un script, sans tournage.", points: ["Script, voix et animations", "Ouvre le Studio"], icon: Bot, art: "bg-brand text-white" },
  { href: "/reels/nouveau/video", title: "Réel filmé", text: "Ta vidéo déjà tournée, montée dans le Studio.", points: ["Coupes, sous-titres, effets", "Ouvre le Studio"], icon: Upload, art: "bg-black text-white" },
  { href: "/post/nouveau", title: "Post", text: "Une photo ou un carrousel de 2 à 10 photos, avec sa légende.", points: ["Post simple ou carrousel, au choix", "Légende écrite avec l'IA"], icon: ImageIcon, art: "bg-brand-soft text-brand" },
];

/** Fenêtre « Créer » : trois grandes cartes côte à côte, comme le choix d'un type de campagne. */
function CreateDialog({ onClose }: { onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="creer-titre" className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-xl sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="creer-titre" className="font-display text-2xl font-semibold">Que veux-tu créer ?</h2>
            <p className="mt-1 text-sm text-mut">Choisis un format. Tu pourras le publier sur Instagram une fois prêt.</p>
          </div>
          <button type="button" aria-label="Fermer" className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-black/[0.05]" onClick={onClose}><X aria-hidden size={20} /></button>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {CHOICES.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg focus-visible:border-brand">
                <span className={`grid h-36 place-items-center ${c.art}`}><c.icon aria-hidden size={48} strokeWidth={1.5} /></span>
                <span className="flex flex-1 flex-col gap-2 p-4">
                  <span className="text-lg font-semibold">{c.title}</span>
                  <span className="text-sm text-mut">{c.text}</span>
                  <span className="mt-1 space-y-1 text-xs text-mut">{c.points.map((pt) => <span key={pt} className="block">· {pt}</span>)}</span>
                  <span className="btn-red mt-auto min-h-11 w-full justify-center group-hover:brightness-110">Créer</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-sm text-mut">Pas encore de texte ? <Link href="/scripts/nouveau" className="font-medium text-brand underline">Écrire un script</Link> (du hook au call to action), puis fais-en un réel.</p>
      </div>
    </div>
  );
}

type CardType = "reel" | "reel-ia" | "post" | "carrousel";
const TYPE: Record<CardType, { label: string; icon: typeof Film; tone: string }> = {
  reel: { label: "Réel filmé", icon: Film, tone: "bg-black text-white" },
  "reel-ia": { label: "Réel IA", icon: Bot, tone: "bg-brand text-white" },
  post: { label: "Post simple", icon: ImageIcon, tone: "bg-brand-soft text-brand" },
  carrousel: { label: "Carrousel", icon: GalleryHorizontal, tone: "bg-brand-soft text-brand" },
};
function TypeBadge({ type }: { type: CardType | null }) {
  if (!type) return <span className="pill bg-black/[0.05] text-mut">Réel</span>;
  const t = TYPE[type];
  return <span className={`pill inline-flex items-center gap-1 ${t.tone}`}><t.icon aria-hidden size={12} />{t.label}</span>;
}
export type Removal = { kind: "reel" | "post"; id: string; title: string };
function DeleteButton({ title, disabled, reason, onClick }: { title: string; disabled?: boolean; reason?: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={`Supprimer « ${title} »`} title={disabled ? reason : "Supprimer"} disabled={disabled} onClick={onClick}
      className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-lg text-mut hover:bg-red-50 hover:text-red-700 disabled:opacity-30"><X aria-hidden size={16} /></button>
  );
}

function ReelItem({ m, pub, onDelete }: { m: MontageSummary; pub?: Publication; onDelete: (r: Removal) => void }) {
  // Détail du montage : origine (IA ou filmé) et image de la prise pour la vignette.
  const [detail, setDetail] = useState<{ ai: boolean; videoUrl: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    montage.get(m.id).then((d) => { if (alive) setDetail({ ai: Boolean(d.montage.aiSource), videoUrl: d.videoUrl }); }).catch(() => {});
    return () => { alive = false; };
  }, [m.id, m.updatedAt]);
  const state = reelState(m);
  const thumb = m.finalVideoUrl ?? detail?.videoUrl ?? null;
  const published = pub?.status === "published" || pub?.status === "publishing";
  return (
    <li className="relative">
      <DeleteButton title={m.title} disabled={m.renderStatus === "rendering" || published} reason={published ? "Déjà publié" : "Rendu en cours"} onClick={() => onDelete({ kind: "reel", id: m.id, title: m.title })} />
      <Link href={`/reels/${m.id}${m.renderStatus === "done" && m.finalVideoUrl || published ? "?panel=post" : ""}`} className="card flex gap-3 p-3 pr-12 transition hover:border-brand/40">
        <div className="relative aspect-[9/16] w-16 shrink-0 overflow-hidden rounded-lg bg-black/[0.06]">
          {thumb ? <video src={`${thumb}#t=0.5`} preload="metadata" muted playsInline aria-hidden className="h-full w-full object-cover" /> : <Film aria-hidden className="absolute inset-0 m-auto text-mut-2" size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{m.title}</p>
          <p className="mt-0.5 text-xs text-mut">{new Date(m.updatedAt).toLocaleDateString("fr-FR")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TypeBadge type={detail ? (detail.ai ? "reel-ia" : "reel") : null} />
            <span className={`pill ${pub ? PUB_TONE[pub.status] : "bg-black/[0.05] text-mut"}`}>{pub && pub.status !== "draft" ? STATUS_LABELS[pub.status] : state.label}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function PostItem({ p, preview, onDelete }: { p: Publication; preview?: string; onDelete: (r: Removal) => void }) {
  const locked = p.status === "published" || p.status === "publishing" || p.linkedinStatus === "published" || p.linkedinStatus === "publishing";
  return (
    <li className="relative">
      <DeleteButton title={p.title || "Post sans légende"} disabled={locked} reason="Déjà publié : il se retire depuis Instagram ou LinkedIn" onClick={() => onDelete({ kind: "post", id: p.id, title: p.title || "Post sans légende" })} />
      <Link href={`/post/${p.id}`} className="card flex w-full gap-3 p-3 pr-12 text-left transition hover:border-brand/40">
        <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg bg-black/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element -- lien signé de 10 min, pas d'optimisation possible */}
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImageIcon aria-hidden className="absolute inset-0 m-auto text-mut-2" size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.title || "Post sans légende"}</p>
          <p className="mt-0.5 text-xs text-mut">{p.media.length > 1 ? `${p.media.length} photos · ` : ""}{new Date(p.updatedAt).toLocaleDateString("fr-FR")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TypeBadge type={p.media.length > 1 ? "carrousel" : "post"} />
            <span className={`pill ${PUB_TONE[p.status]}`}>{p.status === "draft" ? (stageOf({ kind: "post", pub: p }) === "pret" ? "Prêt à publier" : "À compléter") : STATUS_LABELS[p.status]}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

type Entry = { key: string; at: string; stage: Stage; title: string; node: React.ReactNode };
type View = "accueil" | Stage | "tout";
const VIEWS: View[] = ["accueil", ...STAGES, "tout"];

function Section({ id, title, count, action, children }: { id: string; title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold">{title}{count !== undefined ? <span className="ml-2 text-sm font-normal text-mut">{count}</span> : null}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function PostHub() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view: View = VIEWS.includes(params.get("vue") as View) ? (params.get("vue") as View) : "accueil";
  const setView = (v: View) => router.replace(v === "accueil" ? pathname : `${pathname}?vue=${v}`, { scroll: false });

  const [reels, setReels] = useState<MontageSummary[] | null>(isMontageConfigured ? null : []);
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [scripts, setScripts] = useState<StudioAsset[] | null>(isMontageConfigured ? null : []);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(params.get("creer") === "1");
  const [removing, setRemoving] = useState<Removal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const confirmRemove = async () => {
    const r = removing;
    if (!r) return;
    setRemoving(null); setNotice(null);
    try {
      if (r.kind === "reel") {
        await montage.archive(r.id);
        setReels((all) => (all ?? []).filter((x) => x.id !== r.id));
        setNotice(`« ${r.title} » est dans la corbeille : tu peux le restaurer depuis « Corbeille des projets ».`);
      } else {
        await instagram.remove(r.id);
        setPubs((all) => all.filter((x) => x.id !== r.id));
        setNotice(`« ${r.title} » est supprimé.`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Suppression impossible."); }
  };

  const load = useCallback(() => {
    if (isMontageConfigured) {
      montage.list().then((r) => setReels(r.montages.filter((m) => !m.archivedAt))).catch((e: Error) => setError(e.message));
      studioAssets.list("motion").then((r) => setScripts(r.assets.filter((a) => a.status !== "archived"))).catch(() => setScripts([]));
    }
    instagram.list().then((r) => { setPubs(r.items); setPreviews(r.previews); }).catch((e: Error) => setError(e.message));
    instagram.connection().then((c) => setConnected(c.connected)).catch(() => setConnected(false));
  }, []);
  useEffect(load, [load]);

  const entries = useMemo<Entry[]>(() => {
    const byMontage = new Map(pubs.filter((p) => p.montageId).map((p) => [p.montageId!, p]));
    const r = (reels ?? []).map((m) => {
      const pub = byMontage.get(m.id);
      return { key: `r${m.id}`, at: m.updatedAt, title: m.title, stage: stageOf({ kind: "reel", reel: m, pub }), node: <ReelItem key={`r${m.id}`} m={m} pub={pub} onDelete={setRemoving} /> };
    });
    const p = pubs.filter((x) => x.kind === "post").map((x) => ({ key: `p${x.id}`, at: x.updatedAt, title: `${x.title} ${x.caption}`, stage: stageOf({ kind: "post", pub: x }), node: <PostItem key={`p${x.id}`} p={x} preview={previews[x.media[0]?.path ?? ""]} onDelete={setRemoving} /> }));
    return [...r, ...p].sort((a, b) => b.at.localeCompare(a.at));
  }, [reels, pubs, previews]);
  const counts = countByStage(entries.map((e) => e.stage));
  const of = (s: Stage) => entries.filter((e) => e.stage === s);
  const grid = (list: Entry[]) => <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((e) => e.node)}</ul>;
  const more = (s: Stage, n: number) => (n > 6 ? <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-brand hover:bg-brand-soft" onClick={() => setView(s)}>Tout voir <ArrowRight aria-hidden size={14} /></button> : null);
  const loading = reels === null && !error;
  const empty = !loading && entries.length === 0;
  const filtered = view === "accueil" ? [] : entries.filter((e) => (view === "tout" || e.stage === view) && matchesQuery(e.title, q));

  return (
    <div className="social-studio -mx-4 min-h-full px-4 py-2 sm:-mx-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Post</h1>
          <p className="mt-1 text-sm text-mut">Tes réels et tes posts en cours, de la préparation à la publication.</p>
        </div>
        <button type="button" className="btn-red min-h-12 px-5 text-base" onClick={() => setCreating(true)}><Plus aria-hidden size={18} /> Créer</button>
      </header>

      {connected === false ? (
        <p role="status" className="card mt-4 p-3 text-sm">Instagram n&apos;est pas encore connecté : tu peux tout préparer, la publication s&apos;active après <Link href="/settings#instagram" className="text-brand underline">Paramètres → Instagram</Link>.</p>
      ) : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 text-sm">{notice}</p> : null}

      <nav aria-label="Étapes" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAGES.map((s) => (
          <button key={s} type="button" aria-pressed={view === s} onClick={() => setView(view === s ? "accueil" : s)}
            className={`card flex min-h-20 flex-col items-start justify-between p-4 text-left transition hover:border-brand/50 ${view === s ? "border-brand ring-2 ring-brand/20" : ""}`}>
            <span className="text-3xl font-semibold tabular-nums">{loading ? "–" : counts[s]}</span>
            <span className="text-sm text-mut">{STAGE_LABELS[s]}</span>
          </button>
        ))}
      </nav>

      {loading ? <p role="status" className="mt-8 text-sm text-mut">Chargement…</p> : null}

      {view !== "accueil" ? (
        <Section id="liste" title={view === "tout" ? "Toutes les créations" : STAGE_LABELS[view]} count={filtered.length}
          action={<button type="button" className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm text-brand hover:bg-brand-soft" onClick={() => setView("accueil")}>Retour au tableau de bord</button>}>
          <label className="mb-3 flex max-w-sm items-center gap-2 rounded-lg border border-line bg-white px-3">
            <Search aria-hidden size={16} className="text-mut" /><span className="sr-only">Rechercher</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className="min-h-11 flex-1 bg-transparent text-sm outline-none" />
          </label>
          {filtered.length ? grid(filtered) : <p className="card p-4 text-sm text-mut">{q ? "Rien ne correspond." : "Rien à cette étape pour l'instant."}</p>}
        </Section>
      ) : empty ? (
        <div className="card mt-8 flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-medium">Aucune création pour l&apos;instant.</p>
          <p className="text-sm text-mut">Commence par un réel ou un post : tout ce que tu prépares apparaîtra ici.</p>
          <button type="button" className="btn-red min-h-11" onClick={() => setCreating(true)}><Plus aria-hidden size={16} /> Créer ma première publication</button>
        </div>
      ) : !loading ? <>
        <Section id="reprendre" title="À reprendre" count={counts.preparation} action={more("preparation", counts.preparation)}>
          {counts.preparation ? grid(of("preparation").slice(0, 6)) : <p className="text-sm text-mut">Rien en cours : tout est prêt ou publié.</p>}
        </Section>
        <Section id="prets" title="Prêts à publier" count={counts.pret} action={more("pret", counts.pret)}>
          {counts.pret ? grid(of("pret").slice(0, 6)) : <p className="text-sm text-mut">Un réel est prêt quand son MP4 est rendu ; un post, quand il a une photo et une légende.</p>}
        </Section>
        {counts.publication ? <Section id="en-cours" title="En publication" count={counts.publication}>{grid(of("publication"))}</Section> : null}
      </> : null}

      {view === "accueil" && !loading ? (
        <Section id="scripts" title="Scripts" count={scripts?.length}
          action={<Link href="/scripts" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-brand hover:bg-brand-soft">Les 72 scripts et mes prises <ArrowRight aria-hidden size={14} /></Link>}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Link href="/scripts/nouveau" className="card flex items-center gap-3 border-dashed p-3 text-brand hover:border-brand"><span className="grid size-10 place-items-center rounded-lg bg-brand-soft"><Plus aria-hidden size={18} /></span><span className="font-semibold">Nouveau script</span></Link>
            {(scripts ?? []).slice(0, 5).map((a) => (
              <Link key={a.id} href={`/scripts/${a.id}`} className="card flex items-center gap-3 p-3 hover:border-brand/40">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-black/[0.05] text-mut"><FileText aria-hidden size={18} /></span>
                <span className="min-w-0"><span className="block truncate font-semibold">{a.title}</span><span className="text-xs text-mut">Révision {a.revision} · {new Date(a.updatedAt).toLocaleDateString("fr-FR")}</span></span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {view === "accueil" && counts.publie ? (
        <Section id="publies" title="Publiés récemment" count={counts.publie} action={more("publie", counts.publie)}>{grid(of("publie").slice(0, 3))}</Section>
      ) : null}

      <p className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mut">
        <button type="button" className="text-brand underline" onClick={() => setView("tout")}>Toutes les créations</button>
        <Link href="/library" className="text-brand underline">Sons et images du studio</Link>
        <Link href="/reels" className="text-brand underline">Corbeille des projets</Link>
      </p>

      {creating ? <CreateDialog onClose={() => setCreating(false)} /> : null}
      {removing ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby="supprimer-titre" className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4">
          <div className="card w-full max-w-md space-y-3 p-5">
            <h2 id="supprimer-titre" className="font-semibold">Supprimer « {removing.title} » ?</h2>
            <p className="text-sm text-mut">{removing.kind === "reel" ? "Le réel part dans la corbeille : sa vidéo et son montage sont conservés, tu peux le restaurer." : "Le brouillon et ses réglages sont supprimés définitivement."}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost min-h-11" onClick={() => setRemoving(null)}>Annuler</button>
              <button type="button" className="btn-red min-h-11" onClick={() => { void confirmRemove(); }}>{removing.kind === "reel" ? "Mettre à la corbeille" : "Supprimer"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
