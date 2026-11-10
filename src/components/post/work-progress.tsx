"use client";
/**
 * Barre « où on en est » pour une tâche IA longue sans avancement réel côté serveur (recherche web, génération) :
 * étapes affichées dans l'ordre et barre qui avance selon le temps écoulé (estimation, jamais 100 % avant la fin).
 */
import { useEffect, useState } from "react";

export default function WorkProgress({ label, steps, expectedMs }: { label: string; steps: string[]; expectedMs: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - t0), 250);
    return () => window.clearInterval(id);
  }, []);
  // Avance rapide au début puis ralentit : plafonnée à 95 % tant que le résultat n'est pas arrivé.
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-elapsed / (expectedMs / 2)))));
  const step = Math.min(steps.length - 1, Math.floor((pct / 95) * steps.length));
  const sec = Math.floor(elapsed / 1000);
  return (
    <div role="status" aria-live="polite" className="space-y-1.5 rounded-xl bg-white/70 p-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-xs text-mut">{sec} s</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <ol className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {steps.map((s, i) => (
          <li key={s} className={i < step ? "text-emerald-700" : i === step ? "font-medium text-brand" : "text-mut"}>{i < step ? "✓ " : i === step ? "• " : ""}{s}</li>
        ))}
      </ol>
      <p className="text-xs text-mut">Durée habituelle : environ {Math.round(expectedMs / 1000)} s.</p>
    </div>
  );
}
