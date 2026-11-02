import { expect, test } from "@playwright/test";

// Studio des réels (Instagram BeeRecos), en mode démo : aucun appel réel, aucun serveur de montage configuré.
test("Mes réels est la page d'entrée, avec l'identité Instagram BeeRecos", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Mes réels · Instagram BeeRecos/);
  await expect(page.getByRole("heading", { level: 1, name: "Mes réels" })).toBeVisible();
  const create = page.getByRole("group", { name: "Créer un réel" }).first();
  await expect(create.getByRole("link", { name: "Importer ma vidéo" })).toHaveAttribute("href", "/reels/nouveau/video");
  await expect(create.getByRole("link", { name: "Créer avec l'IA" })).toHaveAttribute("href", "/reels/nouveau/ia");
  await expect(page.getByText(/serveur de montage n'est pas configuré/)).toBeVisible();
  // Plus de barre Queen Bee ni de TopBar issues des missions.
  await expect(page.getByRole("button", { name: /Demander à Queen Bee/ })).toHaveCount(0);
  await expect(page.getByText("Claude à connecter")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("navigation principale : trois destinations", async ({ page, isMobile }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: isMobile ? "Navigation mobile" : "Navigation principale" });
  for (const label of ["Mes réels", "Bibliothèque", "Paramètres"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
  await nav.getByRole("link", { name: "Bibliothèque" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bibliothèque" })).toBeVisible();
  await page.getByRole("navigation", { name: isMobile ? "Navigation mobile" : "Navigation principale" }).getByRole("link", { name: "Paramètres" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Paramètres" })).toBeVisible();
  await expect(page.getByText("Serveur BeeMarketing (Edge Functions, base partagée)")).toBeVisible();
});

test("les deux entrées de création ouvrent le même studio", async ({ page }) => {
  await page.goto("/reels/nouveau/video");
  await expect(page.getByRole("heading", { name: "Montage vidéo" })).toBeAttached();
  await expect(page.getByRole("link", { name: "Découper un tournage" })).toBeVisible();
  await page.goto("/reels/nouveau/ia");
  await expect(page.getByRole("heading", { name: "Montage vidéo" })).toBeAttached();
});

test("les anciens liens sont redirigés en conservant les identifiants", async ({ page }) => {
  await page.goto("/publication?vue=montage&montage=abc-123");
  await expect(page).toHaveURL(/\/reels\/abc-123$/);
  await page.goto("/publication?vue=reels&studioAsset=a1&studioRevision=2&studioKind=motion");
  await expect(page).toHaveURL(/\/reels\/nouveau\/ia\?studioAsset=a1&studioRevision=2&studioKind=motion$/);
  await page.goto("/publication?vue=pilotage");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/video");
  await expect(page).toHaveURL(/\/reels\/nouveau\/video$/);
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/$/);
});

test("autres formats : les carrousels restent accessibles", async ({ page }) => {
  await page.goto("/formats");
  await expect(page.getByRole("heading", { name: "Éditeur de visuels" })).toBeVisible();
});
