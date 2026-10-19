"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createOrganization, type OnboardingState } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createOrganization, {});
  return (
    <form action={action} className="max-w-md space-y-4">
      <div>
        <label htmlFor="name" className="text-sm font-medium">Nom</label>
        <input id="name" name="name" defaultValue="BeeRecos" required className="mt-1 h-11 w-full rounded-xl bg-surface-1 px-3 ring-1 ring-line" />
      </div>
      <div>
        <label htmlFor="slug" className="text-sm font-medium">Identifiant</label>
        <input id="slug" name="slug" defaultValue="beerecos" required className="mt-1 h-11 w-full rounded-xl bg-surface-1 px-3 ring-1 ring-line" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer l'espace BeeRecos"}</Button>
      {state.message ? <p role="alert" className="text-sm text-status-critical">{state.message}</p> : null}
    </form>
  );
}
