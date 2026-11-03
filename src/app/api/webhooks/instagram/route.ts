// Webhook Instagram (Meta) : vérification de l'abonnement + « commente MOT → DM avec bouton ».
// Logique éprouvée (signature HMAC, mot entier sans accent, une réponse par personne et par post) reprise de
// automation/lib/cta.mjs ; le jeton vient du compte connecté dans Paramètres, les règles de cta_campaigns
// (créées automatiquement à la publication d'un post avec mot-clé).
import { extractComments, handleComment, verifySignature } from "../../../../../automation/lib/cta.mjs";
import { replyToComment, sendPrivateReply } from "../../../../../automation/lib/instagram.mjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseStore } from "@/server/instagram/store";

const unavailable = () => new Response("Instagram integration not configured", { status: 503 });
const secret = () => process.env.IG_APP_SECRET;
const verifyToken = () => process.env.IG_VERIFY_TOKEN;

export function GET(request: Request) {
  if (!verifyToken()) return unavailable();
  const q = new URL(request.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === verifyToken()) return new Response(q.get("hub.challenge"), { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  if (!secret()) return unavailable();
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), secret())) return new Response("Bad signature", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const conn = await supabaseStore().getConnection().catch(() => null);
  if (!conn) return new Response("EVENT_RECEIVED", { status: 200 });
  const cfg = { host: "graph.instagram.com", version: process.env.IG_API_VERSION || "v26.0", userId: conn.igUserId, token: conn.accessToken };
  const sb = createSupabaseAdminClient();

  const deps = {
    ownId: conn.igUserId,
    async listCampaigns({ mediaId }: { mediaId?: string }) {
      const { data, error } = await sb.from("cta_campaigns").select("*").eq("active", true).in("media_id", [mediaId ?? "", "*"]).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async claimReply(r: { commentId: string; campaignId: string; igUserId?: string; username?: string; text: string }) {
      const { data, error } = await sb.from("cta_replies").upsert(
        { comment_id: r.commentId, campaign_id: r.campaignId, ig_user_id: r.igUserId ?? null, username: r.username ?? null, comment_text: r.text.slice(0, 2000), status: "pending" },
        { onConflict: "comment_id", ignoreDuplicates: true },
      ).select("comment_id");
      // Doublon (même personne, même règle) : déjà servie.
      if (error) { if (error.code === "23505") return false; throw new Error(error.message); }
      return (data ?? []).length > 0;
    },
    async finishReply(commentId: string, patch: Record<string, unknown>) {
      await sb.from("cta_replies").update(patch).eq("comment_id", commentId);
    },
    sendPrivateReply: (a: { commentId: string; text: string; buttonTitle?: string; url?: string }) => sendPrivateReply({ buttonTitle: undefined, url: undefined, ...a, cfg }),
    replyToComment: (a: { commentId: string; message: string }) => replyToComment({ ...a, cfg }),
  };

  for (const comment of extractComments(payload)) {
    const result = await handleComment(comment, deps).catch((err: Error) => ({ error: err.message }));
    // Journal sans donnée personnelle (ni pseudo ni texte du commentaire).
    console.log(JSON.stringify({ comment: comment.commentId, media: comment.mediaId, ...result }));
  }
  // Toujours 200 une fois la signature validée : sinon Meta renvoie la notification en boucle.
  return new Response("EVENT_RECEIVED", { status: 200 });
}
