#!/usr/bin/env node
// CLI Instagram : publier un Reel, gérer les campagnes CTA, vérifier le compte, rafraîchir le jeton.
import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { graph, igConfig, publishReel, refreshToken } from '../lib/instagram.mjs';
import { uploadPublic, listCampaigns, createCampaign, setCampaignActive } from '../lib/supabase.mjs';

const USAGE = `Usage :
  ig.mjs me
      Vérifie le jeton et affiche le compte connecté.
  ig.mjs publish --video export/final.mp4 --caption "texte" [--caption-file f.txt]
                 [--keyword GUIDE --dm-text "..." --button "Accéder au guide" --url https://...]
                 [--public-reply "Je t'ai envoyé ça en DM 📩"] [--no-feed] [--thumb-ms 1500] [--yes]
      Dépose la vidéo sur Supabase Storage, publie le Reel et crée la campagne CTA liée.
      Sans --yes, s'arrête avant la publication (simulation).
  ig.mjs cta add --media <id|*> --keyword MOT --dm-text "..." [--button "..." --url ...] [--public-reply "..."] [--label "..."]
  ig.mjs cta list [--all]
  ig.mjs cta off <campaign-id>   |   ig.mjs cta on <campaign-id>
  ig.mjs refresh-token
      Prolonge le jeton longue durée (60 jours) et affiche le nouveau.`;

const { values: o, positionals: pos } = parseArgs({
  allowPositionals: true,
  options: {
    video: { type: 'string' },
    caption: { type: 'string' },
    'caption-file': { type: 'string' },
    keyword: { type: 'string' },
    'dm-text': { type: 'string' },
    button: { type: 'string' },
    url: { type: 'string' },
    'public-reply': { type: 'string' },
    media: { type: 'string' },
    label: { type: 'string' },
    'no-feed': { type: 'boolean' },
    'thumb-ms': { type: 'string' },
    all: { type: 'boolean' },
    yes: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

const log = (m) => console.error(`· ${m}`);

function campaignFromOpts(mediaId) {
  if (!o.keyword || !o['dm-text']) throw new Error('--keyword et --dm-text sont requis pour une campagne CTA');
  if (Boolean(o.button) !== Boolean(o.url)) throw new Error('--button et --url vont ensemble');
  return {
    media_id: mediaId,
    keyword: o.keyword,
    dm_text: o['dm-text'],
    button_title: o.button || null,
    button_url: o.url || null,
    public_reply: o['public-reply'] || null,
    label: o.label || null,
  };
}

async function main() {
  const [cmd, sub, arg] = pos;
  if (!cmd || o.help) return console.log(USAGE);

  if (cmd === 'me') {
    const cfg = igConfig();
    const me = await graph('GET', 'me', { params: { fields: 'user_id,username,account_type,media_count' }, cfg });
    const limit = await graph('GET', `${cfg.userId}/content_publishing_limit`, { params: { fields: 'quota_usage,config' }, cfg }).catch(() => null);
    return console.log(JSON.stringify({ ...me, publishing_limit: limit?.data?.[0] }, null, 2));
  }

  if (cmd === 'publish') {
    if (!o.video || !existsSync(o.video)) throw new Error(`Vidéo introuvable : ${o.video}`);
    const { readFile } = await import('node:fs/promises');
    const caption = o['caption-file'] ? (await readFile(o['caption-file'], 'utf8')).trim() : o.caption;
    if (!caption) throw new Error('--caption ou --caption-file requis');
    if (caption.length > 2200) throw new Error(`Légende trop longue (${caption.length}/2200)`);
    const campaign = o.keyword ? campaignFromOpts('pending') : null;

    if (!o.yes) {
      console.log(JSON.stringify({ simulation: true, video: o.video, caption, campaign }, null, 2));
      return console.error('Simulation uniquement. Relancer avec --yes pour publier réellement.');
    }

    log('Dépôt de la vidéo sur Supabase Storage…');
    const videoUrl = await uploadPublic(o.video);
    log(`URL publique : ${videoUrl}`);
    const { mediaId, permalink } = await publishReel({
      videoUrl,
      caption,
      shareToFeed: !o['no-feed'],
      thumbOffsetMs: o['thumb-ms'] ? Number(o['thumb-ms']) : undefined,
      log,
    });
    log(`Publié : ${permalink || mediaId}`);
    const created = campaign ? await createCampaign({ ...campaign, media_id: mediaId }) : null;
    return console.log(JSON.stringify({ mediaId, permalink, videoUrl, campaign: created }, null, 2));
  }

  if (cmd === 'cta') {
    if (sub === 'add') {
      if (!o.media) throw new Error('--media requis (ID du post, ou * pour tous)');
      return console.log(JSON.stringify(await createCampaign(campaignFromOpts(o.media)), null, 2));
    }
    if (sub === 'list') return console.log(JSON.stringify(await listCampaigns({ activeOnly: !o.all }), null, 2));
    if (sub === 'off' || sub === 'on') {
      if (!arg) throw new Error('ID de campagne requis');
      return console.log(JSON.stringify(await setCampaignActive(arg, sub === 'on'), null, 2));
    }
  }

  if (cmd === 'refresh-token') {
    const t = await refreshToken();
    console.error(`Nouveau jeton valable ${Math.round(t.expires_in / 86400)} jours. Mettre à jour IG_ACCESS_TOKEN (.env et Vercel).`);
    return console.log(t.access_token);
  }

  console.log(USAGE);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(`Erreur : ${err.message}`);
  process.exitCode = 1;
});
