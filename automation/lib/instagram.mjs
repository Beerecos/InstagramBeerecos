// Client minimal de l'API Instagram (Graph API) : publication de Reels, réponses aux commentaires, DM.
import { env } from './env.mjs';

export function igConfig() {
  return {
    host: env('IG_GRAPH_HOST', 'graph.instagram.com'),
    version: env('IG_API_VERSION', 'v26.0'),
    userId: env('IG_USER_ID'),
    token: env('IG_ACCESS_TOKEN'),
  };
}

export async function graph(method, path, { params = {}, body, cfg = igConfig() } = {}) {
  const url = new URL(`https://${cfg.host}/${cfg.version}/${path.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    const err = new Error(`Instagram ${method} ${path} : ${e.message || res.status} (code ${e.code ?? '?'})`);
    err.status = res.status;
    err.graphError = e;
    throw err;
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Publie un Reel à partir d'une URL publique. Renvoie { mediaId, permalink }.
export async function publishReel({ videoUrl, caption, shareToFeed = true, coverUrl, thumbOffsetMs, cfg = igConfig(), pollMs = 10000, timeoutMs = 10 * 60000, log = () => {} }) {
  const params = { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: String(shareToFeed) };
  if (coverUrl) params.cover_url = coverUrl;
  if (thumbOffsetMs !== undefined) params.thumb_offset = String(thumbOffsetMs);
  const { id: containerId } = await graph('POST', `${cfg.userId}/media`, { params, cfg });
  log(`Conteneur créé : ${containerId}`);

  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { status_code: status, status: detail } = await graph('GET', containerId, { params: { fields: 'status_code,status' }, cfg });
    log(`Traitement Instagram : ${status}`);
    if (status === 'FINISHED') break;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Conteneur ${containerId} en échec : ${status} ${detail || ''}`);
    if (Date.now() > deadline) throw new Error(`Conteneur ${containerId} toujours ${status} après ${timeoutMs / 1000}s`);
    await sleep(pollMs);
  }

  const { id: mediaId } = await graph('POST', `${cfg.userId}/media_publish`, { params: { creation_id: containerId }, cfg });
  const { permalink } = await graph('GET', mediaId, { params: { fields: 'permalink' }, cfg }).catch(() => ({}));
  return { mediaId, permalink };
}

// Réponse privée (DM) à un commentaire. Un seul message par commentateur, sous 7 jours.
// Essaie d'abord le message avec bouton ; si Instagram le refuse, envoie le texte avec le lien.
export async function sendPrivateReply({ commentId, text, buttonTitle, url, cfg = igConfig() }) {
  const recipient = { comment_id: commentId };
  if (buttonTitle && url) {
    try {
      await graph('POST', `${cfg.userId}/messages`, {
        cfg,
        body: {
          recipient,
          message: {
            attachment: {
              type: 'template',
              payload: { template_type: 'button', text, buttons: [{ type: 'web_url', url, title: buttonTitle }] },
            },
          },
        },
      });
      return 'button';
    } catch (err) {
      // 4xx = format refusé : on retombe sur le texte. Le reste (réseau, 5xx) remonte.
      if (!(err.status >= 400 && err.status < 500)) throw err;
    }
  }
  await graph('POST', `${cfg.userId}/messages`, {
    cfg,
    body: { recipient, message: { text: url ? `${text}\n\n${url}` : text } },
  });
  return 'text';
}

export async function replyToComment({ commentId, message, cfg = igConfig() }) {
  return graph('POST', `${commentId}/replies`, { params: { message }, cfg });
}

// Jeton longue durée (60 jours) : à rafraîchir avant expiration (Instagram Login uniquement).
export async function refreshToken({ cfg = igConfig() } = {}) {
  const url = new URL(`https://${cfg.host}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', cfg.token);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Rafraîchissement refusé : ${data.error?.message || res.status}`);
  return data; // { access_token, token_type, expires_in }
}
