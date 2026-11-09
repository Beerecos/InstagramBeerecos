import { guardedCanva } from "@/server/canva/http";
import { templates } from "@/server/canva/service";

/** Modèles de marque Canva qui ont des zones remplissables. */
export function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return guardedCanva("content:edit", async ({ deps }) => templates(deps, q));
}
