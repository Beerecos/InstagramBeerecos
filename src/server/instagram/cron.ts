import "server-only";
import { serverEnv } from "@/lib/env/server";
import { account } from "./graph";
import { supabaseStore } from "./store";

/**
 * Tournée quotidienne : vérifie que Meta renvoie toujours le compte Instagram avec le jeton de Page enregistré
 * (ce jeton n'expire pas, mais il tombe si les droits sont retirés). Rien n'est modifié.
 */
export async function refreshIfNeeded(): Promise<"absent" | "ok" | "échec"> {
  if (!serverEnv().SUPABASE_SECRET_KEY) return "absent";
  try {
    const c = await supabaseStore().getConnection();
    if (!c) return "absent";
    await account({ token: c.accessToken, userId: c.igUserId });
    return "ok";
  } catch {
    return "échec";
  }
}
