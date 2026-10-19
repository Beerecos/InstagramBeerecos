"use client";

import { useActionState } from "react";
import { saveBrandAction, type ActionState } from "@/app/(app)/_actions/missions";
import { Button } from "@/components/ui/button";
import type { BrandMemory } from "@/domain/missions/types";

function Field({ label, name, value, rows = 2, hint, disabled }: { label: string; name: string; value: string; rows?: number; hint?: string; disabled: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-ink-1">{label}</label>
      {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
      <textarea id={name} name={name} defaultValue={value} rows={rows} disabled={disabled} className="mt-1 w-full rounded-xl bg-surface-0 px-3 py-2 text-sm ring-1 ring-line outline-none focus:ring-brand disabled:opacity-70" />
    </div>
  );
}

export function BrandForm({ memory, editable }: { memory: BrandMemory; editable: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveBrandAction, {});
  const d = !editable;
  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2">
      <Field label="Entreprise" name="company" value={memory.company} rows={1} disabled={d} />
      <Field label="Ton" name="tone" value={memory.tone} disabled={d} />
      <Field label="Description" name="description" value={memory.description} rows={3} disabled={d} />
      <Field label="Positionnement" name="positioning" value={memory.positioning} rows={3} disabled={d} />
      <Field label="Cibles" name="targets" value={memory.targets.join("\n")} rows={4} hint="Une par ligne" disabled={d} />
      <Field label="Offres" name="offers" value={memory.offers.join("\n")} rows={4} hint="Une par ligne" disabled={d} />
      <Field label="Mots autorisés" name="allowedWords" value={memory.allowedWords.join("\n")} rows={4} hint="Un par ligne" disabled={d} />
      <Field label="Mots interdits" name="forbiddenWords" value={memory.forbiddenWords.join("\n")} rows={4} hint="Un par ligne — contrôlés automatiquement par le Brand Guardian" disabled={d} />
      <Field label="CTA" name="ctas" value={memory.ctas.join("\n")} rows={3} hint="Un par ligne" disabled={d} />
      <Field label="Références" name="references" value={memory.references.join("\n")} rows={3} hint="Une par ligne" disabled={d} />
      <fieldset className="lg:col-span-2">
        <legend className="text-sm font-medium text-ink-1">Pondération des piliers (%)</legend>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {([["w_reseau", "Réseau MONÉTISÉ", memory.pillarWeights.reseau_monetise], ["w_formation", "Formation", memory.pillarWeights.formation], ["w_ia", "Digitalisation IA", memory.pillarWeights.digitalisation_ia]] as const).map(([n, l, v]) => (
            <label key={n} className="text-sm text-ink-2">{l}<input name={n} type="number" min={0} max={100} defaultValue={v} disabled={d} className="mt-1 h-10 w-full rounded-xl bg-surface-0 px-3 ring-1 ring-line" /></label>
          ))}
        </div>
      </fieldset>
      {editable ? (
        <div className="flex items-center gap-3 lg:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la mémoire de marque"}</Button>
          <p role="status" className="text-sm text-ink-2">{state.error ? <span className="text-status-critical">{state.error}</span> : state.ok ? "Enregistré. Tous les agents utiliseront ces informations." : ""}</p>
        </div>
      ) : (
        <p className="text-sm text-ink-3 lg:col-span-2">Seul un administrateur peut modifier la mémoire de marque.</p>
      )}
    </form>
  );
}
