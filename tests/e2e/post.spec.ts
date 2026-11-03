import { expect, test, type Page } from "@playwright/test";
import { mockBee } from "./bee-api";

// Onglet Post : routes /api/instagram simulées (aucun appel à Instagram, rien n'est publié).
type Pub = Record<string, unknown> & { id: string; status: string };

async function mockInstagram(page: Page, opts: { connected: boolean; items: Pub[] }) {
  const calls: { method: string; path: string; body: Record<string, unknown> }[] = [];
  let items = [...opts.items];
  await page.route("**/api/instagram/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/instagram", "");
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(req.postData() ?? "{}"); } catch { /* vide */ }
    calls.push({ method: req.method(), path, body });
    if (path === "/connection") return route.fulfill({ json: { connected: opts.connected, username: opts.connected ? "beerecos" : null, expiresAt: null, needsRefresh: false, webhook: { appSecret: false, verifyToken: false, callbackUrl: "https://x/api/webhooks/instagram" } } });
    if (path === "/posts" && req.method() === "GET") return route.fulfill({ json: { items, previews: {} } });
    if (path === "/posts" && req.method() === "POST") {
      const saved = { ...(items.find((i) => i.id === body.id) ?? { id: "p-new", status: "draft", permalink: null, publishedAt: null, error: null, montageId: null }), ...body, updatedAt: "2026-11-03T12:00:00.000Z" } as Pub;
      items = [saved, ...items.filter((i) => i.id !== saved.id)];
      return route.fulfill({ json: { item: saved } });
    }
    const publish = path.match(/^\/posts\/([^/]+)\/publish$/);
    if (publish) {
      items = items.map((i) => (i.id === publish[1] ? { ...i, status: "publishing" } : i));
      return route.fulfill({ json: { item: items.find((i) => i.id === publish[1]) } });
    }
    const one = path.match(/^\/posts\/([^/]+)$/);
    if (one) {
      items = items.map((i) => (i.id === one[1] && i.status === "publishing" ? { ...i, status: "published", permalink: "https://www.instagram.com/p/ABC/", publishedAt: "2026-11-03T12:01:00.000Z" } : i));
      return route.fulfill({ json: { item: items.find((i) => i.id === one[1]), previews: {} } });
    }
    return route.fulfill({ status: 404, json: { error: "non simulé" } });
  });
  return calls;
}

const draft: Pub = { id: "p1", kind: "post", montageId: null, title: "Visite de club", caption: "Viens visiter un club. Commente CLUB !", media: [{ path: "u/a.jpg", type: "image" }], keyword: "CLUB", dmText: "Voici le lien", buttonTitle: null, buttonUrl: null, status: "draft", permalink: null, publishedAt: null, error: null, updatedAt: "2026-11-03T10:00:00.000Z" };

test("Post : un bouton Créer, trois choix, et le formulaire de post simple", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockBee(page);
  const calls = await mockInstagram(page, { connected: false, items: [] });
  await page.goto("/post");
  await expect(page).toHaveTitle(/Post · Instagram BeeRecos/);
  await expect(page.getByText(/Instagram n'est pas encore connecté/)).toBeVisible();
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Que veux-tu créer ?" });
  await expect(dialog.getByRole("link", { name: /Réel IA/ })).toHaveAttribute("href", "/reels/nouveau/ia");
  await expect(dialog.getByRole("link", { name: /Réel filmé/ })).toHaveAttribute("href", "/reels/nouveau/video");
  await dialog.getByRole("button", { name: /Post simple/ }).click();

  const form = page.getByRole("dialog", { name: "Nouveau post" });
  await form.getByLabel("Légende").fill("Viens découvrir un club BeeRecos.");
  await expect(form.getByLabel("Message envoyé en DM")).toHaveCount(0);
  await form.getByLabel(/Mot-clé pour recevoir un DM/).fill("club");
  await expect(form.getByLabel(/Mot-clé pour recevoir un DM/)).toHaveValue("CLUB");
  await form.getByRole("button", { name: "Ajouter « Commente CLUB »" }).click();
  await expect(form.getByLabel("Légende")).toHaveValue(/Commente CLUB/);
  await form.getByLabel("Message envoyé en DM").fill("Voici le lien");
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form.getByText("Brouillon enregistré.")).toBeVisible();
  const save = calls.find((c) => c.method === "POST" && c.path === "/posts");
  expect(save?.body).toMatchObject({ kind: "post", keyword: "CLUB", dmText: "Voici le lien" });
  // Sans connexion ni photo : la fenêtre de publication dit pourquoi et ne publie rien.
  await form.getByRole("button", { name: "Publier sur Instagram" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Publier maintenant sur Instagram ?" });
  await expect(confirm.getByText("Ajoute au moins une photo.")).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Oui, publier" })).toBeDisabled();
  expect(calls.some((c) => c.path.endsWith("/publish"))).toBe(false);
  expect(errors).toEqual([]);
});

test("Post : publier un brouillon demande une confirmation, puis suit Instagram jusqu'au lien public", async ({ page }) => {
  await mockBee(page);
  const calls = await mockInstagram(page, { connected: true, items: [draft] });
  await page.goto("/post");
  await page.getByRole("button", { name: /Visite de club/ }).click();
  const form = page.getByRole("dialog", { name: "Post" });
  await form.getByRole("button", { name: "Publier sur Instagram" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Publier maintenant sur Instagram ?" });
  await expect(confirm.getByText(/public tout de suite/)).toBeVisible();
  await expect(confirm.getByText(/qui commente « CLUB » reçoit ton message/)).toBeVisible();
  await confirm.getByRole("button", { name: "Oui, publier" }).click();
  expect(calls.find((c) => c.path === "/posts/p1/publish")?.body).toEqual({ confirm: true });
  await confirm.getByRole("button", { name: "Fermer" }).click();
  await expect(form.getByText(/Publié sur Instagram/)).toBeVisible({ timeout: 15_000 });
  await expect(form.getByRole("link", { name: /Voir le post/ })).toHaveAttribute("href", "https://www.instagram.com/p/ABC/");
});

test("Paramètres : connexion Instagram et guide intégré", async ({ page }) => {
  await mockBee(page);
  const calls = await mockInstagram(page, { connected: false, items: [] });
  await page.goto("/settings#instagram");
  const section = page.getByRole("region", { name: "Instagram" });
  await expect(section.getByText("Pas encore connecté.")).toBeVisible();
  await expect(section.getByRole("button", { name: "Connecter" })).toBeDisabled();
  await section.getByLabel("Jeton d'accès Instagram").fill("IGAAT-test-jeton-assez-long-pour-le-format");
  await section.getByRole("button", { name: "Connecter" }).click();
  expect(calls.find((c) => c.method === "POST" && c.path === "/connection")?.body).toEqual({ token: "IGAAT-test-jeton-assez-long-pour-le-format" });
  await expect(section.getByText(/Guide : obtenir le jeton/)).toBeVisible();
});
