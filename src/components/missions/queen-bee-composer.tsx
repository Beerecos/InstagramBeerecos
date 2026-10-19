"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { useActionState, useRef } from "react";
import { createMissionAction, type ActionState } from "@/app/(app)/_actions/missions";
import { cn } from "@/components/ui/cn";

export const MISSION_SUGGESTIONS = [
  "Créer mes contenus de la semaine",
  "Créer une vidéo IA sur le réseau monétisé",
  "Transformer une vidéo studio en Reels",
  "Inviter des dirigeants à visiter un club",
  "Trouver 20 idées de contenus",
  "Générer des prospects",
  "Analyser mes réseaux",
  "Créer mon calendrier éditorial de 30 jours",
];

/** Champ unique : l'utilisateur donne un objectif, Queen Bee crée la mission et lance l'équipe. */
export function QueenBeeComposer({ size = "lg", autoFocus = false, showSuggestions = true }: { size?: "lg" | "md"; autoFocus?: boolean; showSuggestions?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createMissionAction, {});
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <form action={action} className={cn("relative rounded-[1.75rem] bg-surface-1 ring-1 ring-line transition focus-within:ring-2 focus-within:ring-brand", size === "lg" ? "p-3 shadow-[0_12px_40px_-16px_rgba(40,81,255,0.35)]" : "p-2")}>
        <label htmlFor={`qb-${size}`} className="sr-only">Votre objectif</label>
        <textarea
          id={`qb-${size}`}
          ref={ref}
          name="request"
          required
          minLength={5}
          autoFocus={autoFocus}
          rows={size === "lg" ? 3 : 2}
          placeholder="Ex. : Prépare la semaine prochaine : 3 contenus sur le réseau monétisé, 2 sur la formation et 2 sur l'IA. Je veux générer des visites dans nos clubs."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className={cn("w-full resize-none bg-transparent px-3 py-2 text-ink-1 outline-none placeholder:text-ink-3", size === "lg" ? "text-base" : "text-sm")}
        />
        <div className="flex items-center justify-between gap-3 px-2">
          <p className="text-xs text-ink-3">Queen Bee planifie, l&apos;équipe exécute, vous validez.</p>
          <button type="submit" disabled={pending} aria-label="Lancer la mission" className="flex size-10 items-center justify-center rounded-full bg-brand text-white transition hover:bg-[#1f43e6] disabled:opacity-50">
            {pending ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
          </button>
        </div>
      </form>
      {state.error ? <p role="alert" className="mt-2 text-sm text-status-critical">{state.error}</p> : null}
      {showSuggestions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {MISSION_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (ref.current) {
                  ref.current.value = s;
                  ref.current.focus();
                }
              }}
              className="rounded-full bg-surface-1 px-3 py-1.5 text-sm text-ink-2 ring-1 ring-line transition hover:text-brand hover:ring-brand"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
