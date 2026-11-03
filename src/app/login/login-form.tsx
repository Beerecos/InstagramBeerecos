"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMagicLink, signInWithPassword, type LoginState } from "./actions";

const field = "h-12 w-full rounded-2xl bg-surface-1 px-4 ring-1 ring-line outline-none focus:ring-brand";

export function LoginForm({ disabled }: { disabled: boolean }) {
  const next = useSearchParams().get("next") ?? "/";
  const [mode, setMode] = useState<"password" | "link">("password");
  const [passwordState, passwordAction, passwordPending] = useActionState<LoginState, FormData>(signInWithPassword, { status: "idle" });
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });
  const state = mode === "password" ? passwordState : linkState;
  return (
    <div className="space-y-4">
      {mode === "password" ? (
        <form action={passwordAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="email" className="text-sm font-medium text-ink-1">Adresse email</label>
          <input id="email" name="email" type="email" required autoComplete="email" disabled={disabled} placeholder="prenom@beerecos.com" className={field} />
          <label htmlFor="password" className="block text-sm font-medium text-ink-1">Mot de passe</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" disabled={disabled} className={field} />
          <Button type="submit" size="lg" className="w-full" disabled={passwordPending || disabled} icon={<LogIn size={18} />}>
            {passwordPending ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      ) : (
        <form action={linkAction} className="space-y-3">
          <label htmlFor="email-link" className="text-sm font-medium text-ink-1">Adresse email</label>
          <input id="email-link" name="email" type="email" required autoComplete="email" disabled={disabled} placeholder="prenom@beerecos.com" className={field} />
          <Button type="submit" size="lg" className="w-full" disabled={linkPending || disabled} icon={<Mail size={18} />}>
            {linkPending ? "Envoi…" : "Recevoir mon lien de connexion"}
          </Button>
          <p className="text-xs text-ink-2">Ouvre le lien dans le même navigateur que celui où tu l&apos;as demandé.</p>
        </form>
      )}
      <p role="status" aria-live="polite" className={state.status === "error" ? "text-sm text-status-critical" : "text-sm text-ink-2"}>{state.message}</p>
      <button type="button" className="text-sm text-brand underline" onClick={() => setMode(mode === "password" ? "link" : "password")}>
        {mode === "password" ? "Recevoir plutôt un lien par email" : "Se connecter avec un mot de passe"}
      </button>
    </div>
  );
}
