import { layout, toOutputMs, totalMs, type CaptionWord, type Edit, type Segment, type Son } from "./edit";
import { END_VIDEO } from "./brand";
import { SFX_KIT_DATA } from "./sfx-kit-data";
import { studioSequences } from "./studio-sequences";

/**
 * Effets sonores SFX Kit (2026-11-12) : placement, atténuation sous la voix et sonorisation automatique.
 * Fonctions pures, partagées par l'aperçu et le rendu (même composition, mêmes nombres).
 *
 * Placement (GUIDE.md du kit, § 2) : début du son = instant visé − sync.at (vitesse normale : le Studio ne change pas
 * la vitesse des prises). Avant le début du montage, la partie hors montage est rognée (data-media-start) en gardant
 * l'alignement ; après la fin, la fin est coupée. Une coupe courte adoucit chaque rognage (10–30 ms au début,
 * 20–50 ms en fin, recommandation du kit).
 */

export type SfxInfo = { id: string; category: string; durationS: number; syncS: number; onsetS: number; bodyEndS: number; underVoiceDb: number };
export function sfxInfo(id: string): SfxInfo | null {
  const d = SFX_KIT_DATA[id];
  return d ? { id, category: d[0], durationS: d[1], syncS: d[2], onsetS: d[3], bodyEndS: d[4], underVoiceDb: d[5] } : null;
}
/** Chemin du fichier sous public/hyperframes/ (aperçu : URL de l'application ; rendu : fichier du ZIP). */
export const sfxPath = (id: string) => { const i = sfxInfo(id); return i ? `sfx-kit/${i.category}/${id}.flac` : null; };

/** Fondus de rognage (ms) et durée audible minimale d'un effet. */
const TRIM_FADE_IN = 15, TRIM_FADE_OUT = 40, MIN_AUDIBLE = 30;

export type PlacedSon = {
  occ: Son;
  file: string;
  /** Temps du montage (ms). */
  startMs: number; durationMs: number;
  /** Rognage du début du fichier (ms). */
  mediaStartMs: number;
  /** Volume final (occurrence × réglage global × atténuation sous la voix), plafonné à 1 (0 dB) contre la saturation. */
  volume: number;
  /** Atténuation sous la voix appliquée (dB, 0 = aucune). */
  duckDb: number;
  fadeInMs: number; fadeOutMs: number;
};
export type SonProbleme = { occ: Son; raison: "introuvable" | "animation-supprimee" | "hors-montage" | "muet" };

/** Instant visé (temps du montage, ms) par une occurrence ; null si sa cible n'existe plus ou est coupée. */
export function targetMs(edit: Edit, occ: Son, segments: Segment[] = layout(edit.ranges)): number | null | "animation-supprimee" | "hors-montage" {
  const F = (src: number) => toOutputMs(segments, src);
  const kept = (src: number) => segments.some((g) => src >= g.fromMs && src < g.toMs);
  const a = occ.ancre;
  if (a.type === "libre") return kept(a.debutMs) ? F(a.debutMs) : "hors-montage";
  if (a.type === "repere") return kept(a.atMs) ? F(a.atMs) : "hors-montage";
  if (a.type === "logo") return endVideoAt(edit, segments);
  const anim = edit.custom.find((c) => c.id === a.animId);
  if (!anim) return "animation-supprimee";
  const from = F(anim.fromMs), to = F(anim.toMs);
  if (to <= from) return "hors-montage";
  return a.point === "fin" ? to : from + ANIM_ENTREE_MS;
}

/** Une animation entre en ~0,1 à 0,3 s : un son « instant » rejoint l'élément quand il est en place. */
export const ANIM_ENTREE_MS = 120;

const withEndVideo = (edit: Edit) => Boolean(edit.outro) || edit.custom.some((c) => c.name === "logo-fin");
/** Début de la vidéo de fin officielle (null sans vidéo de fin). */
function endVideoAt(edit: Edit, segments: Segment[]): number | null {
  return withEndVideo(edit) ? totalMs(segments) : null;
}

/** Fenêtres de parole (temps du montage) : celles qui baissent déjà la musique (speechWindows), passées en argument. */
export type Window = { fromMs: number; toMs: number };

/**
 * Pose toutes les occurrences : `placed` = ce qui sonne (aperçu et rendu), `problemes` = ce qui ne sonne pas, et pourquoi.
 * `endMs` = fin de la composition (montage + vidéo de fin).
 */
export function placeSons(edit: Edit, speech: Window[], opts: { segments?: Segment[]; endMs?: number } = {}): { placed: PlacedSon[]; problemes: SonProbleme[] } {
  const segments = opts.segments ?? layout(edit.ranges);
  const endMs = opts.endMs ?? totalMs(segments) + (withEndVideo(edit) ? END_VIDEO.durationMs : 0);
  const global = edit.sonsReglages?.volume ?? 1;
  const placed: PlacedSon[] = [], problemes: SonProbleme[] = [];
  for (const occ of edit.sons ?? []) {
    const info = sfxInfo(occ.son);
    const file = sfxPath(occ.son);
    if (!info || !file) { problemes.push({ occ, raison: "introuvable" }); continue; }
    const target = targetMs(edit, occ, segments);
    if (target === "animation-supprimee" || target === "hors-montage" || target === null) { problemes.push({ occ, raison: target === "animation-supprimee" ? "animation-supprimee" : "hors-montage" }); continue; }
    if (occ.muet) { problemes.push({ occ, raison: "muet" }); continue; }
    // Libre : le début du fichier est posé à l'instant choisi ; sinon, son point de synchro rejoint l'instant visé.
    const start = Math.round(target + occ.decalageMs - (occ.ancre.type === "libre" ? 0 : info.syncS * 1000));
    const fileMs = Math.round(info.durationS * 1000);
    const usable = Math.min(fileMs, occ.dureeMs ?? fileMs);
    const trim = Math.max(0, -start);
    const at = Math.max(0, start);
    const duration = Math.min(usable - trim, endMs - at);
    // Un son très court (un clic de 17 ms) sonne en entier ; seul un son rogné presque à rien est écarté.
    const rogne = trim > 0 || duration < usable - trim;
    if (duration <= 0 || (rogne && duration < MIN_AUDIBLE)) { problemes.push({ occ, raison: "hors-montage" }); continue; }
    // Atténuation sous la voix : si le corps du son (onset → body_end) recouvre une parole, -under_voiceover_db.
    const bodyFrom = start + info.onsetS * 1000, bodyTo = start + info.bodyEndS * 1000;
    const overlaps = speech.some((w) => bodyFrom < w.toMs && bodyTo > w.fromMs);
    const duckDb = overlaps ? info.underVoiceDb : 0;
    const volume = Math.min(1, Math.round(occ.volume * global * 10 ** (duckDb / 20) * 1000) / 1000);
    const cutEnd = duration < usable - trim;
    placed.push({
      occ, file, startMs: at, durationMs: duration, mediaStartMs: trim, volume, duckDb,
      fadeInMs: Math.max(occ.fonduEntreeMs ?? 0, trim > 0 ? TRIM_FADE_IN : 0),
      fadeOutMs: Math.max(occ.fonduSortieMs ?? 0, cutEnd || (occ.dureeMs ?? fileMs) < fileMs ? TRIM_FADE_OUT : 0),
    });
  }
  placed.sort((a, b) => a.startMs - b.startMs || a.occ.id.localeCompare(b.occ.id));
  return { placed, problemes };
}

/** Lane de volume Hyperframes (data-automation) pour les fondus ; null sans fondu. */
export function fadeLane(p: PlacedSon): string | null {
  if (!p.fadeInMs && !p.fadeOutMs) return null;
  const d = p.durationMs / 1000, fi = Math.min(p.fadeInMs, p.durationMs / 2) / 1000, fo = Math.min(p.fadeOutMs, p.durationMs / 2) / 1000;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  const pts = [...(fi ? [{ t: 0, v: 0 }, { t: r(fi), v: 1 }] : [{ t: 0, v: 1 }]), ...(fo ? [{ t: r(d - fo), v: 1 }, { t: r(d), v: 0 }] : [{ t: r(d), v: 1 }])];
  return JSON.stringify({ version: 1, lanes: [{ target: "volume", points: pts }] });
}

/** Fichiers SFX Kit qui sonnent dans ce montage (à embarquer dans le projet de rendu). */
export function usedSfxFiles(edit: Edit): string[] {
  const files = new Set<string>();
  for (const occ of edit.sons ?? []) if (!occ.muet) { const f = sfxPath(occ.son); if (f) files.add(f); }
  return [...files].sort();
}

// ------------------------------------------------------------------------------------------ Son automatique

/** Événements visuels sonorisés automatiquement. */
export type SonEvenement = "texte" | "accent" | "chiffre" | "mouvement" | "zoom" | "zoom-lent" | "transition" | "logo";

/**
 * Table de correspondance (configurable) : événement → son SFX Kit, choisi d'après le guide du kit (use_for, durée).
 * `priorite` : ce qui passe en premier quand deux événements sont trop proches. Identifiants vérifiés par les tests.
 */
export const SONS_AUTO: Record<SonEvenement, { son: string; volume: number; priorite: number }> = {
  texte: { son: "pop-small-in", volume: 0.6, priorite: 1 },              // apparition d'un texte : pop discret
  accent: { son: "impact-light-soft", volume: 0.7, priorite: 4 },         // mot important, titre accentué : impact léger
  chiffre: { son: "tone-ding-mid", volume: 0.5, priorite: 4 },            // chiffre ou information mise en avant : ding discret
  mouvement: { son: "whoosh-medium-soft", volume: 0.6, priorite: 3 },     // déplacement rapide : souffle court
  zoom: { son: "move-zoom-in", volume: 0.6, priorite: 3 },                // zoom d'accentuation (0,25 s)
  "zoom-lent": { son: "whoosh-slow-soft", volume: 0.5, priorite: 2 },     // rapprochement lent
  transition: { son: "whoosh-medium-soft", volume: 0.5, priorite: 2 },    // transition entre séquences : whoosh
  logo: { son: "sting-warm-short", volume: 0.7, priorite: 5 },            // apparition du logo : signature courte
};

/** Animation du Studio → événement (absente = apparition de texte). */
export const ANIMATION_EVENEMENT: Record<string, SonEvenement | null> = {
  "mot-impact": "accent", "mot-central": "accent", "titre-profondeur": "accent", barre: "accent", "mot-cle": "accent", "cta-saisie": "accent",
  chiffre: "chiffre", "piliers-progressifs": "chiffre",
  "cube-3d": "mouvement", "carte-retournee": "mouvement", "cascade-3d": "mouvement", "tour-blocs": "mouvement", "icones-orbite": "mouvement",
  "fusee-decollage": "mouvement", "arbre-pousse": "mouvement", parcours: "mouvement",
  "logo-fin": null, // la vidéo de fin a son propre événement « logo »
};

/** Écart minimal entre deux sons automatiques, et dégagement d'une transition. */
const GAP_MS = 600, TRANSITION_GAP_MS = 1200, TRANSITION_EVERY_MS = 6000;

type Candidat = { cle: string; evenement: SonEvenement; ancre: Son["ancre"]; at: number };

/** Instant (temps du montage) visé par un événement, pour l'espacement. */
function candidats(edit: Edit, words: CaptionWord[], segments: Segment[]): Candidat[] {
  const F = (src: number) => toOutputMs(segments, src);
  const kept = (src: number) => segments.some((g) => src >= g.fromMs && src < g.toMs);
  const out: Candidat[] = [];
  for (const c of edit.custom) {
    if (!c.id) continue;
    const evenement = c.name in ANIMATION_EVENEMENT ? ANIMATION_EVENEMENT[c.name] : "texte";
    if (!evenement || F(c.toMs) <= F(c.fromMs)) continue;
    out.push({ cle: `anim:${c.id}`, evenement, ancre: { type: "animation", animId: c.id, point: "debut" }, at: F(c.fromMs) + ANIM_ENTREE_MS });
  }
  for (const z of edit.zooms ?? []) {
    // Zoom d'accentuation : il arrive en 0,25 s (le son « move-zoom-in » rejoint l'arrivée) ; progressif : milieu du début.
    const atMs = z.type === "accent" ? z.fromMs + 250 : z.fromMs + Math.min(750, Math.round((z.toMs - z.fromMs) / 4));
    if (kept(atMs)) out.push({ cle: `zoom:${z.fromMs}`, evenement: z.type === "accent" ? "zoom" : "zoom-lent", ancre: { type: "repere", atMs, nature: "zoom" }, at: F(atMs) });
  }
  for (const l of edit.miseEnPage ?? []) if (kept(l.fromMs + 225)) out.push({ cle: `page:${l.fromMs}`, evenement: "transition", ancre: { type: "repere", atMs: l.fromMs + 225, nature: "mise-en-page" }, at: F(l.fromMs + 225) });
  // Transitions entre séquences : seulement aux changements de séquence espacés (pas à chaque coupe ni à chaque mot).
  if (words.length) for (const s of studioSequences(words, edit.ranges).slice(1)) if (kept(s.startMs)) out.push({ cle: `seq:${s.startMs}`, evenement: "transition", ancre: { type: "repere", atMs: s.startMs, nature: "transition" }, at: F(s.startMs) });
  if (withEndVideo(edit)) out.push({ cle: "logo:fin", evenement: "logo", ancre: { type: "logo" }, at: totalMs(segments) });
  return out;
}

/** Garde les événements importants, sans superposition : priorité d'abord, puis ordre chronologique (déterministe). */
function retenir(cands: Candidat[]): Candidat[] {
  const order = [...cands].sort((a, b) => SONS_AUTO[b.evenement].priorite - SONS_AUTO[a.evenement].priorite || a.at - b.at || a.cle.localeCompare(b.cle));
  const kept: Candidat[] = [];
  for (const c of order) {
    const near = (gap: number, pred: (k: Candidat) => boolean = () => true) => kept.some((k) => pred(k) && Math.abs(k.at - c.at) < gap);
    if (near(GAP_MS)) continue;
    if (c.evenement === "transition" && (near(TRANSITION_GAP_MS) || near(TRANSITION_EVERY_MS, (k) => k.evenement === "transition"))) continue;
    kept.push(c);
  }
  return kept.sort((a, b) => a.at - b.at || a.cle.localeCompare(b.cle));
}

/** Identifiant stable d'une occurrence automatique (même événement → même identifiant, à chaque relance). */
export const autoId = (cle: string) => `auto-${cle.replace(/[^a-zA-Z0-9_-]/g, "-")}`.slice(0, 64);

/**
 * Sonorisation automatique : met à jour les occurrences automatiques sans doublon (une par événement, repérée par
 * `cle`), garde les choix manuels (`modifie`) et ne recrée pas un son supprimé par l'utilisateur (`sonsAutoIgnores`).
 * Les occurrences manuelles ne changent pas. Même montage → même résultat.
 */
export function genererSonsAuto(edit: Edit, words: CaptionWord[]): Edit {
  const segments = layout(edit.ranges);
  const ignores = new Set(edit.sonsAutoIgnores ?? []);
  const retenus = retenir(candidats(edit, words, segments).filter((c) => !ignores.has(c.cle)));
  const byKey = new Map((edit.sons ?? []).filter((o) => o.origine === "auto" && o.cle).map((o) => [o.cle!, o]));
  const wanted = new Set(retenus.map((c) => c.cle));
  const next: Son[] = [];
  for (const o of edit.sons ?? []) {
    if (o.origine !== "auto") { next.push(o); continue; }
    // Événement disparu : son retiré, sauf si l'utilisateur l'a réglé et que sa cible existe encore.
    if (o.cle && !wanted.has(o.cle) && !(o.modifie?.length && typeof targetMs(edit, o, segments) === "number")) continue;
    if (o.cle && wanted.has(o.cle)) continue; // remis à jour ci-dessous
    next.push(o);
  }
  for (const c of retenus) {
    const table = SONS_AUTO[c.evenement];
    const prev = byKey.get(c.cle);
    const kept = new Set(prev?.modifie ?? []);
    next.push({
      id: prev?.id ?? autoId(c.cle), son: kept.has("son") ? prev!.son : table.son, lib: "sfx-kit@1.0.0", ancre: c.ancre,
      decalageMs: kept.has("decalage") ? prev!.decalageMs : 0, volume: kept.has("volume") ? prev!.volume : table.volume, muet: kept.has("muet") ? prev!.muet : false,
      origine: "auto", cle: c.cle, ...(prev?.modifie?.length ? { modifie: prev.modifie } : {}),
      ...(prev?.dureeMs ? { dureeMs: prev.dureeMs } : {}), ...(prev?.fonduEntreeMs ? { fonduEntreeMs: prev.fonduEntreeMs } : {}), ...(prev?.fonduSortieMs ? { fonduSortieMs: prev.fonduSortieMs } : {}),
    });
  }
  return { ...edit, sons: next, sonsReglages: { volume: edit.sonsReglages?.volume ?? 1, auto: true } };
}

/** « Son automatique » désactivé : les sons automatiques non retouchés partent, les réglages manuels restent. */
export function retirerSonsAuto(edit: Edit): Edit {
  return { ...edit, sons: (edit.sons ?? []).filter((o) => o.origine !== "auto" || o.modifie?.length), sonsReglages: { volume: edit.sonsReglages?.volume ?? 1, auto: false } };
}

/** Modifie une occurrence ; sur un son automatique, le champ changé est retenu pour les relances. */
export function modifierSon(edit: Edit, id: string, patch: Partial<Pick<Son, "son" | "volume" | "muet" | "decalageMs" | "dureeMs" | "ancre">>): Edit {
  const champs = { son: "son", volume: "volume", muet: "muet", decalageMs: "decalage" } as const;
  return {
    ...edit,
    sons: (edit.sons ?? []).map((o) => {
      if (o.id !== id) return o;
      const marks = new Set(o.modifie ?? []);
      if (o.origine === "auto") for (const k of Object.keys(patch) as (keyof typeof patch)[]) if (k in champs) marks.add(champs[k as keyof typeof champs]);
      return { ...o, ...patch, ...(o.origine === "auto" && marks.size ? { modifie: [...marks].sort() as Son["modifie"] } : {}) };
    }),
  };
}

/** Supprime une occurrence ; un son automatique supprimé n'est pas recréé à la relance. */
export function supprimerSon(edit: Edit, id: string): Edit {
  const o = (edit.sons ?? []).find((x) => x.id === id);
  if (!o) return edit;
  const ignores = o.origine === "auto" && o.cle ? [...new Set([...(edit.sonsAutoIgnores ?? []), o.cle])] : edit.sonsAutoIgnores;
  return { ...edit, sons: (edit.sons ?? []).filter((x) => x.id !== id), ...(ignores ? { sonsAutoIgnores: ignores } : {}) };
}

/** Détache un son de son animation : il devient libre, posé là où il sonnait (même instant du fichier). */
export function detacherSon(edit: Edit, id: string, sourceAt: (outputMs: number) => number): Edit {
  const segments = layout(edit.ranges);
  const o = (edit.sons ?? []).find((x) => x.id === id);
  const info = o && sfxInfo(o.son);
  if (!o || !info || o.ancre.type === "libre") return edit;
  const t = targetMs(edit, o, segments);
  if (typeof t !== "number") return edit;
  const startOut = Math.max(0, Math.round(t + o.decalageMs - info.syncS * 1000));
  return {
    ...edit,
    sons: (edit.sons ?? []).map((x) => {
      if (x.id !== id) return x;
      const libre: Son = { id: x.id, son: x.son, lib: x.lib, ancre: { type: "libre", debutMs: Math.max(0, Math.round(sourceAt(startOut))) }, decalageMs: 0, volume: x.volume, muet: x.muet, origine: "manuel" };
      return { ...libre, ...(x.dureeMs ? { dureeMs: x.dureeMs } : {}), ...(x.fonduEntreeMs ? { fonduEntreeMs: x.fonduEntreeMs } : {}), ...(x.fonduSortieMs ? { fonduSortieMs: x.fonduSortieMs } : {}) };
    }),
  };
}

/** Nouvel identifiant d'occurrence, unique dans le montage (déterministe : plus petit numéro libre). */
export function nouvelIdSon(edit: Edit): string {
  const used = new Set((edit.sons ?? []).map((o) => o.id));
  let n = 1;
  while (used.has(`son-${n}`)) n++;
  return `son-${n}`;
}
