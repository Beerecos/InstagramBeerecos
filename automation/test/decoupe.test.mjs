import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPlan, clock, parseSilences, planSplit, segmentName } from '../lib/decoupe.mjs';
import { cmdSplit } from '../bin/edit-video.mjs';

const sil = (a, b) => ({ startMs: a * 1000, endMs: b * 1000 });

test('silences ffmpeg : début, fin, et silence qui court jusqu\'à la fin du fichier', () => {
  const log = '[silencedetect @ 0x1] silence_start: -0.01\n[silencedetect @ 0x1] silence_end: 1.5 | silence_duration: 1.51\nsilence_start: 30.25\nsilence_end: 34.75 | silence_duration: 4.5\nsilence_start: 58\n';
  assert.deepEqual(parseSilences(log, 60000), [sil(0, 1.5), { startMs: 30250, endMs: 34750 }, sil(58, 60)]);
});

test('plan : les pauses les plus longues séparent les Reels annoncés, silences de tête et de queue retirés', () => {
  const silences = [sil(0, 2), sil(20, 21.6), sil(40, 46), sil(70, 71.5), sil(90, 95), sil(118, 120)];
  const { segments, warnings } = planSplit(silences, 120000, { expected: 3 });
  assert.deepEqual(segments.map(({ fromMs, toMs }) => [fromMs, toMs]), [[1600, 40400], [45600, 90400], [94600, 118400]]);
  assert.deepEqual(warnings, []);
  // Sans nombre annoncé : chaque pause détectée coupe.
  assert.equal(planSplit(silences, 120000).segments.length, 5);
});

test('plan : jamais de morceau plus court que 8 s, écart signalé avec le nombre annoncé', () => {
  const { segments, warnings } = planSplit([sil(10, 15), sil(13.5, 14)], 30000, { expected: 4 });
  assert.equal(segments.length, 2);
  assert.match(warnings[0], /2 Reels trouvés pour 4 annoncés/);
  assert.match(planSplit([], 200000).warnings[0], /plus de 3 min/);
});

test('plan relu à la main : contrôle en français, nom de fichier sans accent', () => {
  assert.deepEqual(checkPlan({ segments: [{ fromMs: 0, toMs: 5000 }, { fromMs: 4000, toMs: 4500 }] }, 10000), ['• segments[1] → moins d\'1 s (4000 → 4500)', '• segments[1] → commence avant la fin du Reel précédent']);
  assert.deepEqual(checkPlan({ segments: [] }), ['• segments → au moins un Reel attendu']);
  assert.equal(segmentName({ n: 7, titre: 'Le réseau, c\'est TON réseau !' }), 'reel-07-le-reseau-c-est-ton-reseau.mp4');
  assert.equal(segmentName({ n: 7 }, 3), 'reel-007.mp4');
  assert.equal(clock(3723400), '1:02:03.4');
});

const hasFfmpeg = (() => {
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

test('split : plan écrit sans rien couper, puis --apply coupe un fichier par Reel', { skip: !hasFfmpeg && 'ffmpeg absent' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'split-'));
  const source = join(dir, 'session.mp4');
  // 3 « Reels » de 10 s de son séparés par 3 s de silence.
  const tone = 'sine=f=440:d=10', gap = 'anullsrc=r=44100:cl=mono:d=3';
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=108x192:d=36:r=10', '-f', 'lavfi', '-i', tone, '-f', 'lavfi', '-i', gap, '-f', 'lavfi', '-i', tone, '-f', 'lavfi', '-i', gap, '-f', 'lavfi', '-i', tone,
    '-filter_complex', '[1]aformat=channel_layouts=mono:sample_rates=44100[a1];[3]aformat=channel_layouts=mono:sample_rates=44100[a3];[5]aformat=channel_layouts=mono:sample_rates=44100[a5];[a1][2][a3][4][a5]concat=n=5:v=0:a=1[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-g', '10', '-c:a', 'aac', '-shortest', source]);
  const plan = cmdSplit(source, { expected: 3 });
  assert.match(plan, /3 Reel\(s\)/);
  assert.equal(readdirSync(dir).some((f) => f.endsWith('-reels')), false, 'le plan seul ne coupe rien');
  assert.throws(() => cmdSplit(source, { expected: 3 }), /existe déjà/);
  const file = join(dir, 'session.decoupe.json');
  const edited = JSON.parse(readFileSync(file, 'utf8'));
  edited.segments[0].titre = 'Réseau';
  writeFileSync(file, JSON.stringify(edited));
  assert.match(cmdSplit(source, { apply: true }), /3 Reel\(s\)/);
  assert.deepEqual(readdirSync(join(dir, 'session-reels')).sort(), ['reel-01-reseau.mp4', 'reel-02.mp4', 'reel-03.mp4']);
  assert.ok(existsSync(join(dir, 'session-reels', 'reel-02.mp4')));
});
