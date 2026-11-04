"use client";
/**
 * Sous-titres en mode simple : afficher ou non, un style parmi quatre (aperçu réel des couleurs), une taille, une
 * position. Chaque clic s'applique tout de suite (enregistré, annulable avec « Annuler »).
 */
import type { Edit } from "@/domain/social/montage/edit";
import { CAPTION_POSITIONS, CAPTION_PRESETS, CAPTION_SIZES, nearest, presetOf, withPosition, withPreset, withSize } from "@/domain/reels/caption-presets";

type Props = { edit: Edit; disabled: boolean; onChange: (patch: Pick<Edit, "subtitles" | "captionStyle">) => void };

export default function StudioSimpleCaptions({ edit, disabled, onChange }: Props) {
  const style = edit.captionStyle;
  const on = edit.subtitles;
  const preset = presetOf(style);
  const size = nearest(CAPTION_SIZES, style.fontSize, (s) => s.fontSize, "petit");
  const position = nearest(CAPTION_POSITIONS, style.top, (s) => s.top, "bas");
  const set = (captionStyle: Edit["captionStyle"], subtitles = on) => onChange({ subtitles, captionStyle });
  const choice = (active: boolean) => `min-h-11 rounded-xl border px-3 text-sm font-medium transition ${active ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`;

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="sr-only">Sous-titres</legend>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-black/[0.04] px-3">
        <span className="font-medium">Afficher les sous-titres</span>
        <input type="checkbox" role="switch" checked={on} onChange={(e) => set(style, e.target.checked)} className="size-5 accent-[#2851FF]" />
      </label>
      {on ? <>
        <div>
          <p className="mb-2 text-sm font-medium">Couleurs</p>
          <div role="radiogroup" aria-label="Couleurs des sous-titres" className="grid grid-cols-2 gap-2">
            {CAPTION_PRESETS.map((p) => (
              <button key={p.key} type="button" role="radio" aria-checked={preset === p.key} onClick={() => set(withPreset(style, p.key))}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${preset === p.key ? "border-brand ring-2 ring-brand/30" : "border-line hover:border-brand"}`}>
                <span aria-hidden className="rounded-lg px-3 py-1 text-sm font-medium" style={{ background: p.backgroundColor, color: p.color }}>
                  Mon <span style={{ color: p.highlightColor }}>réseau</span>
                </span>
                <span className="text-xs">{p.label}</span>
              </button>
            ))}
          </div>
          {preset === null ? <p className="mt-1 text-xs text-mut">Couleurs personnalisées (mode avancé) : choisis un style pour revenir à la charte.</p> : null}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Taille</p>
          <div role="radiogroup" aria-label="Taille des sous-titres" className="grid grid-cols-3 gap-2">
            {CAPTION_SIZES.map((s) => <button key={s.key} type="button" role="radio" aria-checked={size === s.key} onClick={() => set(withSize(style, s.key))} className={choice(size === s.key)}>{s.label}</button>)}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Position</p>
          <div role="radiogroup" aria-label="Position des sous-titres" className="grid grid-cols-3 gap-2">
            {CAPTION_POSITIONS.map((s) => <button key={s.key} type="button" role="radio" aria-checked={position === s.key} onClick={() => set(withPosition(style, s.key))} className={choice(position === s.key)}>{s.label}</button>)}
          </div>
        </div>
      </> : null}
    </fieldset>
  );
}
