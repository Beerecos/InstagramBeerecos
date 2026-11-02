import { describe, expect, it } from "vitest";
import { getRender, startRender, UNAVAILABLE } from "@/lib/social/reel-render-client";
import { DEMO_STORY } from "@/domain/social/reel-story";

const reply = (body: unknown, status = 200, type = "application/json") =>
  (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": type } })) as unknown as typeof fetch;

describe("client du rendu des Reels", () => {
  it("lance une génération et lit son état", async () => {
    expect(await startRender(DEMO_STORY, reply({ id: "j1" }, 202))).toEqual({ id: "j1" });
    const job = await getRender("j1", reply({ id: "j1", state: "done", step: "Terminé", progress: 100, url: "/api/reels/files/a.mp4", voice: {}, warnings: [] }));
    expect(job.url).toBe("/api/reels/files/a.mp4");
  });

  it("explique quand le service de rendu n'existe pas (application statique)", async () => {
    await expect(startRender(DEMO_STORY, reply("<!doctype html>", 200, "text/html"))).rejects.toThrow(UNAVAILABLE);
    await expect(startRender(DEMO_STORY, (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch)).rejects.toThrow(UNAVAILABLE);
  });

  it("remonte les erreurs de validation du serveur", async () => {
    await expect(startRender(DEMO_STORY, reply({ error: "La vidéo ne peut pas être générée.", errors: ["Accroche : texte manquant."] }, 400)))
      .rejects.toThrow("La vidéo ne peut pas être générée. Accroche : texte manquant.");
  });
});
