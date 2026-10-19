// Webhook Instagram (fonction Vercel) : vérification Meta + réponse automatique aux commentaires-mots-clés.
import { env } from '../automation/lib/env.mjs';
import { verifySignature, extractComments, handleComment } from '../automation/lib/cta.mjs';
import { sendPrivateReply, replyToComment } from '../automation/lib/instagram.mjs';
import { listCampaigns, claimReply, finishReply } from '../automation/lib/supabase.mjs';

// Vérification de l'abonnement, faite une fois par Meta lors de la configuration.
export function GET(request) {
  const q = new URL(request.url).searchParams;
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === env('IG_VERIFY_TOKEN')) {
    return new Response(q.get('hub.challenge'), { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), env('IG_APP_SECRET'))) {
    return new Response('Bad signature', { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const deps = {
    listCampaigns,
    claimReply,
    finishReply,
    sendPrivateReply,
    replyToComment,
    ownId: env('IG_USER_ID'),
  };
  for (const comment of extractComments(payload)) {
    const result = await handleComment(comment, deps).catch((err) => ({ error: err.message }));
    console.log(JSON.stringify({ comment: comment.commentId, media: comment.mediaId, ...result }));
  }
  // Toujours 200 une fois la signature validée : sinon Meta renvoie la notification en boucle.
  return new Response('EVENT_RECEIVED', { status: 200 });
}
