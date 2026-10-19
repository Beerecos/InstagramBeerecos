import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env/server";

/**
 * Client à privilèges élevés (contourne la RLS). Réservé aux workflows et webhooks serveur
 * après vérification explicite des droits. Ne jamais l'importer dans un composant client.
 */
export function createSupabaseAdminClient() {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("Clé secrète Supabase absente.");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
