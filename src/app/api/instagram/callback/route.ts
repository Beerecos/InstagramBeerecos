import { diagnoseMetaAccess } from "@/server/instagram/diagnostic";
import { NextResponse, type NextRequest } from "next/server";
import { ForbiddenError, requirePermission } from "@/server/auth/dal";
import { serverEnv } from "@/lib/env/server";
import { supabaseStore } from "@/server/instagram/store";
import { connect } from "@/server/instagram/service";
import { exchangeCode, oauthConfig, oauthReady, STATE_COOKIE, validState } from "@/server/instagram/oauth";

export async function GET(request: NextRequest) {
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/settings?instagram=${status}#instagram`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/instagram" });
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };
  let user;
  try { user = await requirePermission("integrations:manage"); }
  catch (e) {
    if (e instanceof ForbiddenError) return back("interdit");
    throw e;
  }
  if (user.demo || !oauthReady()) return back("configuration");
  const q = request.nextUrl.searchParams;
  if (!validState(request.cookies.get(STATE_COOKIE)?.value, q.get("state"), user.id, oauthConfig().secret)) return back("expire");
  if (q.has("error")) return back("annule");
  const code = q.get("code");
  if (!code) return back("expire");
  let token: string | undefined;
  try {
    token = await exchangeCode(code);
    const env = serverEnv();
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return back("configuration");
    await connect({ store: supabaseStore(), supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL }, user.id, token);
    return back("ok");
  } catch (e) {
    if (token) await diagnoseMetaAccess(token).catch(() => undefined);
    // Only fixed statuses reach the browser; neither tokens nor provider error payloads.
    if (e instanceof Error && e.message.includes("aucune Page")) return back("aucun-compte");
    if (e instanceof Error && e.message.includes("Plusieurs comptes")) return back("autre-compte");
    return back("erreur");
  }
}
