import { NextResponse, type NextRequest } from "next/server";
import { ForbiddenError, requirePermission } from "@/server/auth/dal";
import { finishConnect } from "@/server/canva/service";
import { canvaDeps, redirectUri, STATE_COOKIE, VERIFIER_COOKIE } from "@/server/canva/http";

/** Retour de Canva : contrôle de l'état anti-falsification, échange du code avec le vérificateur PKCE, enregistrement serveur. */
export async function GET(request: NextRequest) {
  const back = (status: string, detail?: string) => {
    const url = new URL(`/settings?canva=${status}#canva`, request.url);
    // Raison renvoyée par Canva (code et description publics, jamais de jeton) : pour savoir quoi corriger.
    if (detail) url.searchParams.set("canva_detail", detail.replace(/[^\p{L}\p{N} .,:;'’_()/-]/gu, "").slice(0, 200));
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/canva" });
    res.cookies.delete({ name: VERIFIER_COOKIE, path: "/api/canva" });
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
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;
  const err = q.get("error");
  if (err) return back(err === "access_denied" ? "refuse" : "erreur-canva", [err, q.get("error_description")].filter(Boolean).join(" : "));
  if (!expected || !verifier || q.get("state") !== expected || !q.get("code")) return back("expire");
  try {
    await finishConnect(canvaDeps(), userId, { code: q.get("code")!, verifier, redirectUri: redirectUri(request) });
    return back("ok");
  } catch (e) {
    console.error("canva callback", e instanceof Error ? e.message : e);
    return back("erreur", e instanceof Error ? e.message : undefined);
  }
}
