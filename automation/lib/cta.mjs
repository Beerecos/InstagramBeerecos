// Logique « commente MOT → DM avec bouton », partagée par le webhook et les tests.
import { createHmac, timingSafeEqual } from 'node:crypto';

export function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Le mot-clé doit apparaître comme un mot entier, sans tenir compte de la casse ni des accents :
// « GUIDE » matche « guide stp 🙏 » et « Guidé », mais pas « guides » ni « superguide ».
export function matchesKeyword(text, keyword) {
  if (!keyword || keyword === '*') return true;
  const words = normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
  const target = normalize(keyword).split(/[^a-z0-9]+/).filter(Boolean);
  if (!target.length) return false;
  for (let i = 0; i + target.length <= words.length; i++) {
    if (target.every((w, j) => words[i + j] === w)) return true;
  }
  return false;
}

export function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader?.startsWith('sha256=') || !appSecret) return false;
  const expected = Buffer.from(createHmac('sha256', appSecret).update(rawBody).digest('hex'));
  const got = Buffer.from(signatureHeader.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

// Extrait les commentaires d'une notification webhook Instagram.
export function extractComments(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'comments' || !change.value?.id) continue;
      const v = change.value;
      out.push({
        accountId: entry.id,
        commentId: v.id,
        text: v.text || '',
        fromId: v.from?.id,
        username: v.from?.username,
        mediaId: v.media?.id,
        parentId: v.parent_id,
      });
    }
  }
  return out;
}

export function personalize(template, { username }) {
  return String(template || '').replaceAll('{username}', username ? `@${username}` : '');
}

// Traite un commentaire. Les dépendances sont injectées pour pouvoir tester sans réseau.
export async function handleComment(comment, deps) {
  const { listCampaigns, claimReply, finishReply, sendPrivateReply, replyToComment, ownId } = deps;
  if (comment.fromId && (comment.fromId === ownId || comment.fromId === comment.accountId)) return { skipped: 'own-comment' };

  const campaigns = await listCampaigns({ mediaId: comment.mediaId });
  // Une campagne liée à ce post passe avant une campagne globale (media_id = '*').
  campaigns.sort((a, b) => (a.media_id === '*') - (b.media_id === '*'));
  const campaign = campaigns.find((c) => matchesKeyword(comment.text, c.keyword));
  if (!campaign) return { skipped: 'no-match' };

  const claimed = await claimReply({
    commentId: comment.commentId,
    campaignId: campaign.id,
    igUserId: comment.fromId,
    username: comment.username,
    text: comment.text,
  });
  if (!claimed) return { skipped: 'already-handled', campaign: campaign.id };

  try {
    const mode = await sendPrivateReply({
      commentId: comment.commentId,
      text: personalize(campaign.dm_text, comment),
      buttonTitle: campaign.button_title,
      url: campaign.button_url,
    });
    if (campaign.public_reply) {
      await replyToComment({ commentId: comment.commentId, message: personalize(campaign.public_reply, comment) }).catch(() => {});
    }
    await finishReply(comment.commentId, { status: 'sent', dm_mode: mode, sent_at: new Date().toISOString() });
    return { sent: mode, campaign: campaign.id };
  } catch (err) {
    await finishReply(comment.commentId, { status: 'error', error: err.message.slice(0, 500) }).catch(() => {});
    return { error: err.message, campaign: campaign.id };
  }
}
