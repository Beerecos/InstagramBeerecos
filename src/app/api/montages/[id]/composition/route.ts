import { serverEnv } from "@/lib/env/server";
import { montageComposition } from "@/server/montages/service";

/**
 * Composition Hyperframes d'un montage (HTML), servie au lecteur intégré de la page Montage.
 * La prise est lue directement depuis le stockage par URL signée : seul ce domaine est autorisé pour les médias.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/montages/[id]/composition">) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const html = await montageComposition(id, `${url.origin}/hyperframes`).catch(() => null);
  if (!html) return new Response("Montage introuvable.", { status: 404 });
  const storage = serverEnv().NEXT_PUBLIC_SUPABASE_URL ?? "";
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src ${storage} blob:; connect-src ${storage}; frame-ancestors 'self'`,
    },
  });
}
