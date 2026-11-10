"use client";
/**
 * BeeStyles en mode simple (refonte 2026-11-10) : un clic choisit les animations posées sur les mots dits (accroche,
 * idées fortes, mot à retenir). Sans détourage, tout s'affiche devant la personne.
 */
import { activeStyle, BEE_STYLE, BEE_STYLES, type BeeStyle } from "@/domain/social/montage/bee-styles";
import type { CustomAnimation } from "@/domain/social/montage/suggest";

export default function StudioBeeStyles({ custom, disabled, onPick }: { custom: CustomAnimation[]; disabled: boolean; onPick: (style: BeeStyle) => void }) {
  const current = activeStyle(custom);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Style des animations</p>
      <div role="radiogroup" aria-label="Style des animations" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BEE_STYLES.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={current === k} disabled={disabled} onClick={() => onPick(k)}
            className={`flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition ${current === k ? "border-brand ring-2 ring-brand/30" : "border-line hover:border-brand"}`}>
            <span className="text-sm font-semibold">{BEE_STYLE[k].label}</span>
            <span className="text-xs text-mut">{BEE_STYLE[k].hint}</span>
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-mut">Un clic pose les animations sur les mots que tu dis. Sans détourage, tout s&apos;affiche devant toi. Tu peux ensuite changer l&apos;animation de chaque mot dans la liste.</p>
    </div>
  );
}
