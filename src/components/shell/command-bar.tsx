"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { QueenBeeComposer } from "@/components/missions/queen-bee-composer";

/** Queen Bee, accessible partout (⌘K / Ctrl K). Chaque demande devient une vraie mission. */
export function CommandBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-1/2 z-30 flex w-[min(40rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-full bg-brand-black px-4 py-2.5 text-left text-sm text-white/75 shadow-xl shadow-brand/20 ring-1 ring-white/10 transition hover:text-white lg:bottom-6"
      >
        <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">QB</span>
        <span className="flex-1">Demander à Queen Bee…</span>
        <kbd className="hidden rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] text-white/60 sm:inline">⌘K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-[2px] sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Demander à Queen Bee" className="w-full max-w-2xl rounded-3xl bg-surface-0 p-5 shadow-2xl ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
            <header className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-2 font-semibold"><Sparkles aria-hidden size={16} className="text-brand" /> Queen Bee</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2"><X size={18} /></button>
            </header>
            <QueenBeeComposer size="md" autoFocus showSuggestions />
          </div>
        </div>
      ) : null}
    </>
  );
}
