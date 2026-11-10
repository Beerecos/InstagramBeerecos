"use client";
/**
 * « Studio simple » (2026-11-10) : chaque changement d'animation s'enregistre tout seul, sans bouton (« Annuler » reste
 * disponible), et la touche Suppr / Retour arrière retire l'animation choisie. Un enregistrement en échec n'est pas
 * relancé en boucle : on attend le changement suivant. Ne rend rien.
 */
import { useEffect, useRef } from "react";

type Props = { active: boolean; unsaved: boolean; contentKey: string; onSave: () => Promise<unknown>; canDelete: boolean; onDelete: () => void };

export default function StudioAutoSave({ active, unsaved, contentKey, onSave, canDelete, onDelete }: Props) {
  const failed = useRef<string | null>(null);
  const save = useRef(onSave);
  const del = useRef({ canDelete, onDelete });
  useEffect(() => { save.current = onSave; del.current = { canDelete, onDelete }; });

  useEffect(() => {
    if (!active || !unsaved || failed.current === contentKey) return;
    const t = window.setTimeout(() => { void save.current().catch(() => { failed.current = contentKey; }); }, 700);
    return () => window.clearTimeout(t);
  }, [active, unsaved, contentKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!del.current.canDelete) return;
      e.preventDefault();
      del.current.onDelete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
