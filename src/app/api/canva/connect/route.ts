import { NextResponse } from "next/server";
import { ForbiddenError, requirePermission } from "@/server/auth/dal";
import { authorizeUrl, pkce } from "@/server/canva/api";
import { canvaApp, redirectUri, STATE_COOKIE, VERIFIER_COOKIE } from "@/server/canva/http";

/** Ouvre la connexion officielle Canva (OAuth + PKCE) : aucun jeton à copier. */
export async function GET(request: Request) {
  try {
    await requirePermission("integrations:manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
    throw e;
  }
  const app = canvaApp();
  if (!app.clientId || !app.clientSecret) return NextResponse.redirect(new URL("/settings?canva=non-configure#canva", request.url));
  const state = crypto.randomUUID();
  const { verifier, challenge } = await pkce();
  const res = NextResponse.redirect(authorizeUrl({ clientId: app.clientId, redirectUri: redirectUri(request), state, challenge }));
  const cookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/api/canva", maxAge: 600 };
  res.cookies.set(STATE_COOKIE, state, cookie);
  res.cookies.set(VERIFIER_COOKIE, verifier, cookie);
  return res;
}
