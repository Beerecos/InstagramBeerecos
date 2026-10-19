import { buildReelComposition } from "@/domain/video/reel";
import { getTaskReel } from "@/server/missions/queries";

/**
 * Composition Hyperframes d'un Reel (HTML). Aperçu : servie au lecteur intégré, avec le runtime auto-hébergé.
 * `?download=1` : fichier `index.html` prêt pour `npx hyperframes render` (polices et GSAP en URL absolue).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/compositions/[taskId]">) {
  const { taskId } = await ctx.params;
  const url = new URL(request.url);
  const reel = await getTaskReel(taskId, Number(url.searchParams.get("i") ?? 0) || 0).catch(() => null);
  if (!reel) return new Response("Composition introuvable.", { status: 404 });
  const download = url.searchParams.get("download") === "1";
  const html = buildReelComposition(reel.spec, { assetBase: `${url.origin}/hyperframes`, preview: !download });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // La composition ne charge que ses propres ressources ; aucun appel externe.
      "Content-Security-Policy": "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; frame-ancestors 'self'",
      ...(download ? { "Content-Disposition": `attachment; filename="reel-${taskId.slice(0, 8)}.html"` } : {}),
    },
  });
}
