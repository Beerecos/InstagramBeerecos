import "server-only";
import { serverEnv } from "@/lib/env/server";
import { tokenNeedsRefresh } from "@/domain/instagram/publication";
import { refreshToken, unifiedLogin } from "./graph";
import { supabaseStore } from "./store";

/** Tournée quotidienne : renouvelle le jeton Instagram à moins de 10 jours de l'expiration (il en dure 60). */
export async function refreshIfNeeded(): Promise<"absent" | "ok" | "renouvelé" | "échec" | "reconnexion-meta"> {
  if (!serverEnv().SUPABASE_SECRET_KEY) return "absent";
  try {
    const store = supabaseStore();
    const c = await store.getConnection();
    if (!c) return "absent";
    if (unifiedLogin()) return "reconnexion-meta";
    if (!tokenNeedsRefresh(c.expiresAt)) return "ok";
    const r = await refreshToken({ token: c.accessToken });
    await store.saveConnection({ ...c, accessToken: r.token, expiresAt: r.expiresAt }, null);
    return "renouvelé";
  } catch {
    return "échec";
  }
}
