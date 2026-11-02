import type { EditorialMedia } from "./editorial-api";

/**
 * Brouillon LOCAL de l'éditeur de contenus (page Réseaux sociaux, 2026-10-21) : fermer le panneau, ouvrir Comptes
 * ou le studio, revenir en arrière ne perd pas la saisie. Il vit dans le navigateur, isolé par utilisateur et par
 * contenu (ou par contexte de création : campagne, club, jour) ; il n'est JAMAIS présenté comme « Enregistré » —
 * seule la confirmation du serveur l'est. Il est effacé dès que l'enregistrement serveur réussit.
 */

export type DraftVariant = { enabled: boolean; subject: string; content: string; date: string; media: EditorialMedia[] };
export type DraftForm = {
  title: string; objective: string; cta: string; destinationUrl: string; brief: string;
  campaignId: string; workspaceId: string; variants: Record<string, DraftVariant>;
};

const PREFIX = "bee.social.draft.v1";
/** Un brouillon oublié ne ressurgit pas indéfiniment. */
export const DRAFT_TTL_MS = 14 * 24 * 3600 * 1000;

/** Clé isolée : utilisateur + contenu existant, ou utilisateur + contexte de création. Sans utilisateur, pas de brouillon. */
export function draftKey(userId: string | null, ctx: { editId: string; campaignId: string; workspaceId: string; day: string }): string | null {
  if (!userId) return null;
  const scope = ctx.editId ? `edit:${ctx.editId}` : `new:${ctx.campaignId || "-"}:${ctx.workspaceId || "-"}:${ctx.day || "-"}`;
  return `${PREFIX}:${userId}:${scope}`;
}

export const serializeDraft = (form: DraftForm) => JSON.stringify(form);

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const storage = (): Store | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function readDraft(key: string | null, now = Date.now(), store: Store | null = storage()): DraftForm | null {
  if (!key || !store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; form?: DraftForm };
    if (!parsed.form || typeof parsed.at !== "number" || now - parsed.at > DRAFT_TTL_MS) { store.removeItem(key); return null; }
    return parsed.form;
  } catch { return null; }
}

/** Écrit le brouillon ; renvoie false si le navigateur refuse (navigation privée, quota) : l'interface le dit. */
export function writeDraft(key: string | null, form: DraftForm, now = Date.now(), store: Store | null = storage()): boolean {
  if (!key || !store) return false;
  try { store.setItem(key, JSON.stringify({ at: now, form })); return true; } catch { return false; }
}

export function clearDraft(key: string | null, store: Store | null = storage()): void {
  if (!key || !store) return;
  try { store.removeItem(key); } catch { /* rien à effacer */ }
}
