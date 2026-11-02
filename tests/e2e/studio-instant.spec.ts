import { expect, test } from "@playwright/test";
import { mockBee } from "./bee-api";
import { initialEdit } from "../../src/domain/social/montage/montage";

const WORDS = ["Bonjour", "euh", "je", "suis", "Cédric", "et", "voici", "BeeRecos."].map((text, i) => ({ text, startMs: i * 700, endMs: i * 700 + 500 }));

test("montage instantané : la coupe s'affiche tout de suite, l'enregistrement suit, Ctrl+Z annule", async ({ page }) => {
  let version = 1;
  let edit = initialEdit("prise.mp4", 6000);
  let release: () => void = () => {};
  const held = new Promise<void>((r) => { release = r; });
  let saves = 0;
  const detail = () => ({
    montage: { id: "m1", title: "Prise test", status: "ready", durationMs: 6000, keptMs: edit.ranges.reduce((n, r) => n + r.toMs - r.fromMs, 0), workspaceId: null,
      createdAt: "2026-11-02T10:00:00.000Z", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null,
      edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null },
    videoUrl: "https://bee-api.test/fichiers/prise.mp4",
  });
  const calls = await mockBee(page, {
    get: () => detail(),
    "save-edit": async (body) => {
      expect(body.baseUpdatedAt).toBe(`v${version}`);
      saves++;
      if (saves === 1) await held; // premier enregistrement lent : l'interface ne doit pas attendre
      edit = body.edit as typeof edit; version++;
      return {};
    },
  });
  await page.goto("/reels/m1");
  const words = page.getByRole("textbox", { name: "Mots de la prise" });
  await expect(words).toBeVisible();
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  await words.locator("[data-word='1']").click();
  await page.getByRole("button", { name: "Couper la sélection" }).click();
  // Instantané : le mot est barré et la durée a changé avant toute réponse du serveur.
  await expect(words.locator("[data-word='1']")).toHaveClass(/line-through/);
  await expect(page.getByText("Enregistrement en arrière-plan…")).toBeVisible();
  release();
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  expect(calls.filter((c) => c.action === "save-edit")).toHaveLength(1);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  await expect(words.locator("[data-word='1']")).not.toHaveClass(/line-through/);
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  expect(calls.filter((c) => c.action === "save-edit")).toHaveLength(2);
  expect(edit.ranges).toEqual([{ fromMs: 0, toMs: 6000 }]);
});

test("montage instantané : une modification faite ailleurs est signalée, jamais écrasée", async ({ page }) => {
  const edit = initialEdit("prise.mp4", 6000);
  await mockBee(page, {
    get: () => ({ montage: { id: "m2", title: "Prise", status: "ready", durationMs: 6000, keptMs: 6000, workspaceId: null, createdAt: "t", updatedAt: "v1", renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: "https://bee-api.test/fichiers/prise.mp4" }),
    "save-edit": (_b, route) => route.fulfill({ status: 409, json: { error: "Le montage a changé depuis l'ouverture : rechargez." } }).then(() => "handled"),
  });
  await page.goto("/reels/m2");
  const words = page.getByRole("textbox", { name: "Mots de la prise" });
  await words.locator("[data-word='2']").click();
  await page.getByRole("button", { name: "Couper la sélection" }).click();
  await expect(page.getByText(/Modifié ailleurs : tes derniers changements ne sont pas enregistrés/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Recharger la version du serveur" })).toBeVisible();
});
