import { body, guarded } from "@/server/instagram/http";
import { UserError } from "@/server/instagram/service";
import { publish } from "@/server/linkedin/service";
import { linkedinDeps } from "@/server/linkedin/http";

/** Publication LinkedIn publique et irréversible : exige la confirmation explicite de la fenêtre « Publier ». */
export function POST(request: Request, ctx: RouteContext<"/api/instagram/posts/[id]/linkedin">) {
  return guarded("publication:schedule", async ({ userId }) => {
    const { id } = await ctx.params;
    const { confirm, text, target, videoUrl } = await body(request);
    if (confirm !== true) throw new UserError("Confirmation de publication manquante.");
    if (typeof text !== "string") throw new UserError("Texte LinkedIn manquant.");
    return { item: await publish(linkedinDeps(), userId, id, { text, target: target === "page" ? "page" : "profil", videoUrl: typeof videoUrl === "string" ? videoUrl : undefined }) };
  });
}
