"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { prompteurBlocks, type Reel } from "@/domain/social/montage/reels";

/**
 * PROMPTEUR (lot S7) : le texte à lire d'un des 72 Reels (`script.text`, sauts de ligne conservés), scène par scène,
 * en plein écran. Taille, vitesse de défilement, lecture / pause, scène en cours. Réglages gardés sur ce poste.
 * Ce n'est que de la lecture : rien n'est enregistré sur le Reel.
 */
const PREFS_KEY = "bee.prompteur";
type Prefs = { size: number; speed: number; mirror: boolean };
const DEFAULT_PREFS: Prefs = { size: 56, speed: 40, mirror: false };

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "null");
    return { ...DEFAULT_PREFS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch { return DEFAULT_PREFS; }
}
function savePrefs(p: Prefs) {
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* stockage indisponible : réglages non gardés */ }
}

export default function Prompteur({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const blocks = prompteurBlocks(reel);
  const update = (p: Partial<Prefs>) => setPrefs((old) => { const next = { ...old, ...p }; savePrefs(next); return next; });

  // Défilement continu à `speed` px/s pendant la lecture.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const el = box.current;
      if (el) {
        pos.current = Math.min(el.scrollHeight - el.clientHeight, pos.current + ((now - last) / 1000) * prefs.speed);
        el.scrollTop = pos.current;
        if (pos.current >= el.scrollHeight - el.clientHeight) setPlaying(false);
      }
      last = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, prefs.speed]);

  // Scène en cours : la dernière dont le haut a passé le tiers de l'écran.
  const onScroll = useCallback(() => {
    const el = box.current;
    if (!el) return;
    if (!playing) pos.current = el.scrollTop;
    const mark = el.getBoundingClientRect().top + el.clientHeight / 3;
    let k = 0;
    el.querySelectorAll<HTMLElement>("[data-scene]").forEach((s, i) => { if (s.getBoundingClientRect().top <= mark) k = i; });
    setCurrent(k);
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " " && e.target === document.body) { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const restart = () => { setPlaying(false); pos.current = 0; if (box.current) box.current.scrollTop = 0; };

  // Rendu dans <body> : le panneau des outils (transformé) ne doit pas rogner le plein écran.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Prompteur ${reel.reel_id}`} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/15 px-4 py-2 text-sm">
        <p className="font-semibold">{reel.reel_id} · Texte à lire</p>
        <p className="text-white/70" aria-live="polite">Scène {current + 1}/{blocks.length} · {blocks[current]?.label}</p>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <button type="button" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-black" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Lecture"}</button>
          <button type="button" className="rounded-lg border border-white/30 px-3 py-1.5" onClick={restart}>Début</button>
          <label className="flex items-center gap-2">Taille
            <input type="range" min={28} max={110} step={2} value={prefs.size} onChange={(e) => update({ size: Number(e.target.value) })} aria-label="Taille du texte" />
          </label>
          <label className="flex items-center gap-2">Vitesse
            <input type="range" min={10} max={160} step={5} value={prefs.speed} onChange={(e) => update({ speed: Number(e.target.value) })} aria-label="Vitesse de défilement" />
          </label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={prefs.mirror} onChange={(e) => update({ mirror: e.target.checked })} /> Miroir</label>
          <button type="button" className="rounded-lg border border-white/30 px-3 py-1.5" onClick={onClose}>Fermer</button>
        </div>
      </div>
      <div ref={box} onScroll={onScroll} className="relative flex-1 overflow-y-auto px-[8vw]" style={prefs.mirror ? { transform: "scaleX(-1)" } : undefined}>
        <div aria-hidden className="pointer-events-none sticky top-1/3 z-10 -mb-[2px] h-[2px] bg-[#2851FF]/60" />
        <div className="py-[33vh]">
          {blocks.map((b, i) => (
            <section key={b.sceneId} data-scene={b.sceneId} className={`mb-[0.9em] transition-opacity ${i === current ? "opacity-100" : "opacity-45"}`} style={{ fontSize: prefs.size, lineHeight: 1.35 }}>
              <p className="mb-1 text-[0.32em] font-semibold uppercase tracking-wider text-[#8fa6ff]">{b.label}</p>
              <p className="whitespace-pre-line font-semibold">{b.text}</p>
            </section>
          ))}
          <p className="text-[24px] text-white/60">Fin du texte · gardez 2 s de prise après le dernier mot (carte de fin).</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
