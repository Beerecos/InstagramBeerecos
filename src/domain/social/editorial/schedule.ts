import { beatMs, snapToBeat, snapToHalfBeat } from "./beat";
import { INTENSITY, ms, type Intensity } from "./tokens";
import type { EditorialScene, Storyboard } from "./schema";

/**
 * MOTEUR D'ÉVÉNEMENTS : storyboard (QUOI) → plan minuté (QUAND). Macro-événements : une scène toutes les 3 à 5 s ;
 * micro-événements : un changement visuel toutes les 350 à 650 ms (intensité 4), calés sur la grille de beats.
 * Règle « un seul héros » : les événements d'une scène se succèdent, ils ne s'empilent pas. Respiration volontaire
 * dans la scène humaine. Lisibilité : chaque scène reste à l'écran au moins le temps de lire ses mots.
 */
export type Anim = "mask" | "accent" | "counter" | "pill" | "cardIn" | "cardOut" | "rise" | "star" | "button" | "logo" | "fade";
export type SfxName = "editorialWhoosh" | "softHit" | "microPop" | "uiClick" | "cardSlide" | "cardDrop" | "digitalTick" | "softRiser" | "softDowner";
export type PlanEvent = { atMs: number; el: string; anim: Anim; durMs: number; dir?: 1 | -1 };
export type AudioEvent = { atMs: number; sfx: SfxName; gain: number; priority: number };
export type PlannedScene = { scene: EditorialScene; index: number; startMs: number; endMs: number; events: PlanEvent[]; voiceAtMs?: number; voiceMs?: number };
export type Transition = { atMs: number; kind: "wipe-lr" | "wipe-rl" | "cut"; from: EditorialScene["background"]; to: EditorialScene["background"]; durMs: number };
export type Plan = { scenes: PlannedScene[]; transitions: Transition[]; audio: AudioEvent[]; durationMs: number; bpm: number; intensity: Intensity };

/** Écart de base entre deux micro-événements selon l'intensité (milieu de la fourchette, multiple du demi-temps). */
export function baseGap(intensity: Intensity, bpm: number): number {
  const [a, b] = INTENSITY[intensity].gap;
  const half = beatMs(bpm) / 2;
  return Math.max(half, Math.round((a + b) / 2 / half) * half);
}
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
/** Temps de lecture d'un écran : 230 ms par mot, 700 ms au moins. */
export const readMs = (texts: string[]) => Math.max(700, texts.reduce((n, t) => n + words(t), 0) * 230);

const SFX_CAP = { off: 0, subtle: 8, normal: 12, impact: 14 } as const;
const SFX_GAIN = { off: 0, subtle: 0.7, normal: 1, impact: 1.25 } as const;
/** Délai entre le début du fichier son et son pic (pour faire tomber le pic sur l'instant visé). */
export const SFX_PEAK_MS: Record<SfxName, number> = { editorialWhoosh: 150, softHit: 10, microPop: 5, uiClick: 3, cardSlide: 60, cardDrop: 5, digitalTick: 2, softRiser: 1170, softDowner: 0 };

function sceneEvents(s: EditorialScene, g: number, bpm: number, audio: (at: number, sfx: SfxName, prio: number, gain?: number) => void): { events: PlanEvent[]; hold: number } {
  const ev: PlanEvent[] = [];
  const at = (t: number) => snapToHalfBeat(t, { bpm });
  const push = (t: number, el: string, anim: Anim, durMs: number, dir?: 1 | -1) => { ev.push({ atMs: at(t), el, anim, durMs, ...(dir ? { dir } : {}) }); return at(t); };
  const id = s.id;
  switch (s.type) {
    case "hook-stat": {
      let t = 0;
      if (s.lead) { push(t, `${id}-lead`, "mask", ms("fast")); t += g; }
      const c = push(t, `${id}-stat`, "counter", 1400);
      [200, 400, 800, 1200].forEach((d, i) => audio(c + d, "digitalTick", 2, i === 3 ? 1.2 : 0.8));
      audio(c + 1400, "softHit", 5);
      t = c + 1400 + Math.round(g * 0.6);
      s.lines.forEach((_, i) => { push(t, `${id}-l${i}`, "mask", ms("fast")); t += Math.round(g * 0.8); });
      if (s.accent) { push(t, `${id}-acc`, "accent", ms("fast")); t += g; }
      return { events: ev, hold: Math.max(700, readMs([s.lead ?? "", ...s.lines, s.accent ?? ""]) - (t - c)) };
    }
    case "statement": {
      let t = 0;
      s.lines.forEach((_, i) => { push(t, `${id}-l${i}`, "mask", ms("fast")); t += g; });
      if (s.accentWords.length) audio(ev[ev.length - 1].atMs + 150, "softHit", 3, 0.7);
      if (s.micro) { push(t, `${id}-micro`, "fade", ms("normal")); t += g; }
      return { events: ev, hold: Math.max(600, readMs([...s.lines, s.micro ?? ""]) - t) };
    }
    case "pills": {
      push(0, `${id}-title`, "mask", ms("fast"));
      let t = g;
      s.pills.forEach((_, i) => { const a = push(t, `${id}-p${i}`, "pill", ms("normal"), s.layout === "alternate" && i % 2 ? 1 : -1); if (i % 2 === 0) audio(a, "microPop", 1); t += g; });
      return { events: ev, hold: Math.max(700, readMs([s.title, ...s.pills]) - t) };
    }
    case "human": {
      // Scène volontairement plus lente : la respiration donne son poids à la réponse.
      let t = 0;
      s.question.forEach((_, i) => { push(t, `${id}-q${i}`, "mask", ms("fast")); t += Math.round(g * 0.8); });
      t += 400;
      const a = push(t, `${id}-ans`, "accent", ms("fast"));
      audio(a, "softHit", 4);
      t = a + 650;
      if (s.micro) { push(t, `${id}-micro`, "fade", ms("normal")); t += g; }
      return { events: ev, hold: Math.max(1200, readMs([...s.question, s.answer, s.micro ?? ""]) - t) };
    }
    case "testimonials": {
      push(0, `${id}-title`, "mask", ms("fast"));
      let t = g;
      s.cards.forEach((c, i) => {
        const dir = (i % 2 ? 1 : -1) as 1 | -1;
        const a = push(t, `${id}-c${i}`, "cardIn", ms("card"), dir);
        if (i < 3) audio(a, "cardSlide", 2);
        const stay = Math.min(1600, Math.max(900, words(c.quote) * 200));
        const last = i === s.cards.length - 1;
        if (!last || s.rating) push(a + stay, `${id}-c${i}`, "cardOut", ms("fast"), (dir * -1) as 1 | -1);
        // La carte suivante arrive avant la sortie complète de la précédente (chevauchement 150–300 ms).
        t = a + stay - 220;
      });
      if (s.rating) {
        const r = push(t + 400, `${id}-rating`, "rise", ms("card"));
        audio(r, "cardDrop", 3);
        for (let k = 0; k < 5; k++) push(r + 260 + k * 70, `${id}-star${k}`, "star", ms("micro"));
        audio(r + 260 + 5 * 70, "softHit", 4);
        t = r + 260 + 5 * 70;
      }
      return { events: ev, hold: 900 };
    }
    case "cta": {
      let t = 0;
      const gaps = [350, 300, 500];
      s.lines.forEach((_, i) => { push(t, `${id}-l${i}`, i === s.lines.length - 1 ? "accent" : "mask", ms("fast")); t += gaps[Math.min(i, gaps.length - 1)]; });
      if (s.sub) { push(t + 300, `${id}-sub`, "fade", ms("normal")); t += 800; }
      if (s.brand) { push(t, `${id}-logo`, "logo", ms("normal")); t += 400; }
      const b = push(t, `${id}-btn`, "button", ms("fast") + 34);
      audio(b, "uiClick", 3);
      // Écran complet tenu 1,5 à 2 s pour laisser le temps d'agir.
      return { events: ev, hold: 1800 };
    }
  }
}

/** Durée de la phrase d'Audrey : réelle si la voix est générée, sinon estimée (≈ 155 mots/min × débit). */
export function voiceMs(sb: Storyboard, scene: EditorialScene): number {
  if (!scene.voice?.trim()) return 0;
  const real = sb.assets?.voice[scene.id]?.duration ?? sb.voiceDurations?.[scene.id];
  if (real) return Math.round(real * 1000);
  return Math.round((words(scene.voice) / (155 / 60) / sb.voiceSpeed) * 1000) + 200;
}

export function planStoryboard(sb: Storyboard): Plan {
  const intensity = sb.intensity as Intensity, bpm = sb.bpm, g = baseGap(intensity, bpm);
  const audioRaw: AudioEvent[] = [];
  const scenes: PlannedScene[] = [];
  const transitions: Transition[] = [];
  let cursor = 0;
  sb.scenes.forEach((scene, index) => {
    const offset = index === 0 ? 0 : 150; // le contenu entre quand le wipe a franchi le centre
    const local: AudioEvent[] = [];
    const { events, hold } = sceneEvents(scene, g, bpm, (at, sfx, priority, gain = 1) => local.push({ atMs: at, sfx, priority, gain }));
    const shifted = events.map((e) => ({ ...e, atMs: e.atMs + cursor + offset }));
    // La voix d'Audrey commence avec le contenu ; la scène dure au moins le temps de sa phrase (+ un souffle).
    const vMs = voiceMs(sb, scene);
    const lastEnd = Math.max(...shifted.map((e) => e.atMs + e.durMs), cursor + offset);
    const minEnd = vMs ? cursor + offset + vMs + 250 : 0;
    const target = Math.max(lastEnd + hold, minEnd);
    // Fin de scène calée sur un temps entier (le centre du wipe tombe sur le beat), jamais avant la fin de la voix.
    let endMs = snapToBeat(target, { bpm, tolerance: beatMs(bpm) }) || target;
    if (endMs < minEnd) endMs = Math.ceil(minEnd / beatMs(bpm)) * beatMs(bpm);
    scenes.push({ scene, index, startMs: cursor, endMs: Math.max(endMs, lastEnd + 300), events: shifted, ...(vMs ? { voiceAtMs: cursor + offset, voiceMs: vMs } : {}) });
    audioRaw.push(...local.map((a) => ({ ...a, atMs: a.atMs + cursor + offset })));
    const next = sb.scenes[index + 1];
    if (next) {
      const kind = scene.transitionOut === "none" ? "cut" : scene.transitionOut;
      transitions.push({ atMs: scenes[index].endMs, kind, from: scene.background, to: next.background, durMs: kind === "cut" ? 0 : ms("transition") });
      if (kind !== "cut") audioRaw.push({ atMs: scenes[index].endMs, sfx: "editorialWhoosh", priority: 6, gain: 1 });
    }
    cursor = scenes[index].endMs;
  });
  // Sons : 8 à 14 événements au plus sur un Reel de 30 s, les plus importants d'abord ; jamais deux à moins de 120 ms.
  const cap = SFX_CAP[sb.sfx], gain = SFX_GAIN[sb.sfx];
  const kept: AudioEvent[] = [];
  for (const a of [...audioRaw].sort((x, y) => y.priority - x.priority || x.atMs - y.atMs)) {
    if (kept.length >= cap) break;
    if (kept.some((k) => Math.abs(k.atMs - a.atMs) < 120)) continue;
    kept.push({ ...a, gain: Math.round(a.gain * gain * 100) / 100 });
  }
  return { scenes, transitions, audio: kept.sort((a, b) => a.atMs - b.atMs), durationMs: cursor, bpm, intensity };
}
