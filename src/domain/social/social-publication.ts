// Workflow + assemblage d'une publication visuelle (Lot 3b) — PUR, testable.
// 1) MACHINE À ÉTATS : BROUILLON → GÉNÉRÉ → À VALIDER → VALIDÉ → PROGRAMMÉ → PUBLIÉ (+ ARCHIVÉ).
//    §11 : la publication réelle reste un geste HUMAIN — aucune transition n'auto-publie.
// 2) ASSEMBLAGE : combine le LAYOUT (buildTemplate) + la MÉDIATHÈQUE (resolvePhoto/resolveLogos)
//    en une COMPOSITION prête à composer/exporter. Sépare fond (média réel prioritaire, IA en
//    dernier recours) des overlays (texte/CTA composés) et des logos (slots injectés).

import { buildTemplate, type SocialTemplateType, type StyleMemory, type TemplateData, type Overlay, type LogoSlot, type PhotoStrategy, DEFAULT_STYLE_MEMORY } from "./social-templates";
import { resolvePhoto, resolveLogos, type MediaAsset, type MediaContext } from "./media-resolver";

// ------------------------------------------------------------------ Machine à états
export type PublicationStatus = "brouillon" | "genere" | "a_valider" | "valide" | "programme" | "publie" | "archive";

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  brouillon: "Brouillon", genere: "Généré", a_valider: "À valider", valide: "Validé",
  programme: "Programmé", publie: "Publié", archive: "Archivé",
};

// Transitions autorisées (jamais de saut vers « publié » sans passer par « validé » — §11).
export const ALLOWED_TRANSITIONS: Record<PublicationStatus, PublicationStatus[]> = {
  brouillon: ["genere", "archive"],
  genere: ["a_valider", "brouillon", "archive"],   // retour brouillon = ré-édition
  a_valider: ["valide", "genere", "archive"],       // renvoi en édition possible
  valide: ["programme", "publie", "genere", "archive"], // re-génération = repasse par validation
  programme: ["publie", "valide", "archive"],       // déprogrammer = revient à validé
  publie: ["archive"],
  archive: [],
};

export function canTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Lève si la transition est interdite (à utiliser côté service avant d'écrire un nouvel état). */
export function assertTransition(from: PublicationStatus, to: PublicationStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transition interdite : ${PUBLICATION_STATUS_LABELS[from]} → ${PUBLICATION_STATUS_LABELS[to]}`);
  }
}

// ------------------------------------------------------------------ Assemblage (composition)
export type SlideBackground =
  | { kind: "media"; assetId: string; url: string | null; source: string }
  | { kind: "ai"; prompt: string }
  | { kind: "blocked"; reason: string };

export type ComposedLogo = { slot: LogoSlot; assetId: string | null; available: boolean };

export type ComposedSlide = {
  index: number;
  role: string;
  ratio: string;
  photoStrategy: PhotoStrategy;
  headline: string;
  lines: string[];
  overlay: Overlay[];
  background: SlideBackground;
  logos: ComposedLogo[];
};

export type Composition = {
  type: SocialTemplateType;
  label: string;
  format: "carousel" | "single";
  defaultRatio: string;
  ratios: string[];
  slides: ComposedSlide[];
  caption: string;
  cta: string;
  hashtags: string[];
  missing: string[];          // données TEXTE manquantes (§3)
  blockedSlides: number[];    // slides dont la photo réelle exigée est absente (à compléter)
};

export type AssembleInput = {
  type: SocialTemplateType;
  data: TemplateData;
  memory?: StyleMemory;
  mediaPool?: MediaAsset[];
  refs?: MediaContext;                       // eventId / workspaceId / contactId réels
  chosenMedia?: Record<number, string>;      // slide index → media id choisi par l'utilisateur
};

/**
 * Produit une composition prête à valider : structure + textes (buildTemplate) enrichis du choix de
 * FOND (média prioritaire, sinon IA/bloqué) et des LOGOS résolus par slide. Ne publie rien.
 */
export function assemblePublication(input: AssembleInput): Composition {
  const memory = input.memory ?? DEFAULT_STYLE_MEMORY;
  const pool = input.mediaPool ?? [];
  const refs = input.refs ?? {};
  const chosen = input.chosenMedia ?? {};
  const built = buildTemplate(input.type, input.data, memory);
  const blockedSlides: number[] = [];

  const slides: ComposedSlide[] = built.slides.map((s) => {
    const photo = resolvePhoto(s.visual.photoStrategy, refs, pool, chosen[s.index]);
    let background: SlideBackground;
    if (photo.asset) {
      background = { kind: "media", assetId: photo.asset.id, url: photo.asset.url ?? null, source: photo.asset.source };
    } else if (photo.blocked) {
      background = { kind: "blocked", reason: photo.reason };
      blockedSlides.push(s.index);
    } else {
      background = { kind: "ai", prompt: s.visual.aiPrompt };
    }
    const logos = resolveLogos(s.visual.logoSlots, refs, pool).map((l) => ({ slot: l.slot, assetId: l.asset?.id ?? null, available: l.available }));
    return {
      index: s.index, role: s.role, ratio: s.visual.ratio, photoStrategy: s.visual.photoStrategy,
      headline: s.headline, lines: s.lines, overlay: s.visual.overlay, background, logos,
    };
  });

  return {
    type: input.type, label: built.label, format: built.format, defaultRatio: built.defaultRatio,
    ratios: built.ratios, slides, caption: built.caption, cta: built.cta, hashtags: built.hashtags,
    missing: built.missing, blockedSlides,
  };
}

/** Une composition est « prête à valider » si aucune donnée texte ne manque et aucun slide n'est bloqué. */
export function isReadyForValidation(c: Composition): boolean {
  return c.missing.length === 0 && c.blockedSlides.length === 0;
}
