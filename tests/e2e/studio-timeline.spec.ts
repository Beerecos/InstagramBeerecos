import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mockBee } from "./bee-api";
import { initialEdit } from "../../src/domain/social/montage/montage";

const WORDS = ["Bonjour", "je", "suis", "Cédric", "et", "voici", "BeeRecos."].map((text, i) => ({ text, startMs: i * 800, endMs: i * 800 + 600 }));

test("timeline : forme d'onde, couper au curseur (S), retirer et tirer un morceau, tout enregistré", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "glisser à la souris : vérifié sur ordinateur");
  const dir = mkdtempSync(join(tmpdir(), "prise-"));
  const file = join(dir, "prise.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=black:s=108x192:d=6:r=30", "-f", "lavfi", "-i", "sine=f=440:d=6", "-c:v", "libx264", "-c:a", "aac", "-shortest", file]);
  const video = readFileSync(file);
  let version = 1;
  let edit = initialEdit("prise.mp4", 6000);
  const saved: typeof edit[] = [];
  await page.route("https://bee-api.test/fichiers/**", (route) => route.fulfill({ status: 200, body: video, headers: { "content-type": "video/mp4", "access-control-allow-origin": "*", "content-length": String(video.length) } }));
  await mockBee(page, {
    get: () => ({ montage: { id: "m1", title: "Prise", status: "ready", durationMs: 6000, keptMs: 6000, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: "https://bee-api.test/fichiers/prise.mp4" }),
    "save-edit": (body) => { edit = body.edit as typeof edit; saved.push(edit); version++; return {}; },
  });
  await page.goto("/reels/m1");
  const timeline = page.getByTestId("studio-timeline");
  await expect(timeline.getByTestId("timeline-piece")).toHaveCount(1);
  // Forme d'onde décodée depuis la prise (piste Vidéo).
  await expect(timeline.locator("[data-testid='timeline-piece'] svg polygon")).toHaveCount(1, { timeout: 15_000 });

  // Place la tête de lecture au milieu (clic sur la piste Temps), puis S.
  const ruler = timeline.locator("div.relative.shrink-0").first();
  await ruler.scrollIntoViewIfNeeded();
  const box = (await ruler.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 10);
  await expect(page.getByTestId("timeline-timecode")).not.toContainText(/^0:00\.00/);
  await page.locator("body").click({ position: { x: 3, y: 3 } });
  await page.keyboard.press("s");
  await expect(timeline.getByTestId("timeline-piece")).toHaveCount(2);
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  expect(saved.at(-1)!.ranges).toHaveLength(2);
  expect(saved.at(-1)!.ranges[0].toMs).toBe(saved.at(-1)!.ranges[1].fromMs); // rien n'a été retiré

  // Tirer la fin du premier morceau vers la gauche : un trou apparaît dans la prise, la prise originale reste intacte.
  await timeline.getByTestId("timeline-piece").first().click();
  const handle = page.getByRole("button", { name: "Tirer la fin du morceau 1" });
  await handle.scrollIntoViewIfNeeded();
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x - 60, h.y + h.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  const trimmed = saved.at(-1)!.ranges;
  expect(trimmed[0].toMs).toBeLessThan(trimmed[1].fromMs);

  // Retirer le deuxième morceau (Suppr) puis annuler (Ctrl+Z).
  await timeline.getByTestId("timeline-piece").nth(1).click();
  await page.keyboard.press("Delete");
  await expect(timeline.getByTestId("timeline-piece")).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(timeline.getByTestId("timeline-piece")).toHaveCount(2);
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  expect(saved.at(-1)!.ranges).toEqual(trimmed);
  expect(saved.every((e) => e.video === "prise.mp4")).toBe(true);
});

test("raccourcis de monteur : image par image, I / O puis X coupe la zone", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "clavier physique : vérifié sur ordinateur");
  let version = 1;
  let edit = initialEdit("prise.mp4", 6000);
  const saved: typeof edit[] = [];
  await mockBee(page, {
    get: () => ({ montage: { id: "m3", title: "Prise", status: "ready", durationMs: 6000, keptMs: 6000, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: "https://bee-api.test/fichiers/prise.mp4" }),
    "save-edit": (body) => { edit = body.edit as typeof edit; saved.push(edit); version++; return {}; },
  });
  await page.goto("/reels/m3");
  const tc = page.getByTestId("timeline-timecode");
  await expect(tc).toContainText("0:00.00 / 0:06.00");
  await page.locator("body").click({ position: { x: 3, y: 3 } });
  await page.keyboard.press("ArrowRight");
  await expect(tc).toContainText(/^0:00\.01/);
  await page.keyboard.press("Shift+ArrowRight");
  await expect(tc).toContainText(/^0:01\.01/);
  await page.keyboard.press("End");
  await expect(tc).toContainText(/^0:06\.00/);
  await page.keyboard.press("Home");
  await expect(tc).toContainText(/^0:00\.00/);
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("i");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("o");
  await expect(page.getByTestId("timeline-zone")).toBeVisible();
  await expect(page.getByTestId("timeline-zone-label")).toContainText("0:01.00 → 0:03.00");
  await page.keyboard.press("j");
  await expect(tc).toContainText(/^0:02\.00/);
  await page.keyboard.press("x");
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  expect(saved.at(-1)!.ranges).toEqual([{ fromMs: 0, toMs: 1000 }, { fromMs: 3000, toMs: 6000 }]);
  await expect(page.getByTestId("timeline-zone")).toHaveCount(0);
  await expect(tc).toContainText("/ 0:04.00");
});
