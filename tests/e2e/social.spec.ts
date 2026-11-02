import { expect, test } from "@playwright/test";

// Écrans réseaux sociaux repris de BeeMarketing (route /publication), en mode démo : aucun appel réel.
const VIEWS = [
  ["/publication", "Réseaux sociaux"],
  ["/publication?vue=calendrier", "Réseaux sociaux"],
  ["/publication?vue=pilotage", "Pilotage Instagram"],
  ["/publication?vue=carrousels", "Éditeur de visuels"],
  ["/publication?vue=reels", "Montage vidéo"],
  ["/publication?vue=montage", "Montage vidéo"],
] as const;

test("les écrans réseaux sociaux s'affichent sans erreur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [path, heading] of VIEWS) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("un outil se referme et ramène au parcours", async ({ page }) => {
  await page.goto("/publication?vue=pilotage");
  await page.getByRole("button", { name: "← Revenir au parcours" }).click();
  await expect(page).toHaveURL(/\/publication$/);
  await expect(page.getByRole("heading", { name: "Réseaux sociaux" }).first()).toBeVisible();
});

test("les vues non encore transférées le disent clairement", async ({ page }) => {
  await page.goto("/publication?vue=automatisation");
  await expect(page.getByText("pas encore transféré depuis BeeMarketing")).toBeVisible();
});
