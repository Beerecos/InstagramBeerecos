"use client";
import { MOTION_VISUALS, VISUAL_LABEL, type MotionVisual } from "@/domain/social/reel-story/motion-spec";

export const MOTION_CARD_TYPE = "application/x-beerecos-motion-card";
const ICONS: Record<MotionVisual, string> = { titre: "Aa", relation: "□—□", marque: "BeeRecos", liste: "☰", chapitre: "Aa", piliers: "▥", personnes: "◉", cta: "→", signature: "BeeRecos" };

export default function MotionAnimationLibrary({ selected, onSelect }: { selected: MotionVisual | null; onSelect: (value: MotionVisual) => void }) {
  return <details open className="card p-4">
    <summary className="cursor-pointer font-semibold">Bibliothèque d’animations</summary>
    <p className="my-3 text-sm text-mut">Glisse une carte sur une scène. Sur mobile ou au clavier : choisis une carte, puis « Utiliser cette carte » sur la scène.</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
      {MOTION_VISUALS.map(visual => <button key={visual} type="button" draggable
        onDragStart={event => { event.dataTransfer.setData(MOTION_CARD_TYPE, visual); event.dataTransfer.effectAllowed = "copy"; onSelect(visual); }}
        onClick={() => onSelect(visual)} aria-pressed={selected === visual} aria-label={`Carte : ${VISUAL_LABEL[visual]}`}
        className={`rounded-xl border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand ${selected === visual ? "border-brand bg-brand/10" : "border-line bg-white hover:border-brand/50"}`}>
        <span aria-hidden className={`mb-2 flex h-12 items-center justify-center rounded-lg text-lg font-bold ${visual === "chapitre" ? "bg-brand text-white" : "bg-brand/5 text-brand"}`}>{ICONS[visual]}</span>
        <span className="text-xs font-semibold">{VISUAL_LABEL[visual]}</span>
      </button>)}
    </div>
    <p className="mt-3 text-xs text-mut">L’appel à l’action reste l’avant-dernière scène et la signature termine le clip. Chaque scène garde un seul visuel principal.</p>
  </details>;
}
