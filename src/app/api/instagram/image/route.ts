import { serverEnv } from "@/lib/env/server";
import { body, guarded } from "@/server/instagram/http";
import { generateImage } from "@/server/instagram/image";

export const maxDuration = 180;

/** Photo réaliste générée par OpenAI pour une slide de carrousel (clé côté serveur uniquement). */
export async function POST(request: Request) {
  return guarded("content:edit", async () => {
    const env = serverEnv();
    return generateImage(await body(request), { key: env.OPENAI_API_KEY, model: env.OPENAI_IMAGE_MODEL, quality: env.OPENAI_IMAGE_QUALITY });
  });
}
