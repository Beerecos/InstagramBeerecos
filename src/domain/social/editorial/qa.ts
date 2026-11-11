import { INNER_W, MASCOT_RESERVE, textEm } from "./render";
import type { Plan } from "./schedule";
import type { EditorialScene, Storyboard } from "./schema";
import { SAFE, H } from "./tokens";
import { END_VIDEO } from "../montage/brand";

/**
 * QA AUTOMATIQUE avant rendu : contrôles mesurés (oui/non), pas d'avis. Une erreur bloque le rendu ; un avertissement
 * s'affiche sur la carte de la scène concernée. Mesures : largeur réelle Poppins 800 (table render.ts), hauteur de
 * la zone utile (zones de sécurité Instagram), temps de lecture, rythme des micro-événements, nombre de sons.
 */
export type QaIssue = { level: "error" | "warning"; code: string; sceneId?: string; message: string };

const MIN_SIZE = 56; // en dessous, le texte n'est plus « éditorial » sur un téléphone
const USABLE_H = H - SAFE.top - SAFE.bottom;

const texts = (s: EditorialScene): string[] => {
  switch (s.type) {
    case "hook-stat": return [s.lead ?? "", ...s.lines, s.accent ?? ""].filter(Boolean);
    case "statement": return s.lines;
    case "impact": return [s.word];
    case "strike": return [s.lead ?? "", s.before, s.after].filter(Boolean);
    case "pills": return [s.title];
    case "human": return [...s.question, s.answer];
    case "testimonials": return [s.title];
    case "cta": return s.lines;
  }
};

/** Taille que prendrait la ligne pour tenir dans la largeur utile (sans plafond). */
const sizeFor = (t: string) => Math.floor((INNER_W * 0.97) / Math.max(textEm(t), 1.5));

/** Hauteur estimée du contenu d'une scène (lignes à leur taille plafonnée, capsules, micro-texte, bouton). */
function contentHeight(s: EditorialScene): number {
  const line = (t: string, max: number) => Math.min(max, sizeFor(t)) * 1.0;
  switch (s.type) {
    case "hook-stat": return texts(s).reduce((h, t) => h + line(t, 120), 0) + 380;
    case "statement": return s.lines.reduce((h, t) => h + line(t, 150), 0) + (s.micro ? 110 : 0);
    case "impact": return line(s.word, 400) + (s.sub ? 110 : 0);
    case "strike": return texts(s).reduce((h, t) => h + line(t, 150), 0) + (s.micro ? 110 : 0);
    case "pills": return line(s.title, 116) + 40 + s.pills.length * (56 * 1.1 + 48 + 22);
    case "human": return [...s.question, s.answer].reduce((h, t) => h + line(t, 150), 0) + (s.micro ? 110 : 0);
    case "testimonials": return line(s.title, 104) + 40 + 640;
    case "cta": return s.lines.reduce((h, t) => h + line(t, 150), 0) + (s.sub ? 110 : 0) + (s.brand ? 280 : 0) + 156;
  }
}

export function qaStoryboard(sb: Storyboard, plan: Plan): QaIssue[] {
  const out: QaIssue[] = [];
  const add = (level: QaIssue["level"], code: string, message: string, sceneId?: string) => out.push({ level, code, message, ...(sceneId ? { sceneId } : {}) });

  // 1. Débordement : une ligne qui ne tient qu'en dessous de la taille minimale est trop longue.
  for (const s of sb.scenes) for (const t of texts(s)) if (sizeFor(t) < MIN_SIZE) add("error", "overflow", `« ${t} » est trop long pour une ligne : coupe-le en deux.`, s.id);
  // 2. Zones de sécurité : le contenu doit tenir entre le haut (230 px) et la barre Instagram (360 px).
  // Avec la mascotte, le texte lui laisse sa place en bas.
  const usable = USABLE_H - (sb.mascot ? MASCOT_RESERVE : 0);
  for (const s of sb.scenes) if (contentHeight(s) > usable) add("error", "safe-zone", sb.mascot ? "Trop de contenu avec la mascotte : retire une ligne ou une capsule." : "Trop de contenu pour la zone visible : retire une ligne ou une capsule.", s.id);
  // 3. Densité : chaque scène reste à l'écran le temps de lire ses mots.
  for (const p of plan.scenes) {
    const words = texts(p.scene).join(" ").split(/\s+/).filter(Boolean).length;
    if (p.endMs - p.startMs < words * 200) add("warning", "density", "Scène trop dense pour le temps disponible : raccourcis le texte.", p.scene.id);
    if (p.endMs - p.startMs > 6000) add("warning", "slow", "Scène longue (plus de 6 s) : le rythme retombe.", p.scene.id);
  }
  // 4. Sur-animation : deux micro-événements à moins de 250 ms dans une même scène (étoiles et compteur exceptés).
  for (const p of plan.scenes) {
    const ev = p.events.filter((e) => e.anim !== "star" && e.anim !== "cardOut").map((e) => e.atMs).sort((a, b) => a - b);
    for (let i = 1; i < ev.length; i++) if (ev[i] - ev[i - 1] < 250) { add("warning", "overanimation", "Animations trop rapprochées : un seul élément à la fois.", p.scene.id); break; }
  }
  // 5. Audio : 14 sons au plus, jamais deux sons à moins de 120 ms.
  if (plan.audio.length > 14) add("error", "sfx-count", `${plan.audio.length} effets sonores : 14 au plus.`);
  const at = plan.audio.map((a) => a.atMs).sort((a, b) => a - b);
  for (let i = 1; i < at.length; i++) if (at[i] - at[i - 1] < 120) { add("warning", "sfx-spacing", "Deux sons presque simultanés."); break; }
  // 6. Répétition : une même ligne dans deux scènes ; trois fonds identiques à la suite.
  const seen = new Map<string, string>();
  for (const s of sb.scenes) for (const t of texts(s)) {
    const k = t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (k.length > 3 && seen.has(k) && seen.get(k) !== s.id) add("warning", "duplicate", `« ${t} » est répété.`, s.id);
    seen.set(k, s.id);
  }
  sb.scenes.forEach((s, i) => { if (i >= 2 && sb.scenes[i - 1].background === s.background && sb.scenes[i - 2].background === s.background) add("warning", "background", "Trois fonds identiques à la suite : alterne.", s.id); });
  // 7. Fin : un appel à l'action en dernière scène, tenu au moins 1,5 s une fois complet.
  const last = plan.scenes[plan.scenes.length - 1];
  if (!last || last.scene.type !== "cta") add("error", "cta", "La dernière scène doit être l'appel à l'action.");
  else {
    const built = Math.max(...last.events.map((e) => e.atMs + e.durMs));
    if (last.endMs - built < 1500) add("warning", "cta-hold", "L'appel à l'action n'est pas tenu assez longtemps.", last.scene.id);
  }
  // 8. Réel générique : BeeRecos n'apparaît qu'à la fin (dernière scène).
  sb.scenes.slice(0, -1).forEach((s) => {
    const all = [...texts(s), s.voice ?? "", "micro" in s ? s.micro ?? "" : ""].join(" ");
    if (/bee\s?recos/i.test(all)) add("warning", "brand-early", "BeeRecos apparaît avant la fin : le Réel reste générique, BeeRecos arrive dans l'appel à l'action.", s.id);
  });
  // 9. Durée totale d'un Reel éditorial.
  // Réel IA : environ 30 s de contenu, puis la vidéo de fin BeeRecos (7,8 s) en plus.
  if (plan.durationMs > 36000) add("warning", "duration", `${Math.round(plan.durationMs / 1000)} s de contenu (+ ${END_VIDEO.durationMs / 1000} s de vidéo de fin) : vise environ 30 s (raccourcis les phrases d'Audrey).`);
  return out;
}
