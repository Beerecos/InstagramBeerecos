import { body, guarded } from "@/server/instagram/http";
import { start, UserError } from "@/server/instagram/service";

/** Publication publique et irréversible : exige la confirmation explicite envoyée par la fenêtre « Publier ». */
export function POST(request: Request, ctx: RouteContext<"/api/instagram/posts/[id]/publish">) {
  return guarded("publication:schedule", async ({ userId, deps }) => {
    const { id } = await ctx.params;
    const { confirm, videoUrl } = await body(request);
    if (confirm !== true) throw new UserError("Confirmation de publication manquante.");
    return { item: await start(deps, userId, id, { videoUrl: typeof videoUrl === "string" ? videoUrl : undefined }) };
  });
}
