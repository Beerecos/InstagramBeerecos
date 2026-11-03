import { body, guarded } from "@/server/instagram/http";
import { advance, saveDraft, strip } from "@/server/instagram/service";
import { previewUrls } from "@/server/instagram/store";

/** Toutes les créations de l'onglet Post ; celles en cours de publication avancent à la lecture. */
export function GET() {
  return guarded("content:edit", async ({ userId, deps }) => {
    const rows = await deps.store.list(userId);
    const items = await Promise.all(rows.map((r) => (r.status === "publishing" ? advance(deps, userId, r.id) : strip(r))));
    const previews = await previewUrls(items.flatMap((p) => p.media.slice(0, 1).map((m) => m.path)));
    return { items, previews };
  });
}

export function POST(request: Request) {
  return guarded("content:edit", async ({ userId, deps }) => ({ item: await saveDraft(deps, userId, (await body(request)) as Parameters<typeof saveDraft>[2]) }));
}
