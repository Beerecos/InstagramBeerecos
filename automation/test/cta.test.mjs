import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { matchesKeyword, verifySignature, extractComments, handleComment, personalize } from '../lib/cta.mjs';

test('mot-clé : mot entier, insensible à la casse et aux accents', () => {
  assert.ok(matchesKeyword('GUIDE stp 🙏', 'guide'));
  assert.ok(matchesKeyword('Guidé !', 'GUIDE'));
  assert.ok(matchesKeyword('je veux le mot magique', 'mot magique'));
  assert.ok(!matchesKeyword('les guides', 'guide'));
  assert.ok(!matchesKeyword('superguide', 'guide'));
  assert.ok(matchesKeyword("n'importe quoi", '*'));
});

test('signature Meta', () => {
  const body = '{"a":1}';
  const sig = 'sha256=' + createHmac('sha256', 's3cret').update(body).digest('hex');
  assert.ok(verifySignature(body, sig, 's3cret'));
  assert.ok(!verifySignature(body, sig, 'autre'));
  assert.ok(!verifySignature(body, null, 's3cret'));
  assert.ok(!verifySignature(body, 'sha256=abc', 's3cret'));
});

const payload = {
  object: 'instagram',
  entry: [{
    id: '1784',
    time: 1,
    changes: [
      { field: 'comments', value: { id: 'c1', text: 'GUIDE', from: { id: 'u1', username: 'alice' }, media: { id: 'm1' } } },
      { field: 'mentions', value: { comment_id: 'x' } },
    ],
  }],
};

test('extraction des commentaires du webhook', () => {
  assert.deepEqual(extractComments(payload), [
    { accountId: '1784', commentId: 'c1', text: 'GUIDE', fromId: 'u1', username: 'alice', mediaId: 'm1', parentId: undefined },
  ]);
});

test('personnalisation', () => {
  assert.equal(personalize('Salut {username} !', { username: 'alice' }), 'Salut @alice !');
});

function fakeDeps(overrides = {}) {
  const calls = { claims: [], sent: [], finished: [], publicReplies: [] };
  const claimed = new Set();
  const deps = {
    ownId: '1784',
    listCampaigns: async () => [
      { id: 'global', media_id: '*', keyword: 'guide', dm_text: 'global', button_title: 'B', button_url: 'https://g' },
      { id: 'k1', media_id: 'm1', keyword: 'guide', dm_text: 'Salut {username}, voici le guide', button_title: 'Accéder', button_url: 'https://x', public_reply: 'Envoyé en DM 📩' },
    ],
    claimReply: async (r) => { calls.claims.push(r); if (claimed.has(r.commentId)) return false; claimed.add(r.commentId); return true; },
    finishReply: async (id, patch) => { calls.finished.push([id, patch]); },
    sendPrivateReply: async (r) => { calls.sent.push(r); return 'button'; },
    replyToComment: async (r) => { calls.publicReplies.push(r); },
    ...overrides,
  };
  return { deps, calls };
}

test('commentaire avec mot-clé → DM bouton + réponse publique, campagne du post prioritaire', async () => {
  const { deps, calls } = fakeDeps();
  const [c] = extractComments(payload);
  const r = await handleComment(c, deps);
  assert.deepEqual(r, { sent: 'button', campaign: 'k1' });
  assert.deepEqual(calls.sent[0], { commentId: 'c1', text: 'Salut @alice, voici le guide', buttonTitle: 'Accéder', url: 'https://x' });
  assert.equal(calls.publicReplies[0].message, 'Envoyé en DM 📩');
  assert.equal(calls.finished[0][1].status, 'sent');

  // Notification renvoyée par Meta : pas de second DM.
  assert.deepEqual(await handleComment(c, deps), { skipped: 'already-handled', campaign: 'k1' });
  assert.equal(calls.sent.length, 1);
});

test('ignore ses propres commentaires et les commentaires sans mot-clé', async () => {
  const { deps, calls } = fakeDeps();
  assert.deepEqual(await handleComment({ commentId: 'c2', text: 'GUIDE', fromId: '1784', accountId: '1784', mediaId: 'm1' }, deps), { skipped: 'own-comment' });
  assert.deepEqual(await handleComment({ commentId: 'c3', text: 'trop bien', fromId: 'u2', accountId: '1784', mediaId: 'm1' }, deps), { skipped: 'no-match' });
  assert.equal(calls.sent.length, 0);
});

test("échec d'envoi journalisé", async () => {
  const { deps, calls } = fakeDeps({ sendPrivateReply: async () => { throw new Error('boom'); } });
  const r = await handleComment({ commentId: 'c4', text: 'guide', fromId: 'u3', accountId: '1784', mediaId: 'm1' }, deps);
  assert.equal(r.error, 'boom');
  assert.deepEqual(calls.finished[0], ['c4', { status: 'error', error: 'boom' }]);
});
