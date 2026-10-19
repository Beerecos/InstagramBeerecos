#!/usr/bin/env node
// Voix off IA : ElevenLabs (qualité studio, voix FR naturelles) si la clé est présente,
// sinon synthèse locale Hyperframes (Kokoro, voix française ff_siwis).
// Usage : voice.mjs --text script.txt --out voix.mp3 [--voice <voice_id>] [--engine elevenlabs|local]
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { env } from '../lib/env.mjs';

const { values: o } = parseArgs({
  options: {
    text: { type: 'string' },
    out: { type: 'string' },
    voice: { type: 'string' },
    engine: { type: 'string' },
    speed: { type: 'string' },
  },
});

async function main() {
  if (!o.text || !o.out) throw new Error('Usage : voice.mjs --text script.txt --out voix.mp3 [--voice id] [--engine elevenlabs|local]');
  const text = existsSync(o.text) ? (await readFile(o.text, 'utf8')).trim() : o.text;
  const key = env('ELEVENLABS_API_KEY', '');
  const engine = o.engine || (key ? 'elevenlabs' : 'local');

  if (engine === 'elevenlabs') {
    if (!key) throw new Error('ELEVENLABS_API_KEY absente');
    const voiceId = o.voice || env('ELEVENLABS_VOICE_ID');
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: env('ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2'),
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, speed: Number(o.speed || 1) },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs : ${res.status} ${await res.text()}`);
    await writeFile(o.out, Buffer.from(await res.arrayBuffer()));
  } else {
    const wav = o.out.replace(/\.[^.]+$/, '') + '.wav';
    execFileSync('npx', ['--yes', 'hyperframes', 'tts', '--voice', o.voice || 'ff_siwis', '--speed', o.speed || '1', '--output', wav, text], { stdio: 'inherit' });
    if (wav !== o.out) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, o.out], { stdio: 'inherit' });
  }
  console.log(o.out);
}

main().catch((err) => {
  console.error(`Erreur : ${err.message}`);
  process.exitCode = 1;
});
