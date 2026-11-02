"use client";
import { useEffect, useRef, useState } from "react";
import { PICTOGRAM } from "@/domain/social/reel-story/brand";
import { GUIDE_MODE_LABEL, GUIDE_MOTION, guideKeyframes, REFERENCE_DEMO, type GuideMode, type GuideState } from "@/domain/social/reel-story/guide";
import { prefersReducedMotion } from "@/components/social/ReelPreview";

/**
 * Le guide BeeRecos dans l'interface : le pictogramme officiel (fichier de la charte, jamais redessiné), animé
 * dans UN conteneur avec les mêmes réglages que le montage (src/lib/reel-story/guide.ts).
 * Un clic ou tap déclenche sa réaction courte ; toute animation en cours est annulée avant la suivante (rien ne
 * s'accumule). Mouvement réduit : présentation statique, commandes toujours accessibles.
 */
export default function PictogramGuide({ mode, onModeChange }: { mode: GuideMode; onModeChange: (m: GuideMode) => void }) {
  const box = useRef<HTMLButtonElement>(null);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [state, setState] = useState<GuideState | "demo" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  const current = useRef<Animation | null>(null);
  const stop = () => { current.current = null; box.current?.getAnimations?.().forEach((a) => a.cancel()); setState(null); };
  const run = (keyframes: Keyframe[], options: KeyframeAnimationOptions, label: GuideState | "demo") => {
    const el = box.current;
    stop();
    if (!el || reduced || !el.animate) return;
    setState(label);
    const a = el.animate(keyframes, options);
    current.current = a;
    a.onfinish = () => { if (current.current === a) { current.current = null; setState(null); } };
  };

  /** Démonstration de référence (7 s) ; en mode discret, déplacements et pulsation réduits de moitié. */
  const playDemo = () => {
    const k = mode === "discret" ? 0.5 : 1;
    const pulse = GUIDE_MOTION[mode].react.scale;
    run(REFERENCE_DEMO.keyframes.map((f) => ({
      offset: f.t / REFERENCE_DEMO.duration, opacity: f.opacity,
      transform: `translateY(${f.y * k}px) scale(${f.scale > 1 ? pulse : 1})`,
    })), { duration: REFERENCE_DEMO.duration * 1000, easing: "ease-out" }, "demo");
  };
  const react = () => { const r = guideKeyframes("reagir", mode); run(r.keyframes, { duration: r.duration, easing: r.easing }, "reagir"); };

  useEffect(() => stop, []);

  return (
    <div className="card flex items-center gap-4 p-4">
      <button ref={box} type="button" onClick={react} aria-label="Faire réagir le guide BeeRecos" data-testid="guide"
        className="grid h-28 w-20 shrink-0 place-items-center rounded-xl bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
        <img src={`/${PICTOGRAM.blue}`} alt="" className="block h-24 w-auto" draggable={false} />
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold">Le guide BeeRecos</p>
        <p className="text-xs leading-relaxed text-mut">
          Le pictogramme officiel accompagne chaque scène et attire l'œil sur l'appel à l'action. Touche-le pour voir sa réaction.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-black/[0.05] p-1 text-xs font-medium" role="group" aria-label="Mouvement du guide">
            {(["discret", "dynamique"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => { stop(); onModeChange(m); }}
                className={`min-h-[36px] rounded-full px-3 transition ${mode === m ? "bg-white text-fg shadow-sm" : "text-mut hover:text-fg"}`}>
                {GUIDE_MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost min-h-[36px] px-3 text-xs" onClick={playDemo} disabled={reduced}>Rejouer la démo (7 s)</button>
        </div>
        <p className="text-[11px] text-mut" aria-live="polite" data-testid="guide-state">
          {reduced ? "Mouvement réduit : présentation statique." : state === "reagir" ? "Réaction" : state === "demo" ? "Démonstration en cours" : "Prêt"}
        </p>
      </div>
    </div>
  );
}
