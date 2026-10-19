// Webhook Instagram (Meta) : vérification de l'abonnement + commentaires-mots-clés.
// Logique historique éprouvée (signature HMAC, déduplication) — migrée vers InstagramMessagingProvider en phase 5.
import * as legacy from "../../../../../automation/lib/webhook.mjs";

function notConfigured() {
  return !process.env.IG_VERIFY_TOKEN || !process.env.IG_APP_SECRET || !process.env.IG_USER_ID;
}

const unavailable = () => new Response("Instagram integration not configured", { status: 503 });

export function GET(request: Request) {
  return notConfigured() ? unavailable() : legacy.GET(request);
}

export async function POST(request: Request) {
  return notConfigured() ? unavailable() : legacy.POST(request);
}
