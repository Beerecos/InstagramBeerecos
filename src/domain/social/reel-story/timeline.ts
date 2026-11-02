import { round, sequenceStarts, totalDuration, type SequenceKey, type StorySpec } from "./spec";

/**
 * Les temps forts du montage, calculés une seule fois à partir des durées du template.
 * La composition (images) et la bande son (effets, coupure, ducking) lisent les MÊMES valeurs :
 * un effet sonore tombe toujours sur le mouvement qu'il accompagne.
 */

export type CueKind = "whoosh" | "ding" | "pop" | "type" | "impact" | "thud";
export type Cue = { t: number; kind: CueKind };

export type Beats = {
  start: Record<SequenceKey, number>;
  duration: Record<SequenceKey, number>;
  total: number;
  hook: { cardIn: number; travel: number; exit: number };
  consequence: { wipe: number; doc: number; signed: number; exit: number };
  rupture: { toi: number };
  value: { lines: number; nodes: number; link1: number; link2: number; pulse: number; exit: number };
  steps: number[];
  stepLength: number;
  signature: { wipe: number; logo: number; tagline: number };
  cta: { logoMove: number; verb: number; field: number; typing: number[]; complement: number; stable: number };
  /** Départ de chaque phrase de voix off. */
  voiceAt: Record<SequenceKey, number>;
  cues: Cue[];
};

export function storyBeats(spec: StorySpec): Beats {
  const s = sequenceStarts(spec);
  const d = spec.durations;
  const end = (k: SequenceKey) => s[k] + d[k];
  const stepLength = round(d.steps / 3);
  const steps = [0, 1, 2].map((i) => round(s.steps + i * stepLength));
  const typingStart = round(s.cta + 0.5);
  const typing = [...spec.cta.keyword].map((_, i) => round(typingStart + i * 0.12));

  const b: Beats = {
    start: s,
    duration: d,
    total: totalDuration(spec),
    hook: { cardIn: 0.12, travel: round(Math.min(0.85, d.hook - 1.05)), exit: round(end("hook") - 0.22) },
    consequence: { wipe: s.consequence, doc: round(s.consequence + 0.3), signed: round(s.consequence + 0.62), exit: round(end("consequence") - 0.2) },
    rupture: { toi: round(s.rupture + Math.min(0.45, d.rupture * 0.3)) },
    value: {
      lines: s.value, nodes: round(s.value + 0.35), link1: round(s.value + 0.6), link2: round(s.value + 0.9),
      pulse: round(s.value + 1.2), exit: round(end("value") - 0.22),
    },
    steps,
    stepLength,
    signature: { wipe: s.signature, logo: round(s.signature + 0.1), tagline: round(s.signature + 0.35) },
    cta: {
      logoMove: s.cta, verb: round(s.cta + 0.12), field: round(s.cta + 0.3), typing,
      complement: round((typing[typing.length - 1] ?? typingStart) + 0.3), stable: round((typing[typing.length - 1] ?? typingStart) + 0.55),
    },
    voiceAt: {
      hook: 0.15, consequence: round(s.consequence + 0.1), rupture: round(s.rupture + 0.12), value: round(s.value + 0.12),
      steps: round(s.steps + 0.08), signature: round(s.signature + 0.15), cta: round(s.cta + 0.2),
    },
    cues: [],
  };
  b.cues = [
    { t: b.hook.cardIn, kind: "whoosh" },
    { t: b.hook.travel, kind: "whoosh" },
    { t: b.consequence.wipe, kind: "whoosh" },
    { t: b.consequence.signed, kind: "ding" },
    { t: s.rupture, kind: "thud" },
    { t: s.value, kind: "impact" },
    { t: b.value.pulse, kind: "whoosh" },
    ...steps.map((t) => ({ t: round(t + 0.12), kind: "pop" as const })),
    { t: round(steps[2] + 0.42), kind: "ding" },
    { t: b.signature.wipe, kind: "whoosh" },
    ...typing.map((t) => ({ t, kind: "type" as const })),
  ];
  return b;
}

/** Fenêtre disponible pour la phrase de voix d'une séquence (jusqu'au départ de la phrase suivante). */
export function voiceWindow(spec: StorySpec, key: SequenceKey): number {
  const b = storyBeats(spec);
  const keys = Object.keys(b.voiceAt) as SequenceKey[];
  const next = keys[keys.indexOf(key) + 1];
  return round((next ? b.voiceAt[next] : b.total - 0.3) - b.voiceAt[key] - 0.08);
}
