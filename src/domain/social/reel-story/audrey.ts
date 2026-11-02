import { DEFAULT_VOICE_SPEED } from './pron';
import type { StorySpec, VoiceAsset } from './spec';
import type { MotionSpec } from './motion-spec';
export { DEFAULT_VOICE_SPEED } from './pron';
export const AUDREY_VOICE_ID = '7459d7aa599b4f97908600896a0e7ef4';
export const PRONUNCIATION_VERSION = 'beerecos-fr-2026-10-26-v1';
export type VoiceIdentity = { speed?: number; pronunciationVersion?: string; receiptId?: string };
export function currentVoiceAsset(a: (VoiceAsset & VoiceIdentity) | undefined, text: string, speed: number): boolean {
  return !!a && !!a.src && Number.isFinite(a.duration) && a.duration > 0 && a.text === text.trim() && a.voiceId === AUDREY_VOICE_ID && a.speed === speed && a.pronunciationVersion === PRONUNCIATION_VERSION;
}
/** Legacy drafts remain readable. Generation is an explicit Audrey-only operation. */
export function normalizeAiNarration<T extends StorySpec | MotionSpec>(spec: T): T {
  if ('kind' in spec) {
    if (!spec.scenes.some(s => s.voice.trim())) throw new Error('Narration Audrey obligatoire avant génération.');
    return { ...spec, voice: { provider: 'heygen', voiceId: AUDREY_VOICE_ID, speed: spec.voice.speed || DEFAULT_VOICE_SPEED }, assets: undefined };
  }
  if (!Object.values(spec.voice.lines).some(line => line.trim())) throw new Error('Narration Audrey obligatoire avant génération.');
  return { ...spec, voice: { ...spec.voice, voiceId: AUDREY_VOICE_ID }, assets: undefined };
}
