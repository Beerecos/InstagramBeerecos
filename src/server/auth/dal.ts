import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLES, can, type Permission, type Role } from "@/domain/roles";

export type CurrentUser = {
  id: string;
  email: string | null;
  firstName: string;
  organization: { id: string; name: string } | null;
  role: Role;
  demo: boolean;
};

const DEMO_USER: CurrentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: null,
  firstName: "Cédric",
  organization: { id: "00000000-0000-4000-8000-0000000000aa", name: "BeeRecos (démo)" },
  role: "admin",
  demo: true,
};

/**
 * Data Access Layer : seule porte d'entrée pour connaître l'utilisateur courant.
 * Vérifie le JWT (getClaims) puis lit l'adhésion sous RLS. Mémoïsé par requête.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Toujours évalué à la requête, jamais figé au build (quel que soit l'environnement de build).
  await connection();
  if (isDemoMode()) return DEMO_USER;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", claims.sub).maybeSingle(),
    supabase
      .from("memberships")
      .select("role, organization:organizations(id, name)")
      .eq("user_id", claims.sub)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const fullName = (profile?.full_name as string | null) ?? (claims.email as string | undefined) ?? "";
  const role = ROLES.includes(membership?.role as Role) ? (membership!.role as Role) : "viewer";
  const org = membership?.organization as unknown as { id: string; name: string } | null;

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    firstName: fullName.split(/[\s@]/)[0] || "",
    organization: org ?? null,
    role,
    demo: false,
  };
});

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Action non autorisée (${permission}).`);
    this.name = "ForbiddenError";
  }
}

/** À appeler dans chaque Server Action / Route Handler sensible, au plus près de la donnée. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!can(user.role, permission)) throw new ForbiddenError(permission);
  return user;
}
