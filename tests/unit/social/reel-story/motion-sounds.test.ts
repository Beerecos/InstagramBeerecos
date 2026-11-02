import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEMO_MOTION, RHYTHM, SAMPLE_RATE, buildMotionSoundtrack, encodeWav, motionImpact, motionMusicLoop, motionWhoosh,
  type MotionRhythm, type Soundtrack,
} from "@/domain/social/reel-story/index";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

// These hashes pin the original film at its explicit historical speed, not the new voice default.
const ORIGINAL_FILM = { ...DEMO_MOTION, voice: { ...DEMO_MOTION.voice, speed: 1.08 } };
describe("film de présentation Motion : empreintes figées au débit historique", () => {
  it("avec musique", () => expect(sha(encodeWav(buildMotionSoundtrack(ORIGINAL_FILM)))).toBe("b69992af8a272f9e6bc4ba4ba3767f97fa4cf6286c44aae0c0337f7b9be6af33"));
  it("sans musique", () => expect(sha(encodeWav(buildMotionSoundtrack(ORIGINAL_FILM, { withMusic: false })))).toBe("325294c8f0fe9c59c765e7c388d77eb81d3cfec223679609cce87301028c0b42"));
});

const RHYTHMS = ["pose", "dynamique", "tres_dynamique"] as const satisfies readonly MotionRhythm[];
const peak = (s: Soundtrack) => { let m = 0; for (const c of [s.left, s.right]) for (const v of c) m = Math.max(m, Math.abs(v)); return m; };
const bytes = (s: Soundtrack) => encodeWav(s, { mono: true });
const FILES = {
  "appui.wav": () => motionWhoosh(),
  "impact.wav": () => motionImpact(),
  "musique-pose.wav": () => motionMusicLoop("pose"),
  "musique-dynamique.wav": () => motionMusicLoop("dynamique"),
  "musique-tres_dynamique.wav": () => motionMusicLoop("tres_dynamique"),
} as const;

describe("sons originaux du style Motion", () => {
  it("souffle d'appui ~0,35 s et impact ~0,6 s", () => {
    expect(motionWhoosh().left.length / SAMPLE_RATE).toBeCloseTo(0.35, 2);
    expect(motionImpact().left.length / SAMPLE_RATE).toBeCloseTo(0.6, 2);
  });
  for (const r of RHYTHMS) {
    it(`boucle ${r} : 8 mesures exactes au tempo du rythme`, () => {
      const s = motionMusicLoop(r);
      expect(Math.abs(s.left.length - (8 * 4 * 60 / RHYTHM[r].bpm) * SAMPLE_RATE)).toBeLessThanOrEqual(1);
      expect(s.right.length).toBe(s.left.length);
    });
    it(`boucle ${r} : se reboucle sans clic`, () => {
      const s = motionMusicLoop(r), n = s.left.length;
      expect(Math.abs(s.left[0] - s.left[n - 1])).toBeLessThan(0.05);
      expect(Math.abs(s.right[0] - s.right[n - 1])).toBeLessThan(0.05);
    });
  }
  it("crête < 0,9 et son non vide", () => {
    for (const make of Object.values(FILES)) { const p = peak(make()); expect(p).toBeLessThan(0.9); expect(p).toBeGreaterThan(0.05); }
  });
  it("déterministe : deux appels donnent les mêmes octets", () => {
    for (const make of Object.values(FILES)) expect(Buffer.from(bytes(make())).equals(Buffer.from(bytes(make())))).toBe(true);
  });
  it("les fichiers de public/hyperframes/motion/ sont à jour (npm run motion:sounds)", () => {
    for (const [name, make] of Object.entries(FILES)) {
      const path = new URL(`../../../../public/hyperframes/motion/${name}`, import.meta.url);
      expect(existsSync(path), `${name} absent`).toBe(true);
      expect(sha(readFileSync(path)), `${name} périmé`).toBe(sha(bytes(make())));
    }
  });
});
