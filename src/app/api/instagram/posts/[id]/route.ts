import { guarded } from "@/server/instagram/http";
import { advance, UserError } from "@/server/instagram/service";
import { previewUrls } from "@/server/instagram/store";

export function GET(_: Request, ctx: RouteContext<"/api/instagram/posts/[id]">) {
  return guarded("content:edit", async ({ userId, deps }) => {
    const { id } = await ctx.params;
    const item = await advance(deps, userId, id);
    return { item, previews: await previewUrls(item.media.map((m) => m.path)) };
  });
}

export function DELETE(_: Request, ctx: RouteContext<"/api/instagram/posts/[id]">) {
  return guarded("content:edit", async ({ userId, deps }) => {
    const { id } = await ctx.params;
    if (!(await deps.store.remove(userId, id))) throw new UserError("Un post publié ou en cours de publication ne se supprime pas d'ici.", 409);
    return { ok: true };
  });
}
