"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CaptionWord, Range } from "@/domain/social/montage/edit";
import { isWordKept } from "@/domain/social/montage/studio";

/**
 * TRANSCRIPT CLIQUABLE DU STUDIO (studio du Video Agent Kit, §7) : un clic sur un mot place la lecture ; glisser sur
 * des mots (ou Maj + clic) les sélectionne, puis Suppr / ⌫ les coupe, Entrée les rétablit. Les mots coupés restent
 * visibles, barrés : rien n'est perdu, la prise d'origine ne change jamais.
 */

export type WordSelection = { from: number; to: number } | null;

type Props = {
  words: CaptionWord[];
  ranges: Range[];
  playheadMs: number | null;
  disabled?: boolean;
  onSeek: (sourceMs: number) => void;
  onCut: (from: number, to: number) => void;
  onRestore: (from: number, to: number) => void;
  selection: WordSelection;
  onSelection: (s: WordSelection) => void;
  /** Plusieurs prises : début (ms de la bande) de chaque prise après la première, signalé dans le texte. */
  takeBreaks?: number[];
};

export default function StudioTranscript({ words, ranges, playheadMs, disabled, onSeek, onCut, onRestore, selection, onSelection, takeBreaks = [] }: Props) {
  // Mot qui ouvre chaque prise (après la première) → numéro de la prise.
  const takeStarts = useMemo(() => {
    const out = new Map<number, number>();
    takeBreaks.forEach((b, k) => { const i = words.findIndex((w) => w.startMs >= b); if (i >= 0 && !out.has(i)) out.set(i, k + 2); });
    return out;
  }, [words, takeBreaks]);
  const kept = useMemo(() => words.map((w) => isWordKept(ranges, w)), [words, ranges]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const moved = useRef(false);
  const current = playheadMs === null ? -1 : words.findIndex((w) => playheadMs >= w.startMs && playheadMs < w.endMs);
  const [a, b] = selection ? [Math.min(selection.from, selection.to), Math.max(selection.from, selection.to)] : [-1, -1];
  const anyKept = selection ? kept.slice(a, b + 1).some(Boolean) : false;
  const anyCut = selection ? kept.slice(a, b + 1).some((k) => !k) : false;

  useEffect(() => {
    const up = () => setDragFrom(null);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (!selection || disabled) return;
    if ((e.key === "Delete" || e.key === "Backspace") && anyKept) { e.preventDefault(); onCut(a, b); }
    else if (e.key === "Enter" && anyCut) { e.preventDefault(); onRestore(a, b); }
    else if (e.key === "Escape") onSelection(null);
  };

  return (
    <section aria-label="Transcript" className="card flex min-h-0 flex-col p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base">Transcript</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-red min-h-[36px] px-3 text-sm" disabled={disabled || !selection || !anyKept} onClick={() => onCut(a, b)}>Couper la sélection</button>
          <button type="button" className="btn-ghost min-h-[36px] px-3 text-sm" disabled={disabled || !selection || !anyCut} onClick={() => onRestore(a, b)}>Rétablir</button>
        </div>
      </div>
      <p className="mb-2 text-xs text-mut">Clic = lire à ce mot · glisser ou Maj + clic = sélectionner · Suppr = couper · Entrée = rétablir · Échap = désélectionner.</p>
      <div role="textbox" aria-readonly="true" aria-label="Mots de la prise" tabIndex={0} onKeyDown={onKey}
        className="max-h-[52vh] min-h-[8rem] overflow-y-auto rounded-xl bg-black/[0.03] p-3 text-[15px] leading-8 outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {words.map((w, i) => {
          const inSel = i >= a && i <= b;
          const take = takeStarts.get(i);
          return (
            <span key={i}>
            {take ? <span data-testid="transcript-take" className="mx-1 my-1 inline-block rounded bg-black px-2 text-xs font-semibold leading-6 text-white">Prise {take}</span> : null}
            <span data-word={i}
              onMouseDown={(e) => { if (e.button !== 0) return; moved.current = false; setDragFrom(i); if (!e.shiftKey) onSelection({ from: i, to: i }); }}
              onMouseEnter={() => { if (dragFrom !== null) { moved.current = true; onSelection({ from: dragFrom, to: i }); } }}
              onClick={(e) => {
                if (e.shiftKey && selection) { onSelection({ from: selection.from, to: i }); return; }
                if (!moved.current) onSeek(w.startMs);
              }}
              className={`cursor-pointer rounded px-px ${kept[i] ? "" : "text-mut line-through decoration-2"} ${inSel ? "bg-brand/25" : ""} ${i === current ? "bg-yellow-200" : ""}`}>
              {w.text}
            </span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
