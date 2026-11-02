import { parseEdit, type CaptionWord, type Edit, type Range, type Segment } from "./edit";
import { renderAnimation } from "./animations";
import { ANIMATIONS } from "./registry";
import { checkTimeline, MANUAL_ONLY } from "./suggest";
import { mediaErrors, type MediaRef } from "./media";
import { charteErrors } from "./charte";
import { behindErrors } from "./matte";

/**
 * STUDIO DE MONTAGE (conforme au studio du Video Agent Kit, §7 : transcript cliquable, timeline, annuler/refaire,
 * enregistrement validé). Couche PURE partagée par la page Montage et la fonction serveur `montage` : tous les temps
 * restent en millisecondes de la prise (règle d'or d'edit.json).
 */

/** Profondeur de l'historique annuler / refaire (comme les sauvegardes .bak du kit, bornées). */
export const HISTORY_DEPTH = 30;

/** Retire [fromMs, toMs) des morceaux gardés (coupe sèche, morceaux trop courts < 40 ms supprimés). */
export function cutSource(ranges: Range[], fromMs: number, toMs: number): Range[] {
  if (toMs <= fromMs) return ranges;
  const out: Range[] = [];
  for (const r of ranges) {
    if (toMs <= r.fromMs || fromMs >= r.toMs) { out.push(r); continue; }
    if (fromMs > r.fromMs) out.push({ fromMs: r.fromMs, toMs: fromMs });
    if (toMs < r.toMs) out.push({ fromMs: toMs, toMs: r.toMs });
  }
  return out.filter((r) => r.toMs - r.fromMs >= 40);
}

/** Remet [fromMs, toMs) dans les morceaux gardés (fusionne les morceaux qui se touchent), borné à la prise. */
export function restoreSource(ranges: Range[], fromMs: number, toMs: number, durationMs?: number): Range[] {
  const end = durationMs ?? Number.POSITIVE_INFINITY;
  const add = { fromMs: Math.max(0, Math.round(fromMs)), toMs: Math.min(end, Math.round(toMs)) };
  if (add.toMs <= add.fromMs) return ranges;
  const all = [...ranges, add].sort((a, b) => a.fromMs - b.fromMs);
  const out: Range[] = [];
  for (const r of all) {
    const last = out[out.length - 1];
    if (last && r.fromMs <= last.toMs) last.toMs = Math.max(last.toMs, r.toMs);
    else out.push({ ...r });
  }
  return out;
}

/** Portée d'une sélection de mots [i, j] : du début du premier mot au début du mot suivant (le blanc part avec). */
export function wordSpan(words: CaptionWord[], i: number, j: number): Range {
  const [a, b] = i <= j ? [i, j] : [j, i];
  const next = words[b + 1];
  return { fromMs: words[a].startMs, toMs: next ? next.startMs : words[b].endMs };
}

/** Un mot est gardé si son milieu tombe dans un morceau (même règle que les sous-titres). */
export function isWordKept(ranges: Range[], w: CaptionWord): boolean {
  const mid = (w.startMs + w.endMs) / 2;
  return ranges.some((r) => mid >= r.fromMs && mid < r.toMs);
}

/** Temps du montage → temps de la prise (inverse de toOutputMs) : sert au curseur de lecture et au transcript. */
export function outputToSourceMs(segments: Segment[], outMs: number): number {
  for (const s of segments) {
    const len = s.toMs - s.fromMs;
    if (outMs < s.atMs + len) return s.fromMs + Math.max(0, outMs - s.atMs);
  }
  const last = segments[segments.length - 1];
  return last ? last.toMs : 0;
}

/** Ajoute un état à une pile d'historique bornée (le plus récent en dernier). */
export function pushHistory(stack: Edit[] | null | undefined, edit: Edit, depth = HISTORY_DEPTH): Edit[] {
  return [...(stack ?? []), edit].slice(-depth);
}

/**
 * Contrôle d'un edit.json enregistré depuis le Studio : schéma strict + cohérence, même prise, morceaux dans la
 * durée de la prise, chaque animation rendue sans erreur, pas de chevauchement de deux animations de même zone, sons et
 * images pris dans la bibliothèque (lot S3), charte BeeRecos (nom de marque, baseline exacte), titre derrière le sujet
 * seulement sur une prise détourée (lot S5).
 */
export function checkStudioEdit(input: unknown, current: Edit, durationMs: number | null, library: MediaRef[] = []): { ok: true; edit: Edit } | { ok: false; errors: string[] } {
  const parsed = parseEdit(input);
  if (!parsed.ok) return parsed;
  const edit = parsed.edit;
  const errors: string[] = [];
  if (edit.video !== current.video) errors.push("• video → la prise d'un montage ne change pas (créez un nouveau montage)");
  if (JSON.stringify(edit.takes ?? null) !== JSON.stringify(current.takes ?? null)) errors.push("• takes → les prises d'un montage ne changent pas depuis le Studio (ajoutez-les avant la transcription)");
  if (JSON.stringify(edit.mattes ?? null) !== JSON.stringify(current.mattes ?? null)) errors.push("• mattes → les détourages s'envoient et se retirent depuis la carte Prises");
  if (edit.captions !== current.captions) errors.push("• captions → le transcript lié au montage ne change pas");
  const last = edit.ranges[edit.ranges.length - 1];
  if (durationMs && last.toMs > durationMs) errors.push(`• ranges → le dernier morceau finit après la prise (${last.toMs} > ${durationMs} ms)`);
  if (edit.sounds.length > 30) errors.push("• sounds → 30 sons au plus");
  for (const name of edit.animationChoices ?? []) {
    if (!Object.prototype.hasOwnProperty.call(ANIMATIONS, name) || MANUAL_ONLY.has(name)) errors.push(`• animationChoices → « ${name} » ne fait pas partie du catalogue proposé par Bee`);
  }
  errors.push(...mediaErrors(edit, library));
  errors.push(...charteErrors(edit));
  if (edit.custom.length > 30) errors.push("• custom → 30 animations au plus");
  edit.custom.forEach((c, i) => {
    const out = renderAnimation(c.name, c.props, { id: "zz9", start: 0, duration: Math.max(0.1, (c.toMs - c.fromMs) / 1000), accent: "#2851FF" }, ANIMATIONS);
    if (out.error) errors.push(`• custom[${i}] → ${out.error}`);
  });
  errors.push(...checkTimeline(edit.custom));
  errors.push(...behindErrors(edit, ANIMATIONS));
  return errors.length ? { ok: false, errors } : { ok: true, edit };
}

/** Corrections de texte du transcript (sous-titres éditables) : le minutage ne change jamais. */
export function applyWordFixes(words: CaptionWord[], fixes: unknown): { ok: true; words: CaptionWord[] } | { ok: false; error: string } {
  if (!Array.isArray(fixes) || !fixes.length || fixes.length > 200) return { ok: false, error: "Corrections invalides (1 à 200)." };
  const next = words.map((w) => ({ ...w }));
  for (const f of fixes) {
    const i = (f as { i?: unknown })?.i;
    const text = (f as { text?: unknown })?.text;
    if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= words.length) return { ok: false, error: "Mot introuvable dans le transcript." };
    if (typeof text !== "string") return { ok: false, error: "Texte de correction invalide." };
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 40) return { ok: false, error: "Un mot corrigé fait de 1 à 40 caractères (pour retirer un mot, coupez-le)." };
    // On garde l'espace de tête du mot d'origine (ElevenLabs colle la ponctuation et l'espace au mot).
    const lead = /^\s/.test(words[i as number].text) ? " " : "";
    next[i as number].text = lead + clean;
  }
  return { ok: true, words: next };
}
