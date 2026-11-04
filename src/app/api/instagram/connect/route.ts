import { NextResponse } from "next/server";
import { ForbiddenError, requirePermission } from "@/server/auth/dal";
import { authorizeUrl, createState, oauthConfig, oauthReady, STATE_COOKIE } from "@/server/instagram/oauth";

export async function GET(request: Request) {
  let user;
  try { user = await requirePermission("integrations:manage"); }
  catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
    throw e;
  }
  if (user.demo || !oauthReady()) return NextResponse.redirect(new URL("/settings?instagram=configuration#instagram", request.url));
  const c = oauthConfig();
  if (new URL(request.url).origin !== new URL(c.redirectUri).origin) return NextResponse.json({ error: "Utilisez le site de production pour connecter Instagram." }, { status: 400 });
  const { state, cookie } = createState(user.id, c.secret);
  const res = NextResponse.redirect(authorizeUrl(state));
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.cookies.set(STATE_COOKIE, cookie, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/instagram", maxAge: 600 });
  return res;
}
