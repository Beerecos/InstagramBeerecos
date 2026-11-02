// Jeton de session à joindre aux appels des Edge Functions BeeMarketing (équivalent de `src/lib/supabase.ts`).
// Même projet Supabase Auth : le jeton de la session InstagramBeerecos est accepté par les fonctions BeeMarketing.
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

let client: ReturnType<typeof createSupabaseBrowserClient> | null | undefined;

export async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (client === undefined) {
    try { client = createSupabaseBrowserClient(); } catch { client = null; }
  }
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}
