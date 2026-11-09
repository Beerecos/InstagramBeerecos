import { z } from "zod";
import { CanvaError } from "@/server/canva/api";
import { guardedCanva } from "@/server/canva/http";
import { saveChoices } from "@/server/canva/service";

const Body = z.strictObject({
  choices: z.array(z.strictObject({ id: z.string(), title: z.string().max(255), kind: z.enum(["post", "carrousel"]) })).max(100),
});

/** Modèles Canva retenus pour l'onglet Post, chacun classé post ou carrousel (remplace la sélection précédente). */
export async function PUT(request: Request) {
  return guardedCanva("integrations:manage", async ({ userId, deps }) => {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new CanvaError("Sélection de modèles invalide.", 400);
    return { choices: await saveChoices(deps, userId, parsed.data.choices) };
  });
}
