import "server-only";
import { can } from "@/domain/roles";
import { isDemoMode } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth/dal";

export type AuditEvent = { id: number; action: string; entity_type: string; entity_id: string | null; actor_type: string; created_at: string };

export async function listRecentAuditEvents(limit = 50): Promise<{ kind: "ok"; events: AuditEvent[] } | { kind: "forbidden" }> {
  const user = await getCurrentUser();
  if (!can(user.role, "audit:read")) return { kind: "forbidden" };
  if (isDemoMode() || !user.organization) return { kind: "ok", events: [] };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_type, created_at")
    .eq("organization_id", user.organization.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Lecture du journal impossible : ${error.message}`);
  return { kind: "ok", events: (data ?? []) as AuditEvent[] };
}
