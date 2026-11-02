// Résolveur de médias pour les templates visuels (Lot 2) — PUR, testable.
// Sépare l'IMAGE du LAYOUT : pour chaque slide, choisit la meilleure source photo/fond selon
// l'ORDRE DE PRIORITÉ (§médiathèque) et résout les logos des `logoSlots` depuis la médiathèque.
//
// Ordre de priorité (photo/fond) : 1 média choisi par l'utilisateur → 2 média de l'événement →
// 3 média du club → 4 média du membre → 5 bibliothèque BeeMarketing → 6 génération IA (dernier recours).
//
// §3 / §11 : quand une PHOTO RÉELLE est exigée (vie du club, portrait membre) et qu'aucune n'est
// disponible, on NE fabrique PAS un faux visuel (pas de faux membres, pas de faux lieu) : on
// « bloque » et on demande un média réel (« DONNÉE MANQUANTE »). L'IA n'est un fallback que pour les
// fonds abstraits (accroche, bénéfices), jamais pour simuler des personnes réelles.

import type { LogoSlot, PhotoStrategy } from "./social-templates";

export type MediaKind = "photo" | "logo" | "background";
export type MediaSource = "user" | "event" | "club" | "member" | "library";

export type MediaAsset = {
  id: string;
  kind: MediaKind;
  source: MediaSource;               // niveau de priorité / provenance
  workspaceId?: string | null;       // club
  eventId?: string | null;
  contactId?: string | null;         // membre
  logoSlot?: LogoSlot | null;        // pour kind === "logo"
  url?: string | null;
  storagePath?: string | null;
  title?: string | null;
  altText?: string | null;
};

export type MediaContext = { eventId?: string | null; workspaceId?: string | null; contactId?: string | null };

// Ordre de priorité photo/fond (le 6ᵉ niveau « ia » est géré en fallback, pas dans cette liste).
export const PHOTO_PRIORITY: MediaSource[] = ["user", "event", "club", "member", "library"];

export type PhotoTier = MediaSource | "ai" | "none";
export type PhotoResolution = {
  asset: MediaAsset | null;
  tier: PhotoTier;
  useAi: boolean;     // un fond IA doit être généré
  blocked: boolean;   // photo réelle exigée mais absente → ne rien simuler, demander un média
  reason: string;
};

function isPhotoLike(a: MediaAsset): boolean {
  return a.kind === "photo" || a.kind === "background";
}

// Filtre les candidats d'un niveau de priorité pour un contexte donné.
function candidatesForTier(tier: MediaSource, ctx: MediaContext, pool: MediaAsset[]): MediaAsset[] {
  const photos = pool.filter(isPhotoLike);
  switch (tier) {
    case "user":    return photos.filter((a) => a.source === "user");
    case "event":   return ctx.eventId ? photos.filter((a) => a.source === "event" && a.eventId === ctx.eventId) : [];
    case "club":    return ctx.workspaceId ? photos.filter((a) => a.source === "club" && a.workspaceId === ctx.workspaceId) : [];
    case "member":  return ctx.contactId ? photos.filter((a) => a.source === "member" && a.contactId === ctx.contactId) : [];
    case "library": return photos.filter((a) => a.source === "library");
    default:        return [];
  }
}

/**
 * Choisit la source photo/fond d'un slide.
 * - `chosenId` : média explicitement sélectionné par l'utilisateur (priorité absolue).
 * - `strategy` : détermine le comportement quand aucune photo réelle n'est trouvée.
 */
export function resolvePhoto(
  strategy: PhotoStrategy,
  ctx: MediaContext,
  pool: MediaAsset[],
  chosenId?: string | null,
): PhotoResolution {
  // 1 — média choisi par l'utilisateur (n'importe quelle provenance)
  if (chosenId) {
    const chosen = pool.find((a) => a.id === chosenId && isPhotoLike(a));
    if (chosen) return { asset: chosen, tier: "user", useAi: false, blocked: false, reason: "Média choisi par l'utilisateur." };
  }
  // 2→5 — parcours de l'ordre de priorité
  for (const tier of PHOTO_PRIORITY) {
    if (tier === "user" && !chosenId) continue; // déjà traité / pas de choix explicite
    const found = candidatesForTier(tier, ctx, pool)[0];
    if (found) return { asset: found, tier, useAi: false, blocked: false, reason: `Média ${tier} trouvé.` };
  }
  // 6 — aucun média : fallback selon la stratégie
  if (strategy === "real_required" || strategy === "portrait_required") {
    return {
      asset: null, tier: "none", useAi: false, blocked: true,
      reason: strategy === "portrait_required"
        ? "DONNÉE MANQUANTE : portrait réel du membre requis (aucun visage inventé)."
        : "DONNÉE MANQUANTE : photo réelle requise (aucune scène/personne inventée).",
    };
  }
  // real_preferred / ai_ok → fond IA acceptable (abstrait, aux couleurs de marque)
  return { asset: null, tier: "ai", useAi: true, blocked: false, reason: "Aucun média — fond IA (abstrait) en dernier recours." };
}

export type LogoResolution = { slot: LogoSlot; asset: MediaAsset | null; available: boolean };

/**
 * Résout les logos des `logoSlots` d'un slide depuis la médiathèque (0..N).
 * Un logo manquant n'est PAS une erreur : il n'est simplement pas injecté.
 */
export function resolveLogos(slots: LogoSlot[], ctx: MediaContext, pool: MediaAsset[]): LogoResolution[] {
  const logos = pool.filter((a) => a.kind === "logo");
  return slots.map((slot) => {
    const match = logos.find((a) => {
      if (a.logoSlot !== slot) return false;
      // Un logo scopé (club/événement) ne s'applique qu'au bon contexte ; un logo non scopé (national) est global.
      if (a.workspaceId && a.workspaceId !== ctx.workspaceId) return false;
      if (a.eventId && a.eventId !== ctx.eventId) return false;
      return true;
    }) ?? null;
    return { slot, asset: match, available: !!match };
  });
}
