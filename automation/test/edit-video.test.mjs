import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEdit } from '../bin/edit-video.mjs';

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
