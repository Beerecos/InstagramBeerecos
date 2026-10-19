import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { publishReel, sendPrivateReply } from '../lib/instagram.mjs';

const cfg = { host: 'graph.instagram.com', version: 'v26.0', userId: '1784', token: 'T' };
const realFetch = globalThis.fetch;
let requests;

function mockFetch(handler) {
  requests = [];
  globalThis.fetch = async (url, init = {}) => {
    const req = { url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined };
    requests.push(req);
    const [status, data] = handler(req);
    return new Response(JSON.stringify(data), { status });
  };
}

beforeEach(() => { requests = []; });
afterEach(() => { globalThis.fetch = realFetch; });

test('publication : conteneur → attente FINISHED → publication', async () => {
  let polls = 0;
  mockFetch((r) => {
    if (r.url.includes('/1784/media?')) return [200, { id: 'cont1' }];
    if (r.url.includes('/cont1?')) return [200, { status_code: ++polls < 2 ? 'IN_PROGRESS' : 'FINISHED' }];
    if (r.url.includes('/media_publish')) return [200, { id: 'media9' }];
    if (r.url.includes('/media9?')) return [200, { permalink: 'https://instagram.com/reel/x' }];
    return [404, { error: { message: 'inattendu' } }];
  });
  const res = await publishReel({ videoUrl: 'https://v/x.mp4', caption: 'Légende', cfg, pollMs: 1 });
  assert.deepEqual(res, { mediaId: 'media9', permalink: 'https://instagram.com/reel/x' });
  const create = new URL(requests[0].url);
  assert.equal(create.searchParams.get('media_type'), 'REELS');
  assert.equal(create.searchParams.get('video_url'), 'https://v/x.mp4');
  assert.equal(create.searchParams.get('caption'), 'Légende');
  assert.equal(new URL(requests.at(-2).url).searchParams.get('creation_id'), 'cont1');
});

test('publication : conteneur en erreur', async () => {
  mockFetch((r) => (r.url.includes('/media?') ? [200, { id: 'c' }] : [200, { status_code: 'ERROR', status: 'codec' }]));
  await assert.rejects(publishReel({ videoUrl: 'u', caption: 'c', cfg, pollMs: 1 }), /ERROR codec/);
});

test('DM : bouton, puis repli texte si le bouton est refusé', async () => {
  mockFetch(() => [200, { message_id: 'm' }]);
  assert.equal(await sendPrivateReply({ commentId: 'c1', text: 'Voici', buttonTitle: 'Ouvrir', url: 'https://x', cfg }), 'button');
  assert.deepEqual(requests[0].body.recipient, { comment_id: 'c1' });
  assert.equal(requests[0].body.message.attachment.payload.buttons[0].url, 'https://x');

  mockFetch((r) => (r.body.message.attachment ? [400, { error: { message: 'unsupported', code: 100 } }] : [200, {}]));
  assert.equal(await sendPrivateReply({ commentId: 'c1', text: 'Voici', buttonTitle: 'Ouvrir', url: 'https://x', cfg }), 'text');
  assert.equal(requests[1].body.message.text, 'Voici\n\nhttps://x');
});

test('webhook : vérification Meta et signature', async () => {
  process.env.IG_VERIFY_TOKEN = 'verif';
  process.env.IG_APP_SECRET = 'secret';
  process.env.IG_USER_ID = '1784';
  const { GET, POST } = await import('../../api/instagram-webhook.mjs');

  const ok = GET(new Request('https://x/api/instagram-webhook?hub.mode=subscribe&hub.verify_token=verif&hub.challenge=42'));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), '42');
  assert.equal(GET(new Request('https://x/api/instagram-webhook?hub.mode=subscribe&hub.verify_token=non&hub.challenge=42')).status, 403);

  const body = JSON.stringify({ object: 'instagram', entry: [] });
  const bad = await POST(new Request('https://x', { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=00' } }));
  assert.equal(bad.status, 401);
  const sig = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex');
  const good = await POST(new Request('https://x', { method: 'POST', body, headers: { 'x-hub-signature-256': sig } }));
  assert.equal(good.status, 200);
});
