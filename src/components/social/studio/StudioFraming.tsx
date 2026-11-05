"use client";
/**
 * Cadrage 9:16 de la prise, à la main. Dans l'inspecteur : un résumé et le bouton « Recadrer la vidéo ». La fenêtre
 * de cadrage montre la prise entière avec le cadre 9:16 à déplacer (souris, doigt ou flèches), le zoom, un curseur
 * pour parcourir la vidéo, et le résultat exact à côté. Elle s'ouvre seule à l'arrivée d'une prise paysage pas encore
 * cadrée. Le calcul (domain/reels/crop.ts) reproduit la composition : aperçu, résultat et MP4 sont identiques.
 */
import { useEffect, useRef, useState } from "react";
import { Crop, Pause, Play, X } from "lucide-react";
import type { Edit } from "@/domain/social/montage/edit";
import { centeredWindow, framingFromWindow, needsCrop, placeWindow, windowFromFraming, type CropWindow, type Framing } from "@/domain/reels/crop";

type Props = {
  edit: Edit;
  disabled: boolean;
  videoUrl?: string | null;
  /** Enregistre le cadrage choisi (sauvegarde directe du montage). */
  onApply: (framing: Framing) => Promise<void> | void;
  /** Appelé quand la fenêtre s'ouvre seule (prise paysage pas encore cadrée). */
  onAutoOpen?: () => void;
};

const RESULT_W = 216;

function CropDialog({ aspect, videoUrl, initial, onClose, onApply }: { aspect: number; videoUrl: string; initial: Framing; onClose: () => void; onApply: (f: Framing) => Promise<void> | void }) {
  const [scale, setScale] = useState(initial.scale);
  const [win, setWin] = useState<CropWindow>(() => (initial.focusX === undefined && initial.focusY === undefined && initial.x === 0 && initial.y === 0 ? centeredWindow(aspect, initial.scale) : windowFromFraming(aspect, initial)));
  const [time, setTime] = useState(0.5);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLVideoElement>(null);
  const result = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const framing = framingFromWindow(aspect, scale, win);

  const zoom = (s: number) => {
    const cx = win.left + win.width / 2, cy = win.top + win.height / 2;
    const next = placeWindow(aspect, s, 0, 0);
    setScale(s);
    setWin(placeWindow(aspect, s, cx - next.width / 2, cy - next.height / 2));
  };
  const seek = (t: number) => {
    setTime(t);
    for (const v of [source.current, result.current]) if (v) v.currentTime = t;
  };
  const toggle = () => {
    const s = source.current, r = result.current;
    if (!s) return;
    if (s.paused) { void s.play(); void r?.play(); setPlaying(true); } else { s.pause(); r?.pause(); setPlaying(false); }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const k = RESULT_W / 1080;
  const resultStyle: React.CSSProperties = {
    position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
    objectPosition: `${framing.focusX ?? 50}% ${framing.focusY ?? 50}%`,
    transform: `translate(${framing.x * k}px, ${framing.y * k}px) scale(${framing.scale})`, transformOrigin: "50% 50%",
  };
  const apply = async () => {
    setBusy(true); setError(null);
    try { await onApply(framing); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cadrage-titre" className="fixed inset-0 z-[70] grid place-items-center bg-black/70 sm:p-4">
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[94vh] sm:rounded-3xl">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 id="cadrage-titre" className="text-lg font-semibold">Recadrer en 9:16</h2>
            <p className="text-sm text-mut">Déplace le cadre blanc sur la partie à garder. Le résultat à droite est exactement la vidéo finale.</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-black/[0.05]"><X aria-hidden size={20} /></button>
        </header>
        <div className="grid min-h-0 flex-1 gap-5 overflow-auto p-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-3">
            <div ref={box} data-testid="framing-source" className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-black" style={{ aspectRatio: String(aspect) }}>
              <video ref={source} src={videoUrl} muted playsInline preload="auto" aria-hidden className="absolute inset-0 h-full w-full object-contain"
                onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration || 0); e.currentTarget.currentTime = time; }}
                onTimeUpdate={(e) => { if (!drag.current) setTime(e.currentTarget.currentTime); }} onEnded={() => setPlaying(false)} />
              <div role="slider" tabIndex={0} aria-label="Cadre 9:16 gardé" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.round((win.left / Math.max(0.0001, 1 - win.width)) * 100) || 0}
                aria-valuetext={`Cadre à ${Math.round(win.left * 100)} % depuis la gauche, ${Math.round(win.top * 100)} % depuis le haut`}
                data-testid="framing-window"
                className="absolute cursor-grab rounded-md border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.7),0_0_0_9999px_rgba(0,0,0,0.6)] outline-none focus-visible:ring-4 focus-visible:ring-brand active:cursor-grabbing"
                style={{ left: `${win.left * 100}%`, top: `${win.top * 100}%`, width: `${win.width * 100}%`, height: `${win.height * 100}%` }}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, left: win.left, top: win.top }; }}
                onPointerMove={(e) => {
                  const d = drag.current, el = box.current;
                  if (!d || !el) return;
                  const r = el.getBoundingClientRect();
                  setWin(placeWindow(aspect, scale, d.left + (e.clientX - d.x) / r.width, d.top + (e.clientY - d.y) / r.height));
                }}
                onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 0.05 : 0.01;
                  const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
                  const m = moves[e.key];
                  if (!m) return;
                  e.preventDefault();
                  setWin(placeWindow(aspect, scale, win.left + m[0], win.top + m[1]));
                }}>
                {/* Repères des tiers, pour placer le visage. */}
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33%,rgba(255,255,255,.35)_33%,rgba(255,255,255,.35)_calc(33%+1px),transparent_calc(33%+1px),transparent_66%,rgba(255,255,255,.35)_66%,rgba(255,255,255,.35)_calc(66%+1px),transparent_calc(66%+1px)),linear-gradient(to_bottom,transparent_33%,rgba(255,255,255,.35)_33%,rgba(255,255,255,.35)_calc(33%+1px),transparent_calc(33%+1px),transparent_66%,rgba(255,255,255,.35)_66%,rgba(255,255,255,.35)_calc(66%+1px),transparent_calc(66%+1px))]" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="btn-ghost min-h-11 min-w-11" aria-label={playing ? "Pause" : "Lire"} onClick={toggle}>{playing ? <Pause aria-hidden size={18} /> : <Play aria-hidden size={18} />}</button>
              <label className="flex flex-1 items-center gap-2 text-sm">
                <span className="shrink-0 text-mut">Moment</span>
                <input type="range" min={0} max={Math.max(0.1, duration)} step={0.1} value={Math.min(time, duration || time)} onChange={(e) => seek(Number(e.target.value))} className="w-full" aria-label="Moment de la vidéo" />
                <span className="w-12 shrink-0 text-right tabular-nums text-mut">{time.toFixed(1)} s</span>
              </label>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <span className="w-16 shrink-0 font-medium">Zoom</span>
              <input type="range" min={1} max={2} step={0.05} value={scale} onChange={(e) => zoom(Number(e.target.value))} className="w-full" aria-label="Zoom" />
              <span className="w-12 shrink-0 text-right tabular-nums">{Math.round(scale * 100)} %</span>
            </label>
            <p className="text-xs text-mut">Astuce : flèches du clavier pour un réglage fin (Maj + flèche pour aller plus vite). Parcours la vidéo pour vérifier que tu restes dans le cadre du début à la fin.</p>
          </div>
          <figure className="mx-auto space-y-2">
            <figcaption className="text-center text-sm font-medium">Résultat 9:16</figcaption>
            <div data-testid="framing-result" className="relative overflow-hidden rounded-xl bg-black" style={{ width: RESULT_W, height: RESULT_W * 16 / 9 }}>
              <video ref={result} src={videoUrl} muted playsInline preload="auto" aria-hidden style={resultStyle}
                onLoadedMetadata={(e) => { e.currentTarget.currentTime = time; }} />
            </div>
          </figure>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
          <button type="button" className="btn-ghost min-h-11" onClick={() => { setScale(1); setWin(centeredWindow(aspect, 1)); }}>Centrer</button>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost min-h-11" onClick={onClose}>Annuler</button>
            <button type="button" className="btn-red min-h-11" disabled={busy} onClick={apply}>{busy ? "Enregistrement…" : "Appliquer le cadrage"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function StudioFraming({ edit, disabled, videoUrl = null, onApply, onAutoOpen }: Props) {
  const value: Framing = { x: 0, y: 0, scale: 1, ...edit.framing };
  const [aspect, setAspect] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(false);
  const unset = !edit.framing || (edit.framing.focusX === undefined && edit.framing.focusY === undefined && edit.framing.x === 0 && edit.framing.y === 0 && edit.framing.scale === 1);
  const crop = aspect !== null && needsCrop(aspect);

  // Prise paysage pas encore cadrée : la fenêtre de cadrage s'ouvre d'elle-même, une fois.
  const onMeta = (a: number) => setAspect(a);
  // Ouverture dès que le Studio est libre (un enregistrement en cours, ex. le standard d'animations, ne la fait pas manquer).
  useEffect(() => {
    if (aspect !== null && needsCrop(aspect) && unset && !disabled && !autoOpened.current) { autoOpened.current = true; setOpen(true); onAutoOpen?.(); }
  }, [aspect, unset, disabled, onAutoOpen]);

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 font-semibold"><Crop aria-hidden size={16} /> Cadrage 9:16</h3>
      {videoUrl ? <video src={`${videoUrl}#t=0.5`} preload="metadata" muted playsInline className="hidden" aria-hidden
        onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) onMeta(v.videoWidth / v.videoHeight); }} /> : null}
      <p className="text-xs text-mut">
        {aspect === null ? (videoUrl ? "Lecture du format de la prise…" : "Vidéo indisponible.")
          : crop ? (unset ? `Prise ${aspect > 1 ? "paysage" : "hors format"} : choisis la partie gardée en 9:16.` : `Cadrage choisi${value.scale > 1 ? ` · zoom ${Math.round(value.scale * 100)} %` : ""}.`)
          : value.scale > 1 ? `Prise en 9:16 · zoom ${Math.round(value.scale * 100)} %.` : "Prise déjà en 9:16 : tu peux zoomer pour resserrer le plan."}
      </p>
      <button type="button" className={`${crop && unset ? "btn-red" : "btn-ghost"} min-h-11 w-full`} disabled={disabled || !videoUrl || aspect === null} onClick={() => setOpen(true)}>
        <Crop aria-hidden size={16} /> Recadrer la vidéo
      </button>
      {open && aspect !== null && videoUrl ? <CropDialog aspect={aspect} videoUrl={videoUrl} initial={value} onClose={() => setOpen(false)} onApply={onApply} /> : null}
    </div>
  );
}
