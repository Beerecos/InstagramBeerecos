import { expect, test } from "@playwright/test";
import { DEMO_MOTION } from "../../src/domain/social/reel-story/motion-spec";
import { DEMO_STORY } from "../../src/domain/social/reel-story/spec";
import { mockBee } from "./bee-api";

for (const kind of ["motion", "story"] as const) {
  test(`la source ${kind} se rouvre depuis son montage puis une création abandonne ses identifiants`, async ({ page }) => {
    const source = { assetId: `source-${kind}`, kind, revision: 2 };
    const data = { ...(kind === "motion" ? DEMO_MOTION : DEMO_STORY), title: "Projet historique" };
    const calls = await mockBee(page, {
      get: () => ({ montage: { id: "m1", title: "Montage historique", status: "ready", durationMs: 40000, keptMs: 40000, workspaceId: null, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-02T10:00:00Z", renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: { source, verified: true }, edit: null, captions: [], canUndo: false, error: null, renderError: null }, videoUrl: null }),
      "asset-get": () => ({ asset: { id: source.assetId, revision: 2, kind, title: data.title, data, status: "draft" } }),
    });
    await page.goto("/reels/m1");
    await page.getByRole("button", { name: "Rouvrir la source IA" }).click();
    await expect(page).toHaveURL(new RegExp(`/reels/nouveau/ia\\?studioAsset=source-${kind}&studioRevision=2&studioKind=${kind}$`));
    await expect(page.getByRole("textbox", { name: kind === "motion" ? "Sujet (titre interne)" : "Titre du contenu", exact: true })).toHaveValue("Projet historique");
    if (kind === "story") {
      await page.getByRole("button", { name: "Reprendre en scènes" }).click();
      await expect(page.getByText("Audrey · voix obligatoire des Reels IA")).toBeVisible();
    }
    await page.getByRole("navigation", { name: "Fil d'Ariane" }).getByRole("link", { name: "Mes réels" }).click();
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await page.getByRole("dialog").getByRole("link", { name: /Réel IA/ }).click();
    await expect(page).toHaveURL(/\/reels\/nouveau\/ia$/);
    // Nouvelle création : le Studio IA simple, sans rien de la source précédente.
    await expect(page.getByLabel("Mon idée")).toHaveValue("");
    await expect(page.getByText("Audrey · voix obligatoire des Reels IA")).toHaveCount(0);
    await expect(page.getByRole("radiogroup", { name: "Style de la vidéo IA" })).toHaveCount(0);
    expect(calls.filter((c) => c.action === "asset-get").every((c) => c.assetId === source.assetId && c.revision === 2)).toBe(true);
    expect(calls.some((c) => /render|generate|publish|asset-save/.test(String(c.action)))).toBe(false);
  });
}

test("100 projets Motion ne masquent pas les projets Recommandation", async ({ page }) => {
  const calls = await mockBee(page, {
    "asset-list": (b) => ({ assets: b.kind === "motion" ? Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, kind: "motion", title: `Motion ${i}`, revision: 1, status: "draft" })) : b.kind === "story" ? [{ id: "ancien", kind: "story", title: "Ancienne recommandation", revision: 4, status: "draft" }] : [] }),
  });
  await page.goto("/reels");
  await expect(page.getByRole("link", { name: /Ancienne recommandation/ })).toHaveAttribute("href", "/reels/nouveau/ia?studioAsset=ancien&studioRevision=4&studioKind=story");
  expect(calls.filter((c) => c.action === "asset-list").map((c) => c.kind).sort()).toEqual(["motion", "story"]);
});
