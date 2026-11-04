import "server-only";
import { imageError, imagePrompt, ImageRequestSchema } from "@/domain/instagram/visual-prompt";
import { UserError } from "./service";

type Options = { key?: string; model?: string; quality?: "low" | "medium" | "high"; fetchImpl?: typeof fetch };

/**
 * Génère une image réaliste 1024 × 1536 (portrait) avec OpenAI Images. WebP compressé (< 1 Mo) pour tenir dans la
 * réponse ; fond transparent pour un objet détouré. Rien n'est stocké : l'image sert seulement à composer la slide.
 */
export async function generateImage(input: unknown, o: Options): Promise<{ b64: string; mime: string; model: string }> {
  if (!o.key) throw new UserError("Génération d'images non configurée : ajoute OPENAI_API_KEY sur Vercel (voir Paramètres).", 503);
  const parsed = ImageRequestSchema.safeParse(input);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Description illisible.");
  const req = parsed.data;
  const model = o.model || "gpt-image-1";
  const res = await (o.fetchImpl ?? fetch)("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${o.key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model, prompt: imagePrompt(req), n: 1, size: "1024x1536", quality: o.quality ?? "medium",
      background: req.mode === "produit" ? "transparent" : "opaque", output_format: "webp", output_compression: 85, moderation: "auto",
    }),
    signal: AbortSignal.timeout(170_000),
  });
  if (!res.ok) throw new UserError(imageError(res.status, (await res.text()).slice(0, 600)), 502);
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new UserError("OpenAI n'a renvoyé aucune image : relance la génération.", 502);
  return { b64, mime: "image/webp", model };
}
