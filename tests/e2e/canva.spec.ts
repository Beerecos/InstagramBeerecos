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
    if (path === "/templates") return route.fulfill({ json: { templates: [
      { id: "EAGgsOdRFIY", title: "Carrousel Linkedin", thumbnailUrl: PIXEL, editUrl: "https://www.canva.com/brand/brand-templates/EAGgsOdRFIY" },
      { id: "EAHab7SU6Jw", title: "Gazette Beerecos Post Instagram", thumbnailUrl: PIXEL, editUrl: "https://www.canva.com/brand/brand-templates/EAHab7SU6Jw" },
    ] } });
    if (path === "/templates/EAGgsOdRFIY" || path === "/templates/EAHab7SU6Jw") return route.fulfill({ json: { fields: [{ name: "Thematique", type: "text" }, { name: "Texte 1", type: "text" }, { name: "Photo", type: "image" }] } });
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
  // Post simple : seuls les modèles de post ; carrousel : seuls les modèles carrousel (on ne confond pas).
  await panel.getByRole("button", { name: "Choisir un modèle Canva post" }).click();
  await expect(panel.getByRole("button", { name: /Gazette Beerecos Post Instagram/ })).toBeVisible();
  await expect(panel.getByRole("button", { name: /Carrousel Linkedin/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /Carrousel/ }).click();
  await expect(panel.getByRole("list", { name: "Modèles Canva carrousel" })).toBeVisible();
  await expect(panel.getByRole("button", { name: /Gazette Beerecos Post Instagram/ })).toHaveCount(0);
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

test("Post : les textes du modèle Canva sont suggérés par l'IA, sans inventer date ni lieu", async ({ page }) => {
  await mock(page, CONNECTED);
  const asked: string[] = [];
  await page.route("https://bee-api.test/**", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    asked.push(String(body.brief ?? ""));
    await route.fulfill({ json: { text: JSON.stringify({ Thematique: "Ton réseau, ton meilleur commercial", "Texte 1": "Réunion le 12 mars à Lyon" }) } });
  });
  await page.goto("/post/nouveau");
  await page.getByRole("textbox", { name: "Légende" }).fill("Viens découvrir comment ton réseau peut recommander ton activité.");
  const panel = page.getByRole("region", { name: "Créer le visuel avec Canva" });
  await panel.getByRole("button", { name: "Choisir un modèle Canva post" }).click();
  await panel.getByRole("button", { name: /Gazette Beerecos Post Instagram/ }).click();
  await expect(panel.getByLabel("Thematique")).toHaveValue("Ton réseau, ton meilleur commercial");
  // « Texte 1 » n'est pas une zone factuelle : gardée. La consigne liste les zones et la légende.
  expect(asked[0]).toContain('["Thematique","Texte 1"]');
  expect(asked[0]).toContain("ton réseau peut recommander");
  await expect(panel.getByText(/Textes suggérés par l'IA/)).toBeVisible();
  // Un texte tapé n'est jamais écrasé par une nouvelle suggestion.
  await panel.getByLabel("Thematique").fill("Mon titre");
  await panel.getByRole("button", { name: "Suggérer les textes avec l'IA" }).click();
  await expect(panel.getByText(/Textes suggérés par l'IA/)).toBeVisible();
  await expect(panel.getByLabel("Thematique")).toHaveValue("Mon titre");
});
