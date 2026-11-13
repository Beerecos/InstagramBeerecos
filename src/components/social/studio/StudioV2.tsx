"use client";
/**
 * Studio Reel — refonte 2026-11-12 (maquette de Cédric) : habillage sombre premium et organisation en zones
 * (en-tête, colonne gauche, vidéo, panneau Cadrage / Coupe / Animation, timeline, Publier). Composants de
 * présentation seulement : toute la logique reste dans MontageStudio (lecteur, coupes, animations, publication).
 */
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Check, CircleHelp, Crop, Film, FolderOpen, Maximize, Pause, Pencil, Play, Scissors, Send, Settings, Sparkles, Subtitles, Trash2, Upload, Video, Volume2, X } from "lucide-react";
import { VIDEO_ACCEPT } from "@/components/social/studio/video-import";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { montage, type MontageSummary } from "@/lib/social/montage-api";
import "./studio-v2.css";

export type StudioTab = "cadrage" | "coupe" | "animation";
const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

export function StudioHeader({ onCreate, onVideos, onTemplates, status, children }: { onCreate: () => void; onVideos: () => void; onTemplates: () => void; status: ReactNode; children?: ReactNode }) {
  return (
    <header className="sv2-header" aria-label="Studio BeeRecos">
      <div className="flex min-w-0 items-center gap-3">
        <img src="/brand/beerecos-logo-horizontal-white.svg" alt="BeeRecos" className="h-7 w-auto" />
        <span aria-hidden className="h-6 w-px bg-white/15" />
        <span className="font-display text-lg font-semibold italic">Studio</span>
      </div>
      <nav aria-label="Studio" className="sv2-nav">
        <button type="button" className="sv2-nav-btn sv2-active" onClick={onCreate}><Video aria-hidden size={18} /> Créer une vidéo</button>
        <button type="button" className="sv2-nav-btn" onClick={onVideos}><FolderOpen aria-hidden size={18} /> Mes vidéos</button>
        <button type="button" className="sv2-nav-btn" onClick={onTemplates}><Sparkles aria-hidden size={18} /> Templates</button>
      </nav>
      <div className="flex items-center gap-2">
        <div className="hidden text-right text-xs text-[#AAB4C3] xl:block">{status}</div>
        {children}
      </div>
    </header>
  );
}

/** Menu de l'en-tête (aide, paramètres) : fermé par défaut, rien d'affiché en permanence. */
export function HeaderMenu({ label, icon, children }: { label: string; icon: "help" | "settings"; children: ReactNode }) {
  return (
    <details className="sv2-menu">
      <summary aria-label={label} title={label}>{icon === "help" ? <CircleHelp aria-hidden size={22} /> : <Settings aria-hidden size={22} />}</summary>
      <div className="sv2-menu-panel">{children}</div>
    </details>
  );
}

/** « Importer une vidéo » ouvre directement le choix des fichiers (mobile : pellicule ou fichiers ; ordinateur : explorateur). */
export function StudioSidebar({ currentId, onRecord, onImport, onOpen, onAll, onRemovedCurrent }: { currentId: string; onRecord: () => void; onImport: (files: FileList | null) => void; onOpen: (id: string) => void; onAll: () => void; onRemovedCurrent?: () => void }) {
  const [list, setList] = useState<MontageSummary[] | null>(null);
  // Corbeille (récupérable) : un clic sur la poubelle demande confirmation sur la ligne même.
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "ko"; text: string } | null>(null);
  const remove = async (p: MontageSummary) => {
    setBusy(true); setMessage(null);
    try {
      await montage.archive(p.id);
      setList((l) => (l ?? []).filter((x) => x.id !== p.id));
      setConfirm(null);
      setMessage({ tone: "ok", text: `« ${p.title} » est dans la corbeille : rien n’est effacé, tu peux le restaurer.` });
      if (p.id === currentId) onRemovedCurrent?.();
    } catch (e) {
      setMessage({ tone: "ko", text: e instanceof Error ? e.message : "Mise à la corbeille impossible." });
    } finally { setBusy(false); }
  };
  useEffect(() => { montage.list().then((r) => setList(r.montages)).catch(() => setList([])); }, []);
  const projects = [...(list ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  // « Aujourd'hui » / « Hier » : l'heure est lue une fois, à l'ouverture (pas pendant le rendu).
  const [now] = useState(() => Date.now());
  const day = (iso: string) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; const diff = Math.floor((now - d.getTime()) / 86_400_000); return diff <= 0 ? "Aujourd’hui" : diff === 1 ? "Hier" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }); };
  return (
    <aside aria-label="Nouvelle vidéo et projets" className="sv2-panel sv2-side">
      <h2 className="sv2-h">Nouvelle vidéo</h2>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="sv2-bigcard" onClick={onRecord}><Video aria-hidden size={30} /><span>Enregistrer en direct</span></button>
        <label className="sv2-bigcard sv2-active cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-white"><Upload aria-hidden size={30} /><span>Importer une vidéo</span><small>mobile, PC, fichiers…</small>
          <input type="file" multiple aria-label="Importer une vidéo" accept={VIDEO_ACCEPT} className="sr-only" onChange={(e) => { onImport(e.target.files); e.target.value = ""; }} /></label>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <h2 className="sv2-h">Mes projets</h2>
        <button type="button" className="text-sm text-[#AAB4C3] hover:text-white" onClick={onAll}>Voir tout →</button>
      </div>
      {list === null ? <p role="status" className="mt-2 text-sm text-[#AAB4C3]">Chargement…</p> : null}
      {list && !projects.length ? <p className="mt-2 text-sm text-[#AAB4C3]">Aucun projet pour l’instant.</p> : null}
      <ul className="mt-2 space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <button type="button" aria-current={p.id === currentId ? "true" : undefined} className="sv2-project min-w-0 flex-1" onClick={() => { if (p.id !== currentId) onOpen(p.id); }}>
              <span className="sv2-thumb"><Film aria-hidden size={18} /></span>
              <span className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold">{p.title}</span><span className="block text-xs text-[#AAB4C3]">{p.keptMs ? `${clock(p.keptMs)} • ` : ""}{day(p.updatedAt)}</span></span>
            </button>
            {confirm === p.id ? <span className="flex flex-col gap-1">
              <button type="button" className="sv2-mini justify-center bg-red-600/80" disabled={busy} onClick={() => { void remove(p); }}>Corbeille</button>
              <button type="button" className="sv2-mini justify-center" disabled={busy} onClick={() => setConfirm(null)}>Annuler</button>
            </span> : <button type="button" className="sv2-icon-btn" aria-label={`Mettre « ${p.title} » à la corbeille`} title={p.renderStatus === "rendering" ? "Vidéo finale en cours de création : attends la fin" : "Mettre à la corbeille (récupérable)"} disabled={busy || p.renderStatus === "rendering"} onClick={() => { setMessage(null); setConfirm(p.id); }}><Trash2 aria-hidden size={16} /></button>}
          </li>
        ))}
      </ul>
      {message ? <p role={message.tone === "ko" ? "alert" : "status"} className={`mt-2 text-xs ${message.tone === "ko" ? "text-red-300" : "text-[#AAB4C3]"}`}>{message.text} {message.tone === "ok" ? <Link href="/reels" className="underline">Corbeille des projets</Link> : null}</p> : null}
    </aside>
  );
}

export function StudioTabs({ tab, onTab, onPublish }: { tab: StudioTab; onTab: (t: StudioTab) => void; onPublish?: () => void }) {
  const tabs: { key: StudioTab; label: string; icon: ReactNode }[] = [
    { key: "cadrage", label: "Cadrage", icon: <Crop aria-hidden size={18} /> },
    { key: "coupe", label: "Coupe", icon: <Scissors aria-hidden size={18} /> },
    { key: "animation", label: "Animation", icon: <Sparkles aria-hidden size={18} /> },
  ];
  return (
    <div role="tablist" aria-label="Outils" className="sv2-tabs">
      {tabs.map((t) => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`sv2-tab${tab === t.key ? " sv2-active" : ""}`} onClick={() => onTab(t.key)}>{t.icon} {t.label}</button>)}
      {/* Téléphone : « Publier » rejoint la barre du bas (masqué sur grand écran). */}
      {onPublish ? <button type="button" className="sv2-tab sv2-tab-publish" onClick={onPublish}><Send aria-hidden size={18} /> Publier</button> : null}
    </div>
  );
}

/** Animations rapides : une carte = un clic = l'animation posée sur le passage en cours (texte repris de ce qui est dit). */
export const QUICK_ANIMATIONS: { name: string; label: string; look: "titre" | "surligne" | "citation" | "chiffre" | "badge" | "liste" | "cta" | "derriere" | "mot" | "parcours" | "logo" }[] = [
  { name: "titre", label: "Titre dynamique", look: "titre" },
  { name: "mot-impact", label: "Mot impact", look: "surligne" },
  { name: "carte-flottante", label: "Question / citation", look: "citation" },
  { name: "chiffre", label: "Chiffre clé", look: "chiffre" },
  { name: "onglet", label: "Badge", look: "badge" },
  { name: "checklist", label: "Points clés", look: "liste" },
  { name: "mot-central", label: "Mot central", look: "mot" },
  { name: "parcours", label: "Parcours", look: "parcours" },
  { name: "cta-saisie", label: "CTA commentaire", look: "cta" },
  { name: "titre-derriere", label: "Texte derrière moi", look: "derriere" },
  { name: "logo-fin", label: "Logo de fin", look: "logo" },
];
export function QuickAnimations({ onAdd, disabled, used }: { onAdd: (name: string) => void; disabled: boolean; used: Set<string> }) {
  return (
    <section aria-label="Animations rapides">
      <h3 className="sv2-h">Animations rapides <span className="font-normal text-[#AAB4C3]">(1 clic)</span></h3>
      <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-3">
        {QUICK_ANIMATIONS.map((a) => (
          <button key={a.name} type="button" disabled={disabled} className={`sv2-anim sv2-look-${a.look}${used.has(a.name) ? " sv2-used" : ""}`} onClick={() => onAdd(a.name)} title={`Ajouter « ${a.label} » sur le passage en cours`}>
            <span aria-hidden className="sv2-anim-art" />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Bibliothèque simple du nouveau studio (demande de Cédric, 2026-11-13 : « extrêmement simple ») : une recherche et une
 * grille. Un clic pose l'animation à l'endroit de la lecture, avec le texte tiré de ce qui est dit ; rien d'autre à
 * régler ici. Les animations rapides d'abord, puis toutes les autres de la bibliothèque.
 */
export function SimpleAnimationPicker({ onPick, disabled, used }: { onPick: (name: string) => void; disabled: boolean; used: Set<string> }) {
  const [q, setQ] = useState("");
  const quick = new Set(QUICK_ANIMATIONS.map((a) => a.name));
  const all = [
    ...QUICK_ANIMATIONS.map((a) => ({ name: a.name, label: a.label, description: ANIMATIONS[a.name]?.description ?? "" })),
    ...Object.entries(ANIMATIONS).filter(([name]) => !quick.has(name)).map(([name, def]) => ({ name, label: def.label, description: def.description })),
  ];
  const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = fold(q).split(/\s+/).filter(Boolean);
  const shown = all.filter((a) => words.every((w) => fold(`${a.label} ${a.description}`).includes(w)));
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#AAB4C3]">Place la lecture où tu veux l’animation, puis clique sur une carte. Le texte vient de ce que tu dis.</p>
      <input type="search" aria-label="Rechercher une animation" placeholder="Rechercher : titre, chiffre, liste, logo…" value={q} onChange={(e) => setQ(e.target.value)} className="sv2-input w-full" />
      <ul aria-label="Animations" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((a) => (
          <li key={a.name}>
            <button type="button" disabled={disabled} onClick={() => onPick(a.name)} className={`sv2-pick${used.has(a.name) ? " sv2-used" : ""}`} title={a.description}>
              <span className="block font-semibold">{a.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {!shown.length ? <p className="text-sm text-[#AAB4C3]">Aucune animation ne correspond.</p> : null}
    </div>
  );
}

export function PlayerBar({ playing, timeMs, totalMs, onToggle, onSeek, onSound, captions, onCaptions, onFullscreen }: { playing: boolean; timeMs: number; totalMs: number; onToggle: () => void; onSeek: (ms: number) => void; onSound: () => void; captions: boolean; onCaptions?: () => void; onFullscreen: () => void }) {
  return (
    <div className="sv2-playerbar" role="group" aria-label="Lecture de la vidéo">
      <button type="button" className="sv2-icon" aria-label={playing ? "Pause" : "Lire"} onClick={onToggle}>{playing ? <Pause aria-hidden size={20} /> : <Play aria-hidden size={20} />}</button>
      <span className="tabular-nums text-sm">{clock(timeMs)} / {clock(totalMs)}</span>
      <input type="range" aria-label="Position dans la vidéo" min={0} max={Math.max(1, totalMs)} step={50} value={Math.min(timeMs, totalMs)} onChange={(e) => onSeek(e.target.valueAsNumber)} className="sv2-range min-w-0 flex-1" />
      <button type="button" className="sv2-icon" aria-label="Écouter avec le son" onClick={onSound}><Volume2 aria-hidden size={20} /></button>
      <button type="button" className="sv2-icon" aria-label={captions ? "Masquer les sous-titres" : "Afficher les sous-titres"} aria-pressed={captions} disabled={!onCaptions} onClick={onCaptions}><Subtitles aria-hidden size={20} /></button>
      <button type="button" className="sv2-icon" aria-label="Plein écran" onClick={onFullscreen}><Maximize aria-hidden size={20} /></button>
    </div>
  );
}

export function PublishButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="sv2-publish" disabled={disabled} onClick={onClick}>
      <span className="flex items-center gap-2 text-base font-bold"><Send aria-hidden size={18} /> Publier</span>
    </button>
  );
}

/** Titre de la vidéo, renommable (le titre ne figure pas dans la vidéo : rendu et planche restent valables). */
export function StudioTitle({ title, disabledReason, onRename }: { title: string; disabledReason: string | null; onRename: (title: string) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const next = (draft ?? "").trim();
    if (!next) { setError("Donne un titre à ta vidéo."); return; }
    if (next === title) { setDraft(null); return; }
    setBusy(true); setError(null);
    try { await onRename(next); setDraft(null); } catch (e) { setError(e instanceof Error ? e.message : "Renommage impossible."); } finally { setBusy(false); }
  };
  if (draft === null) return (
    <div className="sv2-title">
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold" title={title}>{title}</h1>
      <button type="button" className="sv2-icon-btn" aria-label="Renommer la vidéo" title={disabledReason ?? "Renommer la vidéo"} disabled={Boolean(disabledReason)} onClick={() => { setError(null); setDraft(title); }}><Pencil aria-hidden size={16} /></button>
    </div>
  );
  return (
    <form className="sv2-title" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <input autoFocus aria-label="Titre de la vidéo" value={draft} maxLength={160} disabled={busy} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setDraft(null); }} className="sv2-title-input" />
      <button type="submit" className="sv2-icon-btn" aria-label="Enregistrer le titre" disabled={busy}><Check aria-hidden size={16} /></button>
      <button type="button" className="sv2-icon-btn" aria-label="Annuler le renommage" disabled={busy} onClick={() => setDraft(null)}><X aria-hidden size={16} /></button>
      {error ? <p role="alert" className="w-full text-xs text-red-300">{error}</p> : null}
    </form>
  );
}
