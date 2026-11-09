import "server-only";
import { NextResponse } from "next/server";
import { isDemoMode, serverEnv } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError, requirePermission } from "@/server/auth/dal";
import type { Permission } from "@/domain/roles";
import { CanvaError } from "./api";
import type { CanvaDeps } from "./service";
import { canvaStore } from "./store";

export const STATE_COOKIE = "ibr_canva_state";
export const VERIFIER_COOKIE = "ibr_canva_pkce";
export const redirectUri = (request: Request) => `${new URL(request.url).origin}/api/canva/callback`;

export function canvaApp() {
  const env = serverEnv();
  return { clientId: env.CANVA_CLIENT_ID, clientSecret: env.CANVA_CLIENT_SECRET };
}

/** Dépôt d'une image Canva dans le bucket privé des photos de post (même chemin que les photos envoyées). */
async function upload(userId: string, bytes: ArrayBuffer): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await createSupabaseAdminClient().storage.from("ig-media").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw new CanvaError(`Enregistrement de l'image Canva impossible : ${error.message}`, 502);
  return path;
}

export function canvaDeps(): CanvaDeps {
  return { store: canvaStore(), app: canvaApp(), fetch, upload };
}

/** Garde commune des routes Canva : session + permission, base configurée, erreurs lisibles (jamais de jeton renvoyé). */
export async function guardedCanva(permission: Permission, fn: (ctx: { userId: string; deps: CanvaDeps }) => Promise<unknown>) {
  try {
    const user = await requirePermission(permission);
    const env = serverEnv();
    if (isDemoMode() || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      return NextResponse.json({ error: "Canva indisponible : base non configurée sur ce serveur." }, { status: 503 });
    }
    return NextResponse.json(await fn({ userId: user.id, deps: canvaDeps() }));
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
    if (e instanceof CanvaError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("canva", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
