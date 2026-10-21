import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cmdAutocut, cmdNew, loadEdit } from '../bin/edit-video.mjs';

const project = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'edit-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), typeof content === 'string' ? content : JSON.stringify(content));
  return join(dir, 'p.edit.json');
};

test('edit.json valide : montage, transcript et fichiers référencés', () => {
  const file = project({ 'p.mp4': '', 'p.json': [{ text: ' Salut', startMs: 0, endMs: 300 }], 'p.edit.json': { video: 'p.mp4', captions: 'p.json', ranges: [{ fromMs: 0, toMs: 1000 }] } });
  const r = loadEdit(file);
  assert.equal(r.errors, undefined);
  assert.equal(r.words.length, 1);
});

test('fichier référencé absent ou JSON illisible : erreur en français', () => {
  assert.deepEqual(loadEdit(project({ 'p.edit.json': { video: 'absent.mp4', ranges: [{ fromMs: 0, toMs: 1000 }] } })).errors, ["• fichier introuvable à côté de l'edit.json : absent.mp4"]);
  assert.match(loadEdit(project({ 'p.edit.json': '{ pas du json' })).errors[0], /JSON illisible/);
});

const hasFfmpeg = (() => {
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

test('new → autocut (plan puis application avec sauvegarde)', { skip: !hasFfmpeg && 'ffmpeg absent' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'edit-'));
  const video = join(dir, 'prise.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=108x192:d=6', '-c:v', 'libx264', video]);
  assert.match(cmdNew(video), /Projet créé/);
  assert.throws(() => cmdNew(video), /existe déjà/);
  const file = join(dir, 'prise.edit.json');
  const words = [[' Je', 0, 300], [' présente', 300, 900], [' le', 900, 1000], [' réseau.', 1000, 1500], [' Je', 2500, 2800], [' présente', 2800, 3400], [' le', 3400, 3500], [' réseau', 3500, 3900], [' BeeRecos.', 3900, 4600]];
  writeFileSync(join(dir, 'prise.json'), JSON.stringify(words.map(([text, startMs, endMs]) => ({ text, startMs, endMs }))));
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), captions: 'prise.json' }));
  const plan = cmdAutocut(file);
  assert.match(plan, /✂ {3}1 .*reprise \(version gardée : 2\)/);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).ranges.length, 1, 'le plan seul n\'écrit rien');
  cmdAutocut(file, { apply: true, drop: '1' });
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).ranges, [{ fromMs: 2430, toMs: 4710 }]);
  assert.ok(existsSync(`${file}.bak-cuts`));
});
