import type { StorySpec } from "./spec";
import { storyBeats, type Cue } from "./timeline";

/**
 * Bande son ORIGINALE synthétisée par le code (aucun morceau tiers, aucune licence à vérifier) :
 * ambiance électronique sobre à 120 BPM calée sur les séquences, suspension totale sur la rupture,
 * impact au retour, effets (carte qui glisse, validation, étapes, saisie du mot-clé) et ducking sous la voix.
 * Déterministe : même spec → mêmes échantillons, dans le navigateur (aperçu) comme sur le serveur (rendu).
 */

export const SAMPLE_RATE = 44100;
const BPM = 120;
const BEAT = 60 / BPM;

/** Accords (fréquences en Hz) : la mineur 7, fa majeur 7, do majeur, sol (un accord par mesure de 2 s). */
const CHORDS = [
  [220, 261.63, 329.63, 392],
  [174.61, 220, 261.63, 329.63],
  [196, 261.63, 329.63, 392],
  [196, 246.94, 293.66, 392],
];
const ROOTS = [110, 87.31, 130.81, 98];

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Soundtrack = { left: Float32Array; right: Float32Array; sampleRate: number };
export type VoiceWindow = { start: number; end: number };

export function buildSoundtrack(spec: StorySpec, voice: VoiceWindow[] = []): Soundtrack {
  const b = storyBeats(spec);
  const sr = SAMPLE_RATE;
  const n = Math.ceil(b.total * sr);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const rnd = mulberry32(0xbee2026);

  const silentFrom = b.start.rupture;
  const silentTo = b.start.value;
  const sigFrom = b.start.signature;
  const fadeFrom = b.total - 1.4;

  // Gain de la musique : suspension sur la rupture, plus doux sur la signature, ducking sous la voix, fondu final.
  const musicGain = (t: number) => {
    if (t >= silentFrom - 0.03 && t < silentTo) return 0;
    let g = 1;
    if (t > silentFrom - 0.25 && t < silentFrom) g *= (silentFrom - t) / 0.25;
    if (t > fadeFrom) g *= Math.max(0, (b.total - t) / 1.4) ** 1.5;
    for (const w of voice) {
      const k = t < w.start ? (w.start - t) / 0.08 : t > w.end ? (t - w.end) / 0.15 : 0;
      if (k < 1) g *= 0.42 + 0.58 * Math.min(1, Math.max(0, k));
    }
    return g;
  };
  const drums = (t: number) => !(t >= sigFrom && t < b.start.cta);

  // Pad : deux dents de scie désaccordées par note, filtre passe-bas à un pôle, enveloppe par mesure.
  let lpL = 0, lpR = 0;
  const phase = new Float64Array(16);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const bar = Math.floor(t / (BEAT * 4)) % 4;
    const inBar = t % (BEAT * 4);
    const env = Math.min(1, inBar / 0.08) * (0.75 + 0.25 * Math.cos((inBar / (BEAT * 4)) * Math.PI));
    let l = 0, r = 0;
    CHORDS[bar].forEach((f, j) => {
      for (const [k, det] of [[0, 0.997], [1, 1.003]] as const) {
        const idx = j * 2 + k;
        phase[idx] = (phase[idx] + (f * det) / sr) % 1;
        const v = phase[idx] * 2 - 1;
        if (k === 0) l += v; else r += v;
      }
    });
    lpL += 0.08 * (l - lpL);
    lpR += 0.08 * (r - lpR);
    const g = musicGain(t) * env * 0.05;
    L[i] += lpL * g;
    R[i] += lpR * g;
  }

  // Basse (croches) + kick (noires) + charleston (contretemps).
  const addHit = (at: number, len: number, fn: (dt: number) => number, gain: number, pan = 0) => {
    const s0 = Math.floor(at * sr);
    const s1 = Math.min(n, s0 + Math.floor(len * sr));
    for (let i = Math.max(0, s0); i < s1; i++) {
      const v = fn((i - s0) / sr) * gain;
      L[i] += v * (1 - pan);
      R[i] += v * (1 + pan);
    }
  };
  for (let t = 0; t < b.total - 0.05; t += BEAT / 2) {
    const g = musicGain(t);
    if (g <= 0.001) continue;
    const bar = Math.floor(t / (BEAT * 4)) % 4;
    const f = ROOTS[bar];
    addHit(t, 0.22, (dt) => Math.tanh(1.6 * Math.sin(2 * Math.PI * f * dt)) * Math.exp(-dt * 14), 0.11 * g);
    const onBeat = Math.abs(t / BEAT - Math.round(t / BEAT)) < 1e-6;
    if (drums(t) && onBeat) {
      addHit(t, 0.3, (dt) => Math.sin(2 * Math.PI * (45 * dt + (75 / 18) * (1 - Math.exp(-dt * 18)))) * Math.exp(-dt * 11), 0.32 * g);
    }
    if (drums(t) && !onBeat) {
      let prev = 0;
      addHit(t, 0.05, (dt) => { const w = rnd() * 2 - 1; const hp = w - prev; prev = w; return hp * Math.exp(-dt * 90); }, 0.035 * g, 0.3);
    }
  }

  for (const cue of b.cues) addCue(cue, addHit, rnd);

  // Fin propre : dernier accord tenu qui s'éteint avec la vidéo.
  const last = b.total - 1.4;
  CHORDS[0].forEach((f, j) => addHit(last, 1.38, (dt) => Math.sin(2 * Math.PI * f * dt) * Math.exp(-dt * 2.2) * Math.min(1, (1.38 - dt) / 0.2), 0.025, j % 2 ? 0.2 : -0.2));

  // Saturation douce puis normalisation à −1 dBFS crête.
  let peak = 0;
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh(L[i] * 1.2);
    R[i] = Math.tanh(R[i] * 1.2);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const norm = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < n; i++) { L[i] *= norm; R[i] *= norm; }
  // Fondu d'entrée de 5 ms : pas de clic au premier échantillon.
  for (let i = 0; i < Math.min(n, 220); i++) { const k = i / 220; L[i] *= k; R[i] *= k; }
  return { left: L, right: R, sampleRate: sr };
}

type AddHit = (at: number, len: number, fn: (dt: number) => number, gain: number, pan?: number) => void;

function addCue(cue: Cue, addHit: AddHit, rnd: () => number) {
  const t = cue.t;
  if (cue.kind === "whoosh") {
    // Souffle filtré qui monte puis retombe (déplacement de la carte).
    let lp = 0;
    addHit(t - 0.06, 0.3, (dt) => {
      const x = dt / 0.3;
      lp += (0.04 + 0.25 * Math.sin(Math.PI * x)) * ((rnd() * 2 - 1) - lp);
      return lp * Math.sin(Math.PI * x) ** 2;
    }, 0.22, -0.15);
  } else if (cue.kind === "ding") {
    addHit(t, 0.45, (dt) => Math.sin(2 * Math.PI * 1318.5 * dt) * Math.exp(-dt * 9), 0.07, 0.1);
    addHit(t + 0.08, 0.5, (dt) => Math.sin(2 * Math.PI * 1975.5 * dt) * Math.exp(-dt * 8), 0.06, -0.1);
  } else if (cue.kind === "pop") {
    addHit(t, 0.1, (dt) => Math.sin(2 * Math.PI * (880 - 2200 * dt) * dt) * Math.exp(-dt * 40), 0.12);
  } else if (cue.kind === "type") {
    let prev = 0;
    addHit(t, 0.03, (dt) => { const w = rnd() * 2 - 1; const hp = w - prev; prev = w; return (hp * 0.6 + Math.sin(2 * Math.PI * 2100 * dt)) * Math.exp(-dt * 160); }, 0.12, 0.05);
  } else if (cue.kind === "impact") {
    addHit(t, 0.6, (dt) => Math.sin(2 * Math.PI * (40 * dt + 4 * (1 - Math.exp(-dt * 12)))) * Math.exp(-dt * 6), 0.45);
    let lp = 0;
    addHit(t, 0.5, (dt) => { lp += 0.12 * ((rnd() * 2 - 1) - lp); return lp * Math.exp(-dt * 9); }, 0.25);
  } else if (cue.kind === "thud") {
    addHit(t, 0.7, (dt) => Math.sin(2 * Math.PI * 52 * dt) * Math.exp(-dt * 5), 0.3);
  }
}

/** Encode en WAV PCM 16 bits stéréo. */
export function encodeWav(s: Soundtrack, opts: { mono?: boolean } = {}): Uint8Array {
  const n = s.left.length, ch = opts.mono ? 1 : 2, w = ch * 2;
  const buf = new ArrayBuffer(44 + n * w);
  const v = new DataView(buf);
  const str = (o: number, x: string) => [...x].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n * w, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, s.sampleRate, true);
  v.setUint32(28, s.sampleRate * w, true); v.setUint16(32, w, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * w, true);
  for (let i = 0, o = 44; i < n; i++, o += w) {
    if (opts.mono) { v.setInt16(o, Math.max(-1, Math.min(1, (s.left[i] + s.right[i]) / 2)) * 32767, true); continue; }
    v.setInt16(o, Math.max(-1, Math.min(1, s.left[i])) * 32767, true);
    v.setInt16(o + 2, Math.max(-1, Math.min(1, s.right[i])) * 32767, true);
  }
  return new Uint8Array(buf);
}
