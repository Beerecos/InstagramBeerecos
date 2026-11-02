"use client";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Panneau latéral de la page Réseaux sociaux (2026-10-21) : l'éditeur, les comptes ou le studio s'ouvrent AU-DESSUS
 * de la liste, sans la quitter. `<dialog>` modal natif : focus initial dans le panneau, piège du focus, Échap pour
 * fermer, puis retour du focus sur l'élément qui l'a ouvert. La saisie non enregistrée est gardée par l'éditeur
 * (brouillon local), fermer ne la perd donc pas. `titleInside` : l'outil affiché porte déjà son propre titre.
 */
export default function EditorDrawer({ title, subtitle, wide = false, titleInside = false, onClose, children }: { title: string; subtitle?: string; wide?: boolean; titleInside?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    opener.current = document.activeElement;
    if (!dialog.open) { try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); } }
    return () => {
      if (dialog.open) dialog.close();
      const back = opener.current as HTMLElement | null;
      if (back && document.contains(back)) back.focus();
    };
  }, []);
  return <dialog ref={ref} {...(titleInside ? { "aria-label": title } : { "aria-labelledby": "social-drawer-title" })}
    onCancel={(e) => { e.preventDefault(); onClose(); }}
    className={`m-0 ml-auto h-dvh max-h-none w-full max-w-none overflow-hidden bg-white p-0 text-fg shadow-[-15px_0_70px_rgba(24,42,107,0.18)] backdrop:bg-[rgba(22,36,64,0.18)] ${wide ? "sm:w-[min(1180px,96vw)]" : "sm:w-[min(920px,94vw)]"}`}>
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div><p className="kicker text-brand">Sans quitter tes contenus</p>{!titleInside && <h2 id="social-drawer-title" className="mt-1 font-display text-2xl">{title}</h2>}{subtitle && <p className="mt-1 text-xs text-mut">{subtitle}</p>}</div>
        <button type="button" className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-line hover:bg-black/[0.04]" aria-label="Fermer le panneau" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  </dialog>;
}
