"use client";
/**
 * Studio Reel — refonte 2026-11-12 (maquette de Cédric) : habillage sombre premium et organisation en zones
 * (en-tête, colonne gauche, vidéo, panneau Cadrage / Coupe / Animation, timeline, Publier). Composants de
 * présentation seulement : toute la logique reste dans MontageStudio (lecteur, coupes, animations, publication).
 */
import { useEffect, useState, type ReactNode } from "react";
import { CircleHelp, Crop, Film, FolderOpen, Maximize, Pause, Play, Scissors, Send, Settings, Sparkles, Subtitles, Upload, Video, Volume2 } from "lucide-react";
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

export function StudioSidebar({ currentId, onRecord, onImport, onOpen, onAll }: { currentId: string; onRecord: () => void; onImport: () => void; onOpen: (id: string) => void; onAll: () => void }) {
  const [list, setList] = useState<MontageSummary[] | null>(null);
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
        <button type="button" className="sv2-bigcard sv2-active" onClick={onImport}><Upload aria-hidden size={30} /><span>Importer une vidéo</span><small>mobile, PC, fichiers…</small></button>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <h2 className="sv2-h">Mes projets</h2>
        <button type="button" className="text-sm text-[#AAB4C3] hover:text-white" onClick={onAll}>Voir tout →</button>
      </div>
      {list === null ? <p role="status" className="mt-2 text-sm text-[#AAB4C3]">Chargement…</p> : null}
      {list && !projects.length ? <p className="mt-2 text-sm text-[#AAB4C3]">Aucun projet pour l’instant.</p> : null}
      <ul className="mt-2 space-y-2">
        {projects.map((p) => (
          <li key={p.id}>
            <button type="button" aria-current={p.id === currentId ? "true" : undefined} className="sv2-project" onClick={() => { if (p.id !== currentId) onOpen(p.id); }}>
              <span className="sv2-thumb"><Film aria-hidden size={18} /></span>
              <span className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold">{p.title}</span><span className="block text-xs text-[#AAB4C3]">{p.keptMs ? `${clock(p.keptMs)} • ` : ""}{day(p.updatedAt)}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function StudioTabs({ tab, onTab }: { tab: StudioTab; onTab: (t: StudioTab) => void }) {
  const tabs: { key: StudioTab; label: string; icon: ReactNode }[] = [
    { key: "cadrage", label: "Cadrage", icon: <Crop aria-hidden size={18} /> },
    { key: "coupe", label: "Coupe", icon: <Scissors aria-hidden size={18} /> },
    { key: "animation", label: "Animation", icon: <Sparkles aria-hidden size={18} /> },
  ];
  return (
    <div role="tablist" aria-label="Outils" className="sv2-tabs">
      {tabs.map((t) => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`sv2-tab${tab === t.key ? " sv2-active" : ""}`} onClick={() => onTab(t.key)}>{t.icon} {t.label}</button>)}
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
      <span className="flex items-center gap-3 text-2xl font-bold"><Send aria-hidden size={30} /> Publier</span>
      <span className="text-xs font-medium opacity-90">Instagram • LinkedIn • Télécharger</span>
    </button>
  );
}
