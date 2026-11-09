import { z } from "zod";
import { CanvaError } from "@/server/canva/api";
import { guardedCanva } from "@/server/canva/http";
import { createVisual, MAX_TEXT } from "@/server/canva/service";
import { previewUrls } from "@/server/instagram/store";

export const maxDuration = 120;

const Body = z.strictObject({
  templateId: z.string().regex(/^[\w-]{3,64}$/),
  title: z.string().trim().max(255).default("Post BeeRecos"),
  texts: z.record(z.string().max(80), z.string().max(MAX_TEXT)),
});

/** Crée le visuel du post avec Canva (modèle rempli, exporté en JPG, déposé dans les photos du post). Ne publie rien. */
export async function POST(request: Request) {
  return guardedCanva("content:edit", async ({ userId, deps }) => {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new CanvaError("Demande Canva invalide.", 400);
    const r = await createVisual(deps, userId, parsed.data);
    return { ...r, previews: await previewUrls(r.paths) };
  });
}
