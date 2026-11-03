import "server-only";
import { NextResponse } from "next/server";
import { isDemoMode, serverEnv } from "@/lib/env/server";
import { ForbiddenError, requirePermission } from "@/server/auth/dal";
import type { Permission } from "@/domain/roles";
import { UserError, type Deps } from "./service";
import { supabaseStore } from "./store";

/** Garde commune des routes Instagram : session + permission, configuration présente, erreurs lisibles. */
export async function guarded(permission: Permission, fn: (ctx: { userId: string; deps: Deps }) => Promise<unknown>) {
  try {
    const user = await requirePermission(permission);
    const env = serverEnv();
    if (isDemoMode() || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      return NextResponse.json({ error: "Publication Instagram indisponible : base non configurée sur ce serveur." }, { status: 503 });
    }
    const deps: Deps = { store: supabaseStore(), supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL };
    return NextResponse.json(await fn({ userId: user.id, deps }));
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: e.status });
    // Redirections (session expirée) : laissées à Next.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("instagram", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur serveur." }, { status: 500 });
  }
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new UserError("Requête illisible.");
  return data as Record<string, unknown>;
}
