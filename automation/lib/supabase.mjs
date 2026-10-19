// Accès Supabase par l'API REST (clé service_role, côté serveur uniquement) : stockage des vidéos et campagnes CTA.
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { env } from './env.mjs';

export function sbConfig() {
  return { url: env('SUPABASE_URL').replace(/\/$/, ''), key: env('SUPABASE_SERVICE_ROLE_KEY') };
}

function headers(cfg, extra = {}) {
  return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, ...extra };
}

export async function rest(method, path, { body, prefer, cfg = sbConfig() } = {}) {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers: headers(cfg, {
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path} : ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// Dépose un fichier dans un bucket public et renvoie son URL publique (Instagram doit pouvoir la télécharger).
export async function uploadPublic(filePath, { bucket = env('SUPABASE_BUCKET', 'reels'), name, cfg = sbConfig() } = {}) {
  const objectName = name || `${Date.now()}-${basename(filePath)}`;
  const res = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${encodeURIComponent(objectName)}`, {
    method: 'POST',
    headers: headers(cfg, { 'Content-Type': 'video/mp4', 'x-upsert': 'true' }),
    body: await readFile(filePath),
  });
  if (!res.ok) throw new Error(`Upload Supabase refusé : ${res.status} ${await res.text()}`);
  return `${cfg.url}/storage/v1/object/public/${bucket}/${encodeURIComponent(objectName)}`;
}

// --- Campagnes CTA ---

export function listCampaigns({ mediaId, activeOnly = true, cfg } = {}) {
  const q = ['select=*', 'order=created_at.desc'];
  if (activeOnly) q.push('active=is.true');
  if (mediaId) q.push(`media_id=in.(${encodeURIComponent(mediaId)},*)`);
  return rest('GET', `cta_campaigns?${q.join('&')}`, { cfg });
}

export async function createCampaign(campaign, { cfg } = {}) {
  const [row] = await rest('POST', 'cta_campaigns', { body: campaign, prefer: 'return=representation', cfg });
  return row;
}

export function setCampaignActive(id, active, { cfg } = {}) {
  return rest('PATCH', `cta_campaigns?id=eq.${encodeURIComponent(id)}`, { body: { active }, prefer: 'return=representation', cfg });
}

// Réserve le droit de répondre à ce commentaire. Renvoie false si déjà traité
// (même commentaire, ou même personne déjà servie pour cette campagne).
export async function claimReply({ commentId, campaignId, igUserId, username, text }, { cfg } = {}) {
  const rows = await rest('POST', 'cta_replies?on_conflict=comment_id', {
    body: { comment_id: commentId, campaign_id: campaignId, ig_user_id: igUserId, username, comment_text: text, status: 'pending' },
    prefer: 'resolution=ignore-duplicates,return=representation',
    cfg,
  }).catch((err) => {
    // Violation de l'unicité (campagne, personne) : déjà servie.
    if (/\b409\b|23505/.test(err.message)) return [];
    throw err;
  });
  return rows.length > 0;
}

export function finishReply(commentId, patch, { cfg } = {}) {
  return rest('PATCH', `cta_replies?comment_id=eq.${encodeURIComponent(commentId)}`, { body: patch, cfg });
}
