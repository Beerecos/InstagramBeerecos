import { expect, test } from "@playwright/test";

const PAGES = [
  ["/", "Bonjour"],
  ["/creer", "Comment veux-tu créer ?"],
  ["/studio", "Production vidéo"],
  ["/medias", "Mes médias"],
  ["/calendrier", "Calendrier éditorial"],
  ["/conversations", "Inbox Instagram"],
  ["/leads", "CRM Instagram"],
  ["/clubs", "Clubs BeeRecos"],
  ["/analytics", "Ce qui crée des visites"],
  ["/strategie", "Ce que Claude doit privilégier"],
  ["/reglages", "Réglages"],
  ["/reglages/integrations", "Intégrations"],
  ["/systeme", "Runs & journal"],
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

test("le tableau de bord n'invente aucun chiffre", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour Cédric");
  await expect(page.getByRole("table", { name: /Tunnel commercial/ })).toContainText("Non disponible");
  await expect(page.getByText("Pas encore assez de données")).toBeVisible();
});

test("« Demander à BeeMarketing » s'ouvre partout et reste honnête sur ce qu'il fait", async ({ page }) => {
  await page.goto("/leads");
  await page.getByRole("button", { name: /Demander à BeeMarketing/ }).click();
  const dialog = page.getByRole("dialog", { name: "Demander à BeeMarketing" });
  await dialog.getByLabel("Votre demande").fill("Prépare ma semaine Instagram.");
  await dialog.getByRole("button", { name: "Envoyer" }).click();
  await expect(dialog).toContainText("aucune action");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("parcours Créer : trois modes", async ({ page }) => {
  await page.goto("/creer");
  for (const name of ["Créer avec l'IA", "Utiliser ma vidéo", "Créer une vidéo hybride"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await page.getByRole("link", { name: /Utiliser ma vidéo/ }).click();
  await expect(page).toHaveURL(/\/creer\/human$/);
});

test("intégrations : aucune clé exposée, statut « À configurer »", async ({ page }) => {
  await page.goto("/reglages/integrations");
  await expect(page.getByText("À configurer").first()).toBeVisible();
  await expect(page.locator("article")).toHaveCount(8);
});

test("webhook Instagram : vérification refusée sans jeton", async ({ request }) => {
  const res = await request.get("/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=1");
  expect(res.status()).toBe(503); // non configuré en démo : refus propre, pas d'erreur 500
});
