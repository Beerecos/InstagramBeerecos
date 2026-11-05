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

test("pistes en plus : clip d'illustration au curseur, cadrage, musique baissée pendant la voix", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "panneaux larges : vérifié sur ordinateur");
  let version = 1;
  let edit = initialEdit("prise.mp4", 6000);
  const saved: typeof edit[] = [];
  const media = [
    { id: "c1", kind: "video", title: "Réunion", fileName: "reunion.mp4", durationMs: 8000, licence: "Pixabay", sourceUrl: null, url: "https://bee-api.test/fichiers/reunion.mp4" },
    { id: "s1", kind: "son", title: "Musique douce", fileName: "musique.mp3", durationMs: 30000, licence: "Pixabay", sourceUrl: null, url: "https://bee-api.test/fichiers/musique.mp3" },
  ];
  await page.route("https://bee-api.test/fichiers/**", (route) => route.fulfill({ status: 404, body: "" }));
  await mockBee(page, {
    "media-list": () => ({ media }),
    get: () => ({ montage: { id: "m4", title: "Prise", status: "ready", durationMs: 6000, keptMs: 6000, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: "https://bee-api.test/fichiers/prise.mp4" }),
    "save-edit": (body) => { edit = body.edit as typeof edit; saved.push(edit); version++; return {}; },
  });
  await page.addInitScript(() => localStorage.setItem("ibr.studio.mode", "avance"));
  await page.goto("/reels/m4");
  await page.getByRole("button", { name: "Médias", exact: true }).click();
  await page.getByRole("button", { name: "Illustrer au curseur" }).click();
  await expect(page.getByText("Tout est enregistré")).toBeVisible();
  expect(saved.at(-1)!.broll).toEqual([{ file: "reunion.mp4", fromMs: 0, toMs: 3000, clipInMs: 0, focusX: 50 }]);
  await expect(page.getByTestId("timeline-broll")).toHaveCount(1);
  await expect(page.locator("hyperframes-player")).toHaveAttribute("srcdoc", /class="broll"/);

  const focus = page.getByLabel("Cadrage horizontal de l'illustration 1");
  await focus.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => saved.at(-1)!.broll?.[0].focusX).toBe(45);

  await page.getByRole("button", { name: "Placer au curseur" }).click();
  await expect.poll(() => saved.at(-1)!.sounds.length).toBe(1);
  await page.getByLabel("Baisser pendant la voix").click();
  await expect.poll(() => saved.at(-1)!.sounds[0].duck).toEqual({ volume: 0.2 });
  await expect(page.locator("hyperframes-player")).toHaveAttribute("srcdoc", /id="sfx-0-0" src="https:\/\/bee-api\.test\/fichiers\/musique\.mp3"[^>]*data-volume="0\.2"[\s\S]*id="sfx-0-1"[^>]*data-volume="1"/);
});

test("prise paysage : je choisis moi-même la partie gardée en 9:16, appliquée et enregistrée", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "glisser à la souris : vérifié sur ordinateur");
  const dir = mkdtempSync(join(tmpdir(), "paysage-"));
  // WebM (VP9) : le Chromium de test ne décode pas toujours le H.264 ; un navigateur normal lit les deux.
  const file = join(dir, "paysage.webm");
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=s=640x360:d=4:r=30", "-c:v", "libvpx-vp9", "-b:v", "200k", "-an", file]);
  const video = readFileSync(file);
  let version = 1;
  let edit = initialEdit("prise.mp4", 4000);
  const saved: typeof edit[] = [];
  // Vidéo intégrée en données : le Chromium de test ne lit pas une vidéo servie par la simulation réseau.
  const videoUrl = `data:video/webm;base64,${video.toString("base64")}`;
  await mockBee(page, {
    get: () => ({ montage: { id: "m5", title: "Prise paysage", status: "ready", durationMs: 4000, keptMs: 4000, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS.slice(0, 4), canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl }),
    "save-edit": (body) => { edit = body.edit as typeof edit; saved.push(edit); version++; return {}; },
  });
  await page.goto("/reels/m5");
  // Prise paysage pas encore cadrée : la fenêtre de cadrage s'ouvre d'elle-même.
  const dialog = page.getByRole("dialog", { name: "Recadrer en 9:16" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  const win = dialog.getByTestId("framing-window");
  const source = (await dialog.getByTestId("framing-source").boundingBox())!;
  const w = (await win.boundingBox())!;
  // Cadre 9:16 dans une image 16:9 : environ 32 % de la largeur, toute la hauteur.
  expect(w.width / source.width).toBeGreaterThan(0.28);
  expect(w.width / source.width).toBeLessThan(0.36);
  await page.mouse.move(w.x + w.width / 2, w.y + w.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width + 40, w.y + w.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(dialog.getByTestId("framing-result").locator("video")).toHaveAttribute("style", /object-position: 100% 50%/);
  await dialog.getByRole("button", { name: "Appliquer le cadrage" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => saved.at(-1)?.framing?.focusX).toBe(100);
  await expect(page.locator("hyperframes-player").filter({ visible: true })).toHaveAttribute("srcdoc", /object-position: 100% 50%/);

  // Zoom 200 % puis cadre tout en bas : le cadrage vertical est enregistré (il était ignoré avant).
  await page.getByRole("button", { name: "Recadrer la vidéo" }).filter({ visible: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Zoom").fill("2");
  const w2 = (await win.boundingBox())!;
  expect(w2.height / source.height).toBeCloseTo(0.5, 1);
  await win.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("Shift+ArrowDown");
  await dialog.getByRole("button", { name: "Appliquer le cadrage" }).click();
  await expect.poll(() => saved.at(-1)?.framing?.scale).toBe(2);
  expect(saved.at(-1)!.framing!.y).toBeLessThan(0);
});

test("studio simple : quatre étapes, couleurs des sous-titres en un clic, mode avancé à la demande", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let version = 1;
  let edit = initialEdit("prise.mp4", 12000);
  const saved: typeof edit[] = [];
  await mockBee(page, {
    get: () => ({ montage: { id: "m7", title: "Prise", status: "ready", durationMs: 12000, keptMs: 12000, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: null }),
    "save-edit": (body) => { edit = body.edit as typeof edit; saved.push(edit); version++; return {}; },
  });
  await page.goto("/reels/m7");
  const steps = page.getByRole("navigation", { name: "Étapes du montage" }).filter({ visible: true });
  for (const name of [/Cadrage/, /Coupes/, /Sous-titres/, /Animations/]) await expect(steps.getByRole("button", { name })).toBeVisible();
  // Les outils avancés sont masqués.
  await expect(page.getByRole("button", { name: "⚡ Tout auto" }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Réglages de la sélection" }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Terminer →" }).filter({ visible: true })).toBeVisible();

  await steps.getByRole("button", { name: /Sous-titres/ }).click();
  await page.getByRole("radiogroup", { name: "Couleurs des sous-titres" }).filter({ visible: true }).getByRole("radio", { name: /Bleu BeeRecos/ }).click();
  await expect.poll(() => saved.at(-1)?.captionStyle.backgroundColor).toBe("#2851FF");
  await page.getByRole("radiogroup", { name: "Taille des sous-titres" }).filter({ visible: true }).getByRole("radio", { name: "Grand" }).click();
  await expect.poll(() => saved.at(-1)?.captionStyle.fontSize).toBe(64);

  await steps.getByRole("button", { name: /Animations/ }).click();
  await expect(page.getByRole("button", { name: "+ Ajouter une animation" }).filter({ visible: true })).toBeVisible();
  // Standard v1 posé automatiquement (brouillon) : accroche reprise de ce qui est dit (onglet sans détourage), logo de fin.
  const list = page.getByRole("list", { name: "Animations du réel" }).filter({ visible: true });
  await expect(list.getByRole("button", { name: /^Onglet \(cartouche\) ·/ })).toBeVisible();
  await expect(list.getByRole("button", { name: /^Logo BeeRecos de fin ·/ })).toBeVisible();
  // Posé et enregistré dès l'ouverture : les autres étapes ne sont pas bloquées.
  await expect.poll(() => saved.at(-1)?.custom.map((c) => c.name)).toEqual(["onglet", "logo-fin"]);
  expect(saved.at(-1)?.custom[0].props).toMatchObject({ texte: "BEERECOS", variante: "blanc" });

  await page.getByRole("button", { name: "Mode avancé" }).filter({ visible: true }).click();
  await expect(page.getByRole("button", { name: "⚡ Tout auto" }).filter({ visible: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ibr.studio.mode"))).toBe("avance");
  expect(errors).toEqual([]);
});
