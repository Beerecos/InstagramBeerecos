"use client";
/**
 * Auto Director en mode simple (refonte 2026-11-10) : une seule caméra, plusieurs plans simulés aux moments forts.
 * Un choix : Désactivé, Sobre, Équilibré ou Dynamique. Enregistré tout de suite (annulable avec « Annuler »).
 */
import type { Edit } from "@/domain/social/montage/edit";
import { DIRECTOR_INTENSITIES, DIRECTOR_LABEL, type DirectorIntensity } from "@/domain/social/montage/director";

type Props = { edit: Edit; disabled: boolean; onChange: (patch: Pick<Edit, "rythme">) => void };

export default function StudioDirector({ edit, disabled, onChange }: Props) {
  const current = edit.rythme?.director ?? null;
  const set = (director: DirectorIntensity | null) => {
    const base = edit.rythme ?? { zoomCoupes: false, zoom: 1.1, volumeSon: 0.35 };
    const { director: _d, ...rest } = base; void _d;
    onChange({ rythme: director ? { ...rest, director } : rest });
  };
  const options: { key: DirectorIntensity | null; label: string; hint: string }[] = [
    { key: null, label: "Désactivé", hint: "Un seul plan, sans changement de cadrage" },
    ...DIRECTOR_INTENSITIES.map((k) => ({ key: k, ...DIRECTOR_LABEL[k] })),
  ];
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Rythme de la caméra</legend>
      <p className="text-xs text-mut">Bee simule plusieurs caméras : plan serré sur l&apos;accroche, les chiffres et l&apos;appel à l&apos;action, retour au plan large entre les idées. Ton cadrage manuel reste respecté.</p>
      <div role="radiogroup" aria-label="Rythme de la caméra" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => {
          const active = current === o.key;
          return (
            <button key={o.key ?? "off"} type="button" role="radio" aria-checked={active} onClick={() => { if (!active) set(o.key); }}
              className={`flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition ${active ? "border-brand ring-2 ring-brand/30" : "border-line hover:border-brand"}`}>
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="text-xs text-mut">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
