import "server-only";
import { serverEnv } from "@/lib/env/server";
import { supabaseStore } from "@/server/instagram/store";
import type { LiDeps } from "./service";
import { linkedinStore } from "./store";

/** Configuration LinkedIn côté serveur : identifiants de l'application (Vercel) et page BeeRecos facultative. */
export function linkedinApp() {
  const env = serverEnv();
  return { clientId: env.LINKEDIN_CLIENT_ID, clientSecret: env.LINKEDIN_CLIENT_SECRET, organizationUrn: env.LINKEDIN_ORGANIZATION_URN };
}

export function linkedinDeps(): LiDeps {
  const env = serverEnv();
  return { store: supabaseStore(), li: linkedinStore(), supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL!, organizationUrn: env.LINKEDIN_ORGANIZATION_URN };
}

export const STATE_COOKIE = "ibr_li_state";
export const redirectUri = (request: Request) => `${new URL(request.url).origin}/api/linkedin/callback`;
