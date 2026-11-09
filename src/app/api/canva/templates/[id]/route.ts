import { guardedCanva } from "@/server/canva/http";
import { dataset } from "@/server/canva/service";

/** Zones remplissables d'un modèle de marque (nom et type). */
export async function GET(_request: Request, ctx: RouteContext<"/api/canva/templates/[id]">) {
  const { id } = await ctx.params;
  return guardedCanva("content:edit", async ({ deps }) => ({ fields: await dataset(deps, id) }));
}
