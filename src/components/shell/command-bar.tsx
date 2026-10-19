"use client";

import { ArrowUp, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentMessage } from "@/components/ui/agent-message";

const EXAMPLES = [
  "Prépare ma semaine Instagram.",
  "Crée 2 vidéos IA sur le réseau monétisé.",
  "Utilise ma dernière vidéo studio et fabrique trois Reels.",
  "Quels contenus ont généré le plus de visites ?",
  "Trouve-moi les prospects chauds.",
];

type Message = { id: number; role: "user" | "agent"; text: string };

/**
 * Barre « Demander à BeeSocial », présente sur toutes les pages (raccourci ⌘K / Ctrl K).
 * Phase 1 : interface. L'orchestrateur eve y est branché en phase 2 (useEveAgent).
 */
export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit(text: string) {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [
      ...m,
      { id: Date.now(), role: "user", text: t },
      { id: Date.now() + 1, role: "agent", text: "Bien reçu. Je ne peux pas encore agir : l'orchestrateur BeeSocial est branché à la prochaine étape (phase 2). Ta demande n'a déclenché aucune action." },
    ]);
    setValue("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group fixed bottom-20 left-1/2 z-30 flex w-[min(42rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-full bg-[#14130f] px-5 py-3 text-left text-sm text-[#c9c7bf] shadow-lg ring-1 ring-white/10 transition hover:text-white lg:bottom-6"
      >
        <Sparkles aria-hidden size={18} className="text-honey" />
        <span className="flex-1">Demander à BeeSocial…</span>
        <kbd className="hidden rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] text-[#a3a199] sm:inline">⌘K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Demander à BeeSocial" className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-3xl bg-surface-0 shadow-2xl ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between px-5 pt-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles aria-hidden size={16} className="text-honey" /> Demander à BeeSocial</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2"><X size={18} /></button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
              {messages.length === 0 ? (
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} type="button" onClick={() => submit(ex)} className="rounded-full bg-surface-1 px-3 py-1.5 text-sm text-ink-2 ring-1 ring-line hover:text-ink-1">{ex}</button>
                  ))}
                </div>
              ) : (
                messages.map((m) => <AgentMessage key={m.id} role={m.role}>{m.text}</AgentMessage>)
              )}
            </div>
            <form
              className="flex items-end gap-2 border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit(value);
              }}
            >
              <label htmlFor="beesocial-ask" className="sr-only">Votre demande</label>
              <textarea
                id="beesocial-ask"
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(value);
                  }
                }}
                rows={1}
                placeholder="Ex. : Prépare un Reel sur l'IA avec un CTA vers une visite de club"
                className="max-h-40 flex-1 resize-none rounded-2xl bg-surface-1 px-4 py-2.5 text-sm ring-1 ring-line outline-none focus:ring-ink-3"
              />
              <button type="submit" aria-label="Envoyer" className="flex size-10 items-center justify-center rounded-full bg-brand text-brand-ink disabled:opacity-40" disabled={!value.trim()}>
                <ArrowUp size={18} />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
