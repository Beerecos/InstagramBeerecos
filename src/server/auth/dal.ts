import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { can, roleFromBeeMarketing, type Permission, type Role } from "@/domain/roles";

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
 * Vérifie le JWT (getClaims) puis lit le rôle BeeMarketing (`user_roles`) côté serveur. Mémoïsé par requête.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Toujours évalué à la requête, jamais figé au build (quel que soit l'environnement de build).
  await connection();
  if (isDemoMode()) return DEMO_USER;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) redirect("/login");

  // Base BeeMarketing : `user_roles` et `organizations` n'ont pas de politique de lecture pour la session
  // (RLS fermée). Lecture serveur à privilèges élevés, limitée à l'utilisateur dont le JWT vient d'être vérifié.
  let roleKeys: string[] = [];
  let org: { id: string; name: string } | null = null;
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: roles }, { data: organization }] = await Promise.all([
      admin.from("user_roles").select("role_key").eq("user_id", claims.sub),
      admin.from("organizations").select("id, name").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);
    roleKeys = (roles ?? []).map((r) => String(r.role_key));
    org = (organization as { id: string; name: string } | null) ?? null;
  } catch {
    // Clé secrète absente : accès en lecture seule, jamais d'élévation par défaut.
  }

  const fullName = (claims.email as string | undefined) ?? "";
  const role: Role = roleFromBeeMarketing(roleKeys);

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
