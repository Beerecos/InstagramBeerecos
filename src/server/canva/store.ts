import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CanvaStore } from "./service";

/** Connexion Canva (une ligne, clé secrète, serveur uniquement). Les jetons ne quittent jamais le serveur. */
export function canvaStore(): CanvaStore {
  const sb = createSupabaseAdminClient();
  return {
    async get() {
      const { data, error } = await sb.from("canva_connection").select("display_name, access_token, refresh_token, expires_at, scopes, capabilities").eq("id", 1).maybeSingle();
      if (error) throw new Error(`Lecture de la connexion Canva : ${error.message}`);
      return data ? { displayName: data.display_name, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at, scopes: data.scopes ?? [], capabilities: data.capabilities ?? [] } : null;
    },
    async save(c, by) {
      const row = { id: 1, display_name: c.displayName, access_token: c.accessToken, refresh_token: c.refreshToken, expires_at: c.expiresAt, scopes: c.scopes, capabilities: c.capabilities, updated_at: new Date().toISOString(), ...(by ? { connected_by: by } : {}) };
      const { error } = await sb.from("canva_connection").upsert(row);
      if (error) throw new Error(`Enregistrement de la connexion Canva : ${error.message}`);
    },
    async remove() {
      const { error } = await sb.from("canva_connection").delete().eq("id", 1);
      if (error) throw new Error(`Déconnexion de Canva : ${error.message}`);
    },
  };
}
