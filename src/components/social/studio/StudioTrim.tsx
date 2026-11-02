"use client";
import { useState } from "react";
import type { Edit } from "@/domain/social/montage/edit";

/** Crop the retained ranges without restoring words removed by the transcript editor. */
export default function StudioTrim({ edit, durationMs, disabled, onSave }: {
  edit: Edit; durationMs: number; disabled: boolean; onSave: (edit: Edit) => Promise<void>;
}) {
  const [start, setStart] = useState((edit.ranges[0]?.fromMs ?? 0) / 1000);
  const [end, setEnd] = useState((edit.ranges[edit.ranges.length - 1]?.toMs ?? durationMs) / 1000);
  const ranges = edit.ranges.map((r) => ({ fromMs: Math.max(r.fromMs, Math.round(start * 1000)), toMs: Math.min(r.toMs, Math.round(end * 1000)) })).filter((r) => r.toMs > r.fromMs);
  const valid = Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end <= durationMs / 1000 && end > start && ranges.length > 0;
  return <section className="card space-y-3 p-4" aria-label="Ajuster le montage">
    <h3 className="font-medium">Ajuster le montage</h3>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm">Début (secondes)<input type="number" min={0} max={durationMs / 1000} step="0.1" value={start} disabled={disabled} onChange={(e) => setStart(e.target.valueAsNumber)} className="mt-1 min-h-[44px] w-full rounded-xl border border-line px-3" /></label>
      <label className="text-sm">Fin (secondes)<input type="number" min={0} max={durationMs / 1000} step="0.1" value={end} disabled={disabled} onChange={(e) => setEnd(e.target.valueAsNumber)} className="mt-1 min-h-[44px] w-full rounded-xl border border-line px-3" /></label>
    </div>
    <button type="button" className="btn-ghost min-h-[44px]" disabled={disabled || !valid} onClick={() => onSave({ ...edit, ranges })}>Enregistrer les bornes</button>
    {!valid ? <p role="alert" className="text-sm text-red-700">Choisissez une fin après le début, dans la durée de la vidéo.</p> : null}
    <p className="text-xs text-mut">Les coupes internes sont conservées. Annuler ou le transcript permet de restaurer une portion retirée.</p>
    <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={edit.subtitles} disabled={disabled} onChange={(e) => onSave({ ...edit, subtitles: e.target.checked })} />Afficher les sous-titres</label>
    <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={edit.voiceGain > 0} disabled={disabled} onChange={(e) => onSave({ ...edit, voiceGain: e.target.checked ? 1 : 0 })} />Conserver le son de la prise</label>
  </section>;
}
