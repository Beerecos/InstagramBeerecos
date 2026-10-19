import { expect, test } from "@playwright/test";

const PAGES = [
  ["/", "Que voulez-vous accomplir"],
  ["/missions", "Missions de l'équipe"],
  ["/approvals", "Boîte de validation"],
  ["/team", "Votre équipe marketing"],
  ["/studio", "Studio de contenu"],
  ["/video", "Studio vidéo"],
  ["/calendar", "Calendrier marketing"],
  ["/campaigns", "Campagnes"],
  ["/leads", "Suivi des prospects Instagram"],
  ["/analytics", "Ce qui crée des visites"],
  ["/library", "Bibliothèque média"],
  ["/brand", "Mémoire de marque"],
  ["/settings", "Paramètres"],
  ["/settings/integrations", "Intégrations"],
  ["/conversations", "Messagerie Instagram"],
  ["/clubs", "Clubs BeeRecos"],
  ["/systeme", "Exécutions et journal"],
] as const;

test("toutes les sections s'affichent sans erreur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [path, heading] of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
  }
  expect(errors).toEqual([]);
});

test("les anciennes adresses redirigent vers la nouvelle navigation", async ({ page }) => {
  await page.goto("/calendrier");
  await expect(page).toHaveURL(/\/calendar$/);
  await page.goto("/reglages/integrations");
  await expect(page).toHaveURL(/\/settings\/integrations$/);
});

test("les données de démonstration sont identifiées et aucun chiffre n'est inventé", async ({ page }) => {
  await page.goto("/missions");
  await expect(page.getByText("Démo", { exact: true }).first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("table", { name: "Tunnel commercial" })).toContainText("Non disponible");
});

test("Queen Bee crée une vraie mission ; sans Claude, l'équipe attend honnêtement", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Votre objectif").first().fill("Prépare-moi une semaine de contenus Instagram pour générer des visites de clubs");
  await page.getByRole("button", { name: "Lancer la mission" }).first().click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Contenus de la semaine").first()).toBeVisible();
  await expect(page.getByText("Équipe mobilisée", { exact: true })).toBeVisible();
  await expect(page.getByText(/Connexion requise : Claude/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Queen Bee crée la mission/).first()).toBeVisible();
});

test("valider une production depuis la boîte de validation", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "état partagé : un seul projet décide");
  await page.goto("/approvals");
  const card = page.locator("article", { hasText: "Page d'atterrissage, formulaire et relances" }).first();
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  await expect(page.locator("li", { hasText: "Page d'atterrissage, formulaire et relances" }).getByText("Validé")).toBeVisible();
});

test("Queen Bee est accessible partout", async ({ page }) => {
  await page.goto("/team");
  await page.getByRole("button", { name: /Demander à Queen Bee/ }).click();
  await expect(page.getByRole("dialog", { name: "Demander à Queen Bee" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("intégrations : aucune clé exposée, statut « À configurer »", async ({ page }) => {
  await page.goto("/settings/integrations");
  await expect(page.getByText("À configurer").first()).toBeVisible();
  await expect(page.locator("article")).toHaveCount(7);
});

test("webhook Instagram : refus propre quand non configuré", async ({ request }) => {
  const res = await request.get("/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=1");
  expect(res.status()).toBe(503);
});

test("chien de garde : santé, constats réels et inspection manuelle", async ({ page }) => {
  await page.goto("/watchdog");
  await expect(page.getByText("Santé globale")).toBeVisible();
  await expect(page.getByText(/attend : .*vidéo importée/).first()).toBeVisible();
  await page.getByRole("button", { name: "Lancer une inspection" }).click();
  await expect(page.getByText("Santé globale")).toBeVisible();
});

test("cron du Chien de garde : refus sans secret", async ({ request }) => {
  const res = await request.get("/api/cron/watchdog");
  expect(res.status()).toBe(503);
});

test("la Ruche : bureau pixel piloté par l'état réel des agents", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/ruche");
  await expect(page.getByRole("img", { name: /Bureau de l'équipe IA/ })).toBeVisible();
  await expect(page.getByText("Ouverture de la Ruche…")).toBeHidden({ timeout: 15_000 });
  const list = page.getByRole("list", { name: "État des agents" });
  await expect(list.getByRole("listitem")).toHaveCount(12);
  await list.getByRole("button", { name: /Rédacteur/ }).click();
  await expect(page.getByText(/Attend votre validation · « /)).toBeVisible();
  expect(errors).toEqual([]);
});
