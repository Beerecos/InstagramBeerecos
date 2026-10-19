"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="email" className="text-sm font-medium text-ink-1">Adresse email</label>
      <input id="email" name="email" type="email" required autoComplete="email" disabled={disabled} placeholder="prenom@beerecos.com" className="h-12 w-full rounded-2xl bg-surface-1 px-4 ring-1 ring-line outline-none focus:ring-brand" />
      <Button type="submit" size="lg" className="w-full" disabled={pending || disabled} icon={<Mail size={18} />}>
        {pending ? "Envoi…" : "Recevoir mon lien de connexion"}
      </Button>
      <p role="status" aria-live="polite" className={state.status === "error" ? "text-sm text-status-critical" : "text-sm text-ink-2"}>
        {state.message}
      </p>
    </form>
  );
}
