import { SAMPLE_RATE, type Soundtrack } from "./soundtrack";
import { RHYTHM, sceneDurations, sceneStarts, sceneWords, wordTime, type MotionRhythm, type MotionSpec } from "./motion-spec";

/** Accords du film : la m7 · fa maj7 · do · sol (un par mesure, la grille se répète toutes les 4 mesures). */
const CHORDS = [[220, 261.63, 329.63, 392], [174.61, 220, 261.63, 329.63], [196, 261.63, 329.63, 392], [196, 246.94, 293.66, 392]];
const ROOTS = [110, 87.31, 130.81, 98];

/** Bruit déterministe du film (même graine → mêmes échantillons). */
function makeRnd() {
  let seed = 0xbee2026;
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Musique à l'instant t (avant ducking) : nappe, basse en croches, pied, clap sur 2 et 4, charleston. `sig` = fin allégée. */
function musicAt(t: number, rythme: MotionRhythm, sig: boolean, rnd: () => number, padGain = 1): number {
  const BEAT = 60 / RHYTHM[rythme].bpm;
  const bar = Math.floor(t / (BEAT * 4)) % 4, inBeat = t % BEAT, beatN = Math.floor(t / BEAT);
  let pad = 0;
  CHORDS[bar].forEach((f, j) => { pad += Math.sin(2 * Math.PI * f * t + j) * 0.5 + Math.sin(2 * Math.PI * f * 1.004 * t) * 0.5; });
  pad *= 0.03 * padGain;
  const bass = Math.sin(2 * Math.PI * ROOTS[bar] * t) * 0.11 * Math.exp(-(t % (BEAT / 2)) * 9);
  const kick = sig ? 0 : Math.sin(2 * Math.PI * (50 + 110 * Math.exp(-inBeat * 35)) * inBeat) * 0.3 * Math.exp(-inBeat * 11);
  const clap = !sig && beatN % 2 === 1 ? (rnd() * 2 - 1) * 0.09 * Math.exp(-inBeat * 28) : 0;
  const six = t % (BEAT / 4);
  const hat = sig || rythme === "pose" ? 0 : (rnd() * 2 - 1) * (Math.floor(t / (BEAT / 4)) % 2 ? 0.03 : 0.018) * Math.exp(-six * 90);
  return pad + bass + kick + clap + hat;
}

/** Montée avant la coupe (d = secondes restantes avant la coupe, 0 < d < 0,6). */
const riserAt = (d: number, t: number) => { const p = 1 - d / 0.6; return Math.sin(2 * Math.PI * (300 + 1500 * p * p) * t) * 0.025 * p * p; };
/** Souffle de la coupe (a = secondes depuis le début du souffle, 0 < a < 0,45) ; `st.lp` = filtre passe-bas du bruit. */
const breathAt = (a: number, st: { lp: number }, rnd: () => number) => { st.lp += (rnd() * 2 - 1 - st.lp) * (0.05 + 0.4 * (a / 0.45)); return st.lp * 0.22 * Math.sin((Math.PI * a) / 0.45); };
/** Impact grave (a = secondes depuis l'impact, 0 < a < 0,9). */
const impactAt = (a: number) => Math.sin(2 * Math.PI * (45 + 70 * Math.exp(-a * 12)) * a) * 0.38 * Math.exp(-a * 5);

const clamp = (x: number) => Math.max(-1, Math.min(1, x));
/** Même mise en stéréo que le film : effets 0,9 à gauche / 1,1 à droite, gain 0,85. */
function fxTrack(n: number, at: (i: number) => number, tail: number): Soundtrack {
  const L = new Float32Array(n), Rt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / (0.004 * SAMPLE_RATE)) * Math.min(1, (n - 1 - i) / (tail * SAMPLE_RATE));
    const fx = at(i) * fade;
    L[i] = clamp(fx * 0.9 * 0.85);
    Rt[i] = clamp(fx * 1.1 * 0.85);
  }
  return { left: L, right: Rt, sampleRate: SAMPLE_RATE };
}

/** Souffle d'appui (~0,35 s) : le souffle des coupes du film, enveloppe complète. */
export function motionWhoosh(): Soundtrack {
  const st = { lp: 0 }, rnd = makeRnd(), n = Math.round(0.35 * SAMPLE_RATE);
  return fxTrack(n, (i) => breathAt((i / SAMPLE_RATE) * (0.45 / 0.35), st, rnd), 0.02);
}

/** Impact (~0,6 s) du logo et du mot-clé : le coup grave du film. */
export function motionImpact(): Soundtrack {
  const n = Math.round(0.6 * SAMPLE_RATE);
  return fxTrack(n, (i) => impactAt(i / SAMPLE_RATE), 0.05);
}

/**
 * Boucle musicale (8 mesures exactes au tempo du rythme, sans ducking ni fade) : mêmes accords, basse et percussions
 * que le film. La nappe s'éteint 15 ms autour de chaque barre de mesure pour que la boucle se raccorde sans clic.
 */
export function motionMusicLoop(rythme: MotionRhythm): Soundtrack {
  const BAR = (60 / RHYTHM[rythme].bpm) * 4, n = Math.round(8 * BAR * SAMPLE_RATE), rnd = makeRnd();
  const L = new Float32Array(n), Rt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, loop = n / SAMPLE_RATE;
    const padGain = Math.min(1, t / 0.015, (loop - t) / 0.015);
    const v = clamp(musicAt(t, rythme, false, rnd, padGain) * 0.85);
    L[i] = v; Rt[i] = v;
  }
  return { left: L, right: Rt, sampleRate: SAMPLE_RATE };
}

/**
 * Bande son ORIGINALE du style « Motion BeeRecos - Dynamique » (synthèse déterministe, aucun morceau tiers, aucune
 * licence) : la m7 · fa maj7 · do · sol, nappe, basse en croches, pied sur chaque temps, clap sur 2 et 4, charleston,
 * montée avant chaque changement de scène, souffle sur la coupe, impacts sur le logo et sur le mot-clé du CTA,
 * ducking sous la voix, fin allégée sur la signature. Tempo selon le rythme (100 / 120 / 128 BPM).
 * `withMusic: false` → effets seuls (version « sans musique » demandée par le prompt).
 */
export function buildMotionSoundtrack(spec: MotionSpec, opts: { withMusic?: boolean } = {}): Soundtrack {
  const withMusic = opts.withMusic !== false;
  const durs = sceneDurations(spec), starts = sceneStarts(spec);
  const total = durs.reduce((n, d) => n + d, 0);
  const sr = SAMPLE_RATE, n = Math.ceil(total * sr);
  const L = new Float32Array(n), Rt = new Float32Array(n);
  const voice = spec.scenes.map((s, i) => { const w = sceneWords(spec, s); return { start: starts[i] + (w[0]?.start ?? 0), end: starts[i] + (w[w.length - 1]?.end ?? 0) }; });
  const cuts = starts.slice(1);
  const impacts: number[] = [];
  spec.scenes.forEach((s, i) => {
    const w = sceneWords(spec, s);
    if (s.visual === "marque") impacts.push(starts[i] + wordTime(w, "BeeRecos", 0.6));
    if (s.visual === "cta") impacts.push(starts[i] + wordTime(w, spec.cta.keyword, 1));
  });
  const sigFrom = spec.scenes[spec.scenes.length - 1]?.visual === "signature" ? starts[starts.length - 1]! : total;
  const rnd = makeRnd();
  const duck = (t: number) => {
    let g = 1;
    for (const w of voice) {
      const k = t < w.start ? (w.start - t) / 0.1 : t > w.end ? (t - w.end) / 0.2 : 0;
      if (k < 1) g *= 0.5 + 0.5 * Math.min(1, Math.max(0, k));
    }
    return g;
  };
  const st = { lp: 0 };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const sig = t >= sigFrom;
    const fade = Math.min(1, t / 0.4) * (t > total - 2 ? Math.max(0, (total - t) / 2) ** 1.5 : 1);
    const music = withMusic ? musicAt(t, spec.settings.rythme, sig, rnd) * duck(t) : 0;
    let fx = 0;
    for (const c of cuts) {
      const d = c - t;
      if (d > 0 && d < 0.6) fx += riserAt(d, t);
      const a = t - c + 0.08;
      if (a > 0 && a < 0.45) fx += breathAt(a, st, rnd);
    }
    for (const c of impacts) {
      const a = t - c;
      if (a > 0 && a < 0.9) fx += impactAt(a);
    }
    const g = fade * 0.85;
    L[i] = Math.max(-1, Math.min(1, (music + fx * 0.9) * g));
    Rt[i] = Math.max(-1, Math.min(1, (music + fx * 1.1) * g));
  }
  return { left: L, right: Rt, sampleRate: sr };
}
