import type { Page, Route } from "@playwright/test";

/** Double de la fonction serveur `montage` (et des autres Edge Functions) : aucune donnée réelle, aucun appel externe. */
export type Handler = (body: Record<string, unknown>, route: Route) => unknown | Promise<unknown>;
const DEFAULTS: Record<string, unknown> = {
  list: { montages: [] }, "asset-list": { assets: [] }, "reels-list": { reels: [] }, "media-list": { media: [] },
  "settings-get": { settings: { accent: "bleu", subtitles: true, zoomCoupes: false, captionStyle: {}, rules: [] }, services: { transcription: true, claude: false, rendu: false, ressources: true }, memory: [] },
  "motion-library": { kept: [], usage: {} },
};
export async function mockBee(page: Page, handlers: Record<string, Handler> = {}) {
  const calls: Record<string, unknown>[] = [];
  // Les parcours historiques testent le studio guidé en 5 étapes ; le nouveau studio (défaut depuis le 2026-11-12)
  // a ses propres tests (studio-v2.spec.ts), qui choisissent leur mode après cet appel.
  await page.addInitScript(() => { try { if (!localStorage.getItem("ibr.studio.mode")) localStorage.setItem("ibr.studio.mode", "etapes"); } catch { /* stockage indisponible */ } });
  await page.route("https://bee-api.test/**", async (route) => {
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(route.request().postData() ?? "{}"); } catch { /* corps vide */ }
    calls.push(body);
    const action = String(body.action ?? "");
    const handler = handlers[action];
    const result = handler ? await handler(body, route) : DEFAULTS[action];
    if (result === undefined) return route.fulfill({ status: 400, json: { error: `Action non simulée : ${action}` } });
    if (result === "handled") return;
    return route.fulfill({ status: 200, json: { ok: true, ...(result as object) } });
  });
  return calls;
}
