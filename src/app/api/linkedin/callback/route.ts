import { NextResponse, type NextRequest } from "next/server";
import { ForbiddenError, requirePermission } from "@/server/auth/dal";
import { finishConnect } from "@/server/linkedin/service";
import { linkedinApp, linkedinDeps, redirectUri, STATE_COOKIE } from "@/server/linkedin/http";

/** Retour de LinkedIn : contrôle de l'état anti-falsification, échange du code, enregistrement côté serveur. */
export async function GET(request: NextRequest) {
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/settings?linkedin=${status}#linkedin`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/linkedin" });
    return res;
  };
  let userId: string;
  try {
    userId = (await requirePermission("integrations:manage")).id;
  } catch (e) {
    if (e instanceof ForbiddenError) return back("interdit");
    throw e;
  }
  const q = request.nextUrl.searchParams;
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (q.get("error")) return back("refuse");
  if (!expected || q.get("state") !== expected || !q.get("code")) return back("expire");
  const app = linkedinApp();
  if (!app.clientId || !app.clientSecret) return back("non-configure");
  try {
    await finishConnect(linkedinDeps(), userId, { code: q.get("code")!, clientId: app.clientId, clientSecret: app.clientSecret, redirectUri: redirectUri(request) });
    return back("ok");
  } catch (e) {
    console.error("linkedin callback", e instanceof Error ? e.message : e);
    return back("erreur");
  }
}
