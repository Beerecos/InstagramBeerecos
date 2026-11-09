import { expect, test, type Page } from "@playwright/test";

// Canva dans l'onglet Post : routes /api/canva et /api/instagram simulées (aucun appel à Canva, rien n'est publié).
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

async function mock(page: Page, view: Record<string, unknown>, initial: { id: string; kind: string }[] = []) {
  let choices = [...initial];
  const calls: { method: string; path: string; body: unknown }[] = [];
  await page.route("**/api/linkedin/connection", (r) => r.fulfill({ json: { connected: false, name: null, expiresAt: null, page: { configured: false, allowed: false } } }));
  await page.route("**/api/instagram/**", (r) => r.fulfill({ json: { connected: false, username: null, expiresAt: null, needsRefresh: false, webhook: {} } }));
  await page.route("**/api/canva/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/canva", "");
    calls.push({ method: req.method(), path, body: req.postDataJSON?.() ?? null });
    if (path === "/connection") return route.fulfill({ json: view });
    if (path === "/templates") return route.fulfill({ json: { configured: choices.length > 0, templates: [
      { id: "EAGgsOdRFIY", title: "Carrousel Linkedin", thumbnailUrl: PIXEL, editUrl: "https://www.canva.com/brand/brand-templates/EAGgsOdRFIY", kind: choices.find((c) => c.id === "EAGgsOdRFIY")?.kind ?? null },
      { id: "EAGpost0001", title: "Citation du jour", thumbnailUrl: PIXEL, editUrl: null, kind: choices.find((c) => c.id === "EAGpost0001")?.kind ?? null },
    ] } });
    if (path === "/choices" && req.method() === "PUT") { choices = (req.postDataJSON() as { choices: { id: string; kind: string }[] }).choices; return route.fulfill({ json: { choices } }); }
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
  await expect(panel.getByText(/Tous tes modèles sont proposés/)).toBeVisible();
  await panel.getByRole("button", { name: /Carrousel Linkedin/ }).click();
  await expect(panel.getByLabel("Thematique")).toBeVisible();
  const modify = panel.getByRole("link", { name: "Modifier ce modèle dans Canva" });
  await expect(modify).toHaveAttribute("href", "https://www.canva.com/brand/brand-templates/EAGgsOdRFIY");
  await expect(modify).toHaveAttribute("target", "_blank");
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

test("Paramètres : choisir les modèles du Studio, puis l'onglet Post ne propose que ceux du bon format", async ({ page }) => {
  const calls = await mock(page, CONNECTED);
  await page.goto("/settings");
  const list = page.getByRole("list", { name: "Modèles Canva du Studio" });
  await list.getByLabel("Format de Carrousel Linkedin").selectOption("carrousel");
  await list.getByLabel("Format de Citation du jour").selectOption("post");
  await page.getByRole("button", { name: "Enregistrer mes modèles" }).click();
  await expect(page.getByText(/2 modèle\(s\) retenu\(s\)/)).toBeVisible();
  expect(calls.find((c) => c.path === "/choices")?.body).toEqual({ choices: [{ id: "EAGgsOdRFIY", title: "Carrousel Linkedin", kind: "carrousel" }, { id: "EAGpost0001", title: "Citation du jour", kind: "post" }] });

  // Post simple : seul le modèle « post » ; carrousel : seul le modèle « carrousel ».
  await page.goto("/post/nouveau");
  let panel = page.getByRole("region", { name: "Créer le visuel avec Canva" });
  await panel.getByRole("button", { name: "Choisir un modèle Canva" }).click();
  await expect(panel.getByRole("button", { name: /Citation du jour/ })).toBeVisible();
  await expect(panel.getByRole("button", { name: /Carrousel Linkedin/ })).toHaveCount(0);
  await page.goto("/post/nouveau?format=carrousel");
  panel = page.getByRole("region", { name: "Créer le visuel avec Canva" });
  await panel.getByRole("button", { name: "Choisir un modèle Canva" }).click();
  await expect(panel.getByRole("button", { name: /Carrousel Linkedin/ })).toBeVisible();
  await expect(panel.getByRole("button", { name: /Citation du jour/ })).toHaveCount(0);
});
