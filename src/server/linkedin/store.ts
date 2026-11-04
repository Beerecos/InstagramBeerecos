import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LiStore } from "./service";

/** Connexion LinkedIn (une ligne, clé secrète, serveur uniquement). Le jeton ne quitte jamais le serveur. */
export function linkedinStore(): LiStore {
  const sb = createSupabaseAdminClient();
  return {
    async get() {
      const { data, error } = await sb.from("li_connection").select("member_urn, name, access_token, expires_at, scopes").eq("id", 1).maybeSingle();
      if (error) throw new Error(`Lecture de la connexion LinkedIn : ${error.message}`);
      return data ? { memberUrn: data.member_urn, name: data.name, accessToken: data.access_token, expiresAt: data.expires_at, scopes: data.scopes ?? [] } : null;
    },
    async save(c, by) {
      const { error } = await sb.from("li_connection").upsert({ id: 1, member_urn: c.memberUrn, name: c.name, access_token: c.accessToken, expires_at: c.expiresAt, scopes: c.scopes, connected_by: by, updated_at: new Date().toISOString() });
      if (error) throw new Error(`Enregistrement de la connexion LinkedIn : ${error.message}`);
    },
    async remove() {
      const { error } = await sb.from("li_connection").delete().eq("id", 1);
      if (error) throw new Error(`Déconnexion de LinkedIn : ${error.message}`);
    },
  };
}
