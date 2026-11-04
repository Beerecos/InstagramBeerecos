import { NextResponse } from "next/server";
import { ForbiddenError, requirePermission } from "@/server/auth/dal";
import { authorizeUrl } from "@/server/linkedin/api";
import { linkedinApp, redirectUri, STATE_COOKIE } from "@/server/linkedin/http";

/** Ouvre la connexion officielle LinkedIn (aucun jeton à copier). La page BeeRecos est demandée si elle est configurée. */
export async function GET(request: Request) {
  try {
    await requirePermission("integrations:manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
    throw e;
  }
  const app = linkedinApp();
  if (!app.clientId || !app.clientSecret) return NextResponse.redirect(new URL("/settings?linkedin=non-configure#linkedin", request.url));
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl({ clientId: app.clientId, redirectUri: redirectUri(request), state, withPage: Boolean(app.organizationUrn) }));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/linkedin", maxAge: 600 });
  return res;
}
