import { describe, expect, it } from 'vitest';
import { AUDREY_VOICE_ID, DEFAULT_VOICE_SPEED, PRONUNCIATION_VERSION, normalizeAiNarration, currentVoiceAsset } from '@/domain/social/reel-story/audrey';
import { DEMO_STORY } from '@/domain/social/reel-story/spec';
import { DEMO_MOTION } from '@/domain/social/reel-story/motion-spec';
describe('mandatory Audrey narration', () => {
  it('opens legacy drafts but normalizes only when generating', () => {
    const legacy = structuredClone(DEMO_MOTION); legacy.voice.provider = 'kokoro'; legacy.voice.voiceId = 'ff_siwis';
    expect(normalizeAiNarration(legacy).voice).toEqual({ provider: 'heygen', voiceId: AUDREY_VOICE_ID, speed: DEFAULT_VOICE_SPEED });
    expect(legacy.voice.provider).toBe('kokoro');
  });
  it('refuses music-only stories while allowing silent individual sequences', () => {
    const story = structuredClone(DEMO_STORY); Object.keys(story.voice.lines).forEach(k => { story.voice.lines[k as keyof typeof story.voice.lines] = ''; });
    expect(() => normalizeAiNarration(story)).toThrow(/narration/i);
    story.voice.lines.hook = 'Bonjour'; expect(normalizeAiNarration(story).voice.voiceId).toBe(AUDREY_VOICE_ID);
  });
  it('invalidates old voice, speed, text or pronunciation metadata', () => {
    const a = { src:'v.mp3', duration:1, text:'Bonjour', voiceId:AUDREY_VOICE_ID, speed:0.92, pronunciationVersion:PRONUNCIATION_VERSION };
    expect(currentVoiceAsset(a, 'Bonjour', .92)).toBe(true);
    for (const patch of [{speed:1}, {voiceId:'ff_siwis'}, {text:'Autre'}, {pronunciationVersion:'old'}, {duration:0}]) expect(currentVoiceAsset({...a,...patch}, 'Bonjour', .92)).toBe(false);
  });
});
