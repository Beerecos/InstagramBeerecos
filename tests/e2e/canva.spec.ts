import { expect, test, type Page } from "@playwright/test";

// Canva dans l'onglet Post : routes /api/canva et /api/instagram simulées (aucun appel à Canva, rien n'est publié).
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

async function mock(page: Page, view: Record<string, unknown>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  await page.route("**/api/linkedin/connection", (r) => r.fulfill({ json: { connected: false, name: null, expiresAt: null, page: { configured: false, allowed: false } } }));
  await page.route("**/api/instagram/**", (r) => r.fulfill({ json: { connected: false, username: null, expiresAt: null, needsRefresh: false, webhook: {} } }));
  await page.route("**/api/canva/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/canva", "");
    calls.push({ method: req.method(), path, body: req.postDataJSON?.() ?? null });
    if (path === "/connection") return route.fulfill({ json: view });
    if (path === "/templates") return route.fulfill({ json: { templates: [{ id: "EAGgsOdRFIY", title: "Carrousel Linkedin", thumbnailUrl: PIXEL }] } });
    if (path === "/templates/EAGgsOdRFIY") return route.fulfill({ json: { fields: [{ name: "Thematique", type: "text" }, { name: "Texte 1", type: "text" }, { name: "Photo", type: "image" }] } });
    if (path === "/visuals") return route.fulfill({ json: { paths: ["u/a.jpg", "u/b.jpg"], previews: { "u/a.jpg": PIXEL, "u/b.jpg": PIXEL }, editUrl: "https://www.canva.com/design/D1/edit", designId: "D1", pages: 2, missing: ["Texte 1"] } });
    return route.fulfill({ status: 404, json: { error: "non simulé" } });
  });
  return calls;
}

const CONNECTED = { appConfigured: true, connected: true, name: "Compte Canva", autofill: true, brandTemplates: true };

test("Post : créer le visuel avec Canva remplit le modèle et ajoute ses pages en carrousel, sans publier", async ({ page }) => {
  const calls = await mock(page, CONNECTED);
  await page.goto("/post/nouveau");
  const panel = page.getByRole("region", { name: "Créer le visuel avec Canva" });
  await panel.getByRole("button", { name: "Choisir un modèle Canva" }).click();
  await panel.getByRole("button", { name: /Carrousel Linkedin/ }).click();
  await expect(panel.getByLabel("Thematique")).toBeVisible();
  await expect(panel.getByText(/zones image du modèle gardent/)).toBeVisible();
  const create = panel.getByRole("button", { name: "Créer le visuel" });
  await expect(create).toBeDisabled();
  await panel.getByLabel("Thematique").fill("Le réseau qui recommande");
  await create.click();
  await expect(page.getByText(/Visuel Canva ajouté : 2 image\(s\)/)).toBeVisible();
  await expect(page.getByText(/zones laissées vides : Texte 1/)).toBeVisible();
  await expect(panel.getByRole("link", { name: "Retoucher ce design dans Canva" })).toHaveAttribute("href", "https://www.canva.com/design/D1/edit");
  expect(calls.find((c) => c.path === "/visuals")?.body).toMatchObject({ templateId: "EAGgsOdRFIY", texts: { Thematique: "Le réseau qui recommande" } });
  await expect(page.getByRole("button", { name: "Retirer la photo 2" })).toBeVisible();
  expect(calls.some((c) => /publish/.test(c.path))).toBe(false);
});

test("Post : Canva non connecté ou compte sans remplissage automatique, état honnête", async ({ page }) => {
  await mock(page, { appConfigured: true, connected: false, name: null, autofill: null, brandTemplates: null });
  await page.goto("/post/nouveau");
  const panel = page.getByRole("region", { name: "Créer le visuel avec Canva" });
  await expect(panel.getByText("Canva n'est pas connecté.")).toBeVisible();
  await expect(panel.getByRole("link", { name: "Paramètres → Canva" })).toHaveAttribute("href", "/settings#canva");
});

test("Paramètres : carte Canva, guide et adresse de retour", async ({ page }) => {
  await mock(page, { appConfigured: false, connected: false, name: null, autofill: null, brandTemplates: null });
  await page.goto("/settings");
  const card = page.getByRole("region", { name: "Canva" });
  await expect(card.getByText("L'intégration Canva n'est pas encore configurée sur le serveur.")).toBeVisible();
  await card.getByText("Guide : créer l'intégration Canva (une seule fois)").click();
  await expect(card.getByText(/\/api\/canva\/callback/)).toBeVisible();
});
