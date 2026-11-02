"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ReelPreview from "@/components/social/ReelPreview";
import { MOTION_CATEGORIES, listMotions, searchMotions, type KeptMotion, type Motion, type MotionCategory, type MotionStatus } from "@/domain/social/montage/beemotion";
import { buildAnimationPoster, buildAnimationPreview } from "@/domain/social/montage/edit-composition";
import { ANIMATIONS } from "@/domain/social/montage/registry";

/**
 * BeeMotion (MVP 1) — bibliothèque des animations BeeRecos dans le Studio : recherche, filtre par catégorie, affiche figée
 * (iframe sandbox sans script), aperçu Hyperframes au survol (ordinateur) ou au toucher (mobile), « Utiliser » pré-remplit le
 * formulaire d'ajout existant. Rien n'est enregistré ici : la pose sur la vidéo reste celle du panneau Animations.
 */

const INTENSITY = { low: "Douce", medium: "Moyenne", high: "Forte" } as const;
const STATUS: Record<MotionStatus, { label: string; cls: string }> = {
  approved: { label: "Validé", cls: "bg-brand/10 text-brand" },
  review: { label: "À valider", cls: "bg-amber-400/15 text-amber-700" },
  testing: { label: "En test", cls: "bg-black/[0.05] text-mut" },
  draft: { label: "Brouillon", cls: "bg-black/[0.05] text-mut" },
  deprecated: { label: "Retiré", cls: "bg-black/[0.05] text-mut" },
};
const sec = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

/** Affiche figée : document 1080 × 1920 sans script, réduit à la largeur de la carte. */
function Poster({ html, title }: { html: string; title: string }) {
  const [scale, setScale] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 1080));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative aspect-[9/16] w-full overflow-hidden bg-black/5">
      {/* sandbox sans allow-scripts : aucun script ne peut s'exécuter ; allow-same-origin pour charger Poppins depuis /hyperframes. */}
      {scale > 0 && <iframe title={`Affiche : ${title}`} sandbox="allow-same-origin" srcDoc={html} tabIndex={-1} aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left border-0" style={{ transform: `scale(${scale})` }} />}
    </div>
  );
}

export const MOTION_DRAG_TYPE = "application/x-beegrowth-motion";
export const ANIMATION_DRAG_INDEX = "application/x-beegrowth-animation-index";

export default function BeeMotionLibrary({ onUse, kept = [], usage = {}, sceneComposer = false, selected, canBehind = true, disabled = false, compact = false, actionLabel }: {
  compact?: boolean; actionLabel?: string;
  onUse: (id: string) => void; kept?: KeptMotion[]; usage?: Record<string, number>;
  sceneComposer?: boolean; selected?: string | null; canBehind?: boolean; disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<MotionCategory | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const base = `${typeof window !== "undefined" ? window.location.origin : ""}/hyperframes`;
  const all = useMemo(() => listMotions(undefined, kept), [kept]);
  // Seules les catégories réellement fournies apparaissent : pas de filtre vide.
  const categories = useMemo(() => (Object.keys(MOTION_CATEGORIES) as MotionCategory[]).filter((c) => all.some((m) => m.category === c)), [all]);
  const motions = searchMotions({ text, category: category ?? undefined, approvedOnly: false, kept });
  const posters = useMemo(() => Object.fromEntries(all.map((m) => [m.id, buildAnimationPoster(m.id, ANIMATIONS[m.id].example, { assetBase: base })])), [all, base]);

  const card = (m: Motion) => {
    const live = previewing === m.id;
    const unavailable = disabled || m.manualOnly || (m.behind && !canBehind);
    return (
      <li key={m.id} className={`flex flex-col overflow-hidden rounded-2xl border bg-white ${sceneComposer && selected === m.id ? "border-brand ring-2 ring-brand/20" : "border-line"}`} data-testid={`beemotion-${m.id}`} data-compact={compact || undefined}
        draggable={sceneComposer && !unavailable}
        onDragStart={(e) => { if (unavailable) { e.preventDefault(); return; } e.dataTransfer.setData(MOTION_DRAG_TYPE, m.id); e.dataTransfer.effectAllowed = "copy"; }}>

        {sceneComposer ? <button type="button" draggable={!unavailable} aria-label={`Glisser ${m.name} sur une séquence`} disabled={unavailable} className="min-h-[44px] cursor-grab bg-black/5 px-2 text-xs active:cursor-grabbing" onClick={() => onUse(m.id)}>⠿ {m.name}</button> : null}
        <button type="button" aria-label={`${live ? "Arrêter l'aperçu" : "Aperçu"} : ${m.name}`} aria-pressed={live}
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setPreviewing(m.id); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse" && live) setPreviewing(null); }}
          onClick={() => setPreviewing(live ? null : m.id)}
          className="relative block w-full touch-manipulation text-left transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none">
          {live
            ? <ReelPreview html={buildAnimationPreview(m.id, ANIMATIONS[m.id].example, { assetBase: base, preview: true })} title={m.name} />
            : <Poster html={posters[m.id]} title={m.name} />}
        </button>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <span className={`pill self-start text-[11px] ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span>
          <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{m.name}</p>
          <p className="text-xs text-mut">{MOTION_CATEGORIES[m.category]} · {INTENSITY[m.intensity]} · {sec(m.durationMs)} · v{m.version}{usage[m.id] ? ` · utilisé ${usage[m.id]}×` : ""}</p>
          <p className="line-clamp-2 text-xs text-mut">{m.recommendedFor}</p>
          <div className="mt-auto pt-2">
            {m.manualOnly
              ? <p className="text-xs text-mut">Se pose depuis le panneau Médias.</p>
              : <button type="button" className="btn-ghost min-h-[44px] w-full text-sm" disabled={unavailable} aria-pressed={sceneComposer ? selected === m.id : undefined} onClick={() => onUse(m.id)}>
                {m.behind && !canBehind ? "Détourage requis" : actionLabel ?? (sceneComposer ? (selected === m.id ? "Carte choisie" : "Choisir cette carte") : "Utiliser")}
              </button>}
          </div>
        </div>
      </li>
    );
  };

  return (
    <section aria-label="BeeMotion — bibliothèque d'animations" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Rechercher (titre, chiffre, CTA…)"
          aria-label="Rechercher un motion" className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Catégories">
        {[null, ...categories].map((c) => (
          <button key={c ?? "all"} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}
            className={`min-h-[36px] shrink-0 rounded-full px-3 text-sm ${category === c ? "bg-brand text-white" : "bg-black/[0.04] text-mut hover:text-fg"}`}>
            {c ? MOTION_CATEGORIES[c] : "Tout"}
          </button>
        ))}
      </div>
      {motions.length === 0
        ? <p className="rounded-xl bg-black/[0.03] p-3 text-sm text-mut">Aucun motion ne correspond. Élargissez la recherche avant d&apos;en créer un nouveau.</p>
        : <ul className={`grid grid-cols-2 gap-3 ${sceneComposer ? "" : "sm:grid-cols-3"}`}>{motions.map(card)}</ul>}
      <p className="text-xs text-mut">« Validé » = choisi par Cédric (journal des décisions). Choisir une carte ne publie rien : le montage reste un brouillon à tester et enregistrer.</p>
    </section>
  );
}
