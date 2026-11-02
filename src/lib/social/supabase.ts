// Jeton de session à joindre aux appels des Edge Functions BeeMarketing (équivalent de `src/lib/supabase.ts`).
// Même projet Supabase Auth : le jeton de la session InstagramBeerecos est accepté par les fonctions BeeMarketing.
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined" || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Client navigateur partagé (équivalent de l'export `supabase` de BeeMarketing) ; null si Supabase n'est pas configuré. */
export const supabase: ReturnType<typeof createSupabaseBrowserClient> | null = (() => {
  try { return createSupabaseBrowserClient(); } catch { return null; }
})();
