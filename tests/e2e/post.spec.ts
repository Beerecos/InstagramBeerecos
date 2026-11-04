import { expect, test, type Page } from "@playwright/test";
import { mockBee } from "./bee-api";

// Onglet Post : routes /api/instagram simulées (aucun appel à Instagram, rien n'est publié).
type Pub = Record<string, unknown> & { id: string; status: string };

async function mockInstagram(page: Page, opts: { connected: boolean; items: Pub[]; linkedin?: { connected: boolean; pageAllowed?: boolean } }) {
  const calls: { method: string; path: string; body: Record<string, unknown> }[] = [];
  let items = [...opts.items];
  await page.route("**/api/linkedin/connection", (route) => route.fulfill({ json: { connected: Boolean(opts.linkedin?.connected), name: opts.linkedin?.connected ? "Cédric Picard" : null, expiresAt: null, page: { configured: true, allowed: Boolean(opts.linkedin?.pageAllowed) }, appConfigured: true } }));
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
    const linked = path.match(/^\/posts\/([^/]+)\/linkedin$/);
    if (linked) {
      items = items.map((i) => (i.id === linked[1] ? { ...i, linkedinStatus: "published", linkedinUrl: "https://www.linkedin.com/feed/update/urn:li:share:77/", linkedinPublishedAt: "2026-11-04T10:00:00.000Z" } : i));
      return route.fulfill({ json: { item: items.find((i) => i.id === linked[1]) } });
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

const reel = (id: string, title: string, done: boolean) => ({ id, title, status: "ready", durationMs: 40000, keptMs: 40000, workspaceId: null, createdAt: "2026-11-02T09:00:00.000Z", updatedAt: "2026-11-03T09:00:00.000Z", renderStatus: done ? "done" : null, sentToReels: false, finalVideoUrl: done ? "https://bee-api.test/v.mp4" : null });

test("Post : tableau de bord des posts en cours, rangés par étape", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockBee(page, { list: () => ({ montages: [reel("m1", "V12 · En montage", false), reel("m2", "V20 · Rendu", true)] }) });
  await mockInstagram(page, { connected: true, items: [draft, { ...draft, id: "p2", title: "Sans photo", media: [] }] });
  await page.goto("/");
  await expect(page).toHaveTitle(/Post · Instagram BeeRecos/);
  const steps = page.getByRole("navigation", { name: "Étapes" });
  await expect(steps.getByRole("button", { name: /2\s*En préparation/ })).toBeVisible();
  await expect(steps.getByRole("button", { name: /2\s*Prêts à publier/ })).toBeVisible();
  const reprendre = page.getByRole("region", { name: /À reprendre/ });
  await expect(reprendre.getByRole("link", { name: /V12 · En montage/ })).toHaveAttribute("href", "/reels/m1");
  await expect(reprendre.getByRole("link", { name: /Sans photo/ })).toHaveAttribute("href", "/post/p2");
  await expect(page.getByRole("region", { name: /Prêts à publier/ }).getByRole("link", { name: /Visite de club/ })).toHaveAttribute("href", "/post/p1");
  await expect(page.getByRole("region", { name: /Scripts/ }).getByRole("link", { name: "Nouveau script" })).toHaveAttribute("href", "/scripts/nouveau");
  // Une étape cliquée devient une liste, avec son adresse (lien direct).
  await steps.getByRole("button", { name: /Prêts à publier/ }).click();
  await expect(page).toHaveURL(/\?vue=pret$/);
  await expect(page.getByRole("region", { name: /Prêts à publier/ }).getByRole("link")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("Post : chaque carte dit son type et se supprime avec la croix, après confirmation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const m1 = reel("m1", "V12 · Filmé", false), m2 = reel("m2", "V20 · IA", false);
  const bee = await mockBee(page, {
    list: () => ({ montages: [m1, m2] }),
    get: (b) => ({ montage: { ...(b.id === "m2" ? m2 : m1), aiSource: b.id === "m2" ? { source: { kind: "motion", id: "s1", revision: 1 }, verified: true } : null, edit: null, captions: [], canUndo: false, error: null, renderError: null }, videoUrl: null }),
    archive: () => ({ archivedAt: "2026-11-04T10:00:00.000Z" }),
  });
  const calls = await mockInstagram(page, { connected: true, items: [draft, { ...draft, id: "p2", title: "Trois photos", media: [1, 2, 3].map((i) => ({ path: `u/${i}.jpg`, type: "image" })) }] });
  await page.goto("/");
  const card = (name: RegExp) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name }) }).first();
  await expect(card(/V12 · Filmé/)).toContainText("Réel filmé");
  await expect(card(/V20 · IA/)).toContainText("Réel IA");
  await expect(card(/Visite de club/)).toContainText("Post simple");
  await expect(card(/Trois photos/)).toContainText("Carrousel");

  await page.getByRole("button", { name: "Supprimer « V12 · Filmé »" }).first().click();
  const confirm = page.getByRole("alertdialog", { name: /Supprimer « V12 · Filmé »/ });
  await expect(confirm).toContainText("corbeille");
  await confirm.getByRole("button", { name: "Mettre à la corbeille" }).click();
  await expect(page.getByText(/est dans la corbeille/)).toBeVisible();
  expect(bee.some((c) => c.action === "archive" && c.id === "m1")).toBe(true);
  await expect(page.getByRole("link", { name: /V12 · Filmé/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Supprimer « Trois photos »" }).first().click();
  await page.getByRole("alertdialog", { name: /Supprimer « Trois photos »/ }).getByRole("button", { name: "Supprimer" }).click();
  await expect.poll(() => calls.some((c) => c.method === "DELETE" && c.path === "/posts/p2")).toBe(true);
  await expect(page.getByRole("link", { name: /Trois photos/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Post : Créer ouvre trois grandes cartes, et le post s'écrit dans son éditeur avec aperçu", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockBee(page);
  const calls = await mockInstagram(page, { connected: false, items: [] });
  await page.goto("/");
  await expect(page.getByText(/Instagram n'est pas encore connecté/)).toBeVisible();
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Que veux-tu créer ?" });
  await expect(dialog.getByRole("link", { name: /Réel IA/ })).toHaveAttribute("href", "/reels/nouveau/ia");
  await expect(dialog.getByRole("link", { name: /Réel filmé/ })).toHaveAttribute("href", "/reels/nouveau/video");
  await expect(dialog.getByRole("link", { name: "Écrire un script" })).toHaveAttribute("href", "/scripts/nouveau");
  await expect(dialog.getByRole("link")).toHaveCount(4); // 3 cartes + « Écrire un script »
  await dialog.getByRole("link", { name: /^Post/ }).click();

  await expect(page).toHaveURL(/\/post\/nouveau$/);
  await expect(page.getByRole("radio", { name: "Post simple" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("heading", { level: 1, name: "Nouveau post" })).toBeVisible();
  const preview = page.getByRole("figure", { name: "Aperçu Instagram" });
  await page.getByLabel("Légende", { exact: true }).fill("Viens découvrir BeeRecos.");
  await expect(preview).toContainText("Viens découvrir BeeRecos.");
  await expect(page.getByLabel("Message envoyé en DM")).toHaveCount(0);
  await page.getByLabel(/Mot-clé pour recevoir un DM/).fill("club");
  await expect(page.getByLabel(/Mot-clé pour recevoir un DM/)).toHaveValue("CLUB");
  await page.getByRole("button", { name: "Ajouter « Commente CLUB »" }).click();
  await expect(page.getByLabel("Légende", { exact: true })).toHaveValue(/Commente CLUB/);
  await expect(preview).toContainText("Qui commente « CLUB » reçoit ton DM");
  await page.getByLabel("Message envoyé en DM").fill("Voici le lien");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Brouillon enregistré.")).toBeVisible();
  await expect(page).toHaveURL(/\/post\/p-new$/);
  expect(calls.find((c) => c.method === "POST" && c.path === "/posts")?.body).toMatchObject({ kind: "post", keyword: "CLUB", dmText: "Voici le lien" });
  // Sans connexion ni photo : la fenêtre de publication dit pourquoi et ne publie rien.
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Publier maintenant ?" });
  await expect(confirm.getByText("Ajoute au moins une photo.")).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Oui, publier" })).toBeDisabled();
  expect(calls.some((c) => c.path.endsWith("/publish"))).toBe(false);
  expect(errors).toEqual([]);
});

test("Post : carrousel et légende proposée par l'IA, jamais appliquée sans clic", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const ai = await mockBee(page, { "": () => ({ text: "Trois nouveaux membres ce matin au club. Commente CLUB pour visiter le tien." }) });
  await mockInstagram(page, { connected: true, items: [] });
  await page.goto("/post/nouveau?format=carrousel");
  await expect(page.getByRole("heading", { level: 1, name: "Nouveau carrousel" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Carrousel" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Proposer une légende" })).toBeDisabled();
  await page.getByLabel(/Mot-clé pour recevoir un DM/).fill("club");
  await page.getByLabel("De quoi parle ce post ?").fill("la réunion du club ce matin");
  await page.getByRole("button", { name: "Proposer une légende" }).click();
  await expect(page.getByText("Proposition de l'IA")).toBeVisible();
  await expect(page.getByLabel("Légende", { exact: true })).toHaveValue("");
  const request = ai.find((c) => c.channel === "instagram");
  expect(request).toMatchObject({ channel: "instagram", cta: "Commente CLUB pour recevoir le lien en DM" });
  expect(String(request?.brief)).toContain("Carrousel");
  await page.getByRole("button", { name: "Utiliser cette légende" }).click();
  await expect(page.getByLabel("Légende", { exact: true })).toHaveValue(/Commente CLUB pour visiter le tien/);
  expect(errors).toEqual([]);
});

test("Post : carrousel InspiBEEz'ness, le récit suit la consigne et finit par l'invitation exacte", async ({ page }) => {
  const ai = await mockBee(page, { "": () => ({ text: "Un récit qui commence.\n\nEt qui va jusqu'au résultat.\n\nCommente INSPI !\n#Inspi" }) });
  await mockInstagram(page, { connected: true, items: [] });
  await page.goto("/post/nouveau?format=carrousel");
  await page.getByRole("radio", { name: /InspiBEEz'ness/ }).click();
  await expect(page.getByLabel(/Mot-clé pour recevoir un DM/)).toHaveValue("INSPI");
  await page.getByLabel("Sujet de l'histoire").fill("L'histoire du STABILO BOSS");
  await expect(page.getByRole("button", { name: "Proposer une légende" })).toBeDisabled();
  await page.getByLabel(/Texte des slides et sources/).fill("Slide 4 : 1971, le BOSS débarque. Source : STABILO.");
  await page.getByRole("button", { name: "Proposer une légende" }).click();
  await expect(page.getByText("Proposition de l'IA")).toBeVisible();
  const brief = String(ai.find((c) => c.channel === "instagram")?.brief);
  expect(brief).toContain("RACONTER TOUTE L'HISTOIRE");
  expect(brief).toContain("Slide 4 : 1971");
  await page.getByRole("button", { name: "Utiliser cette légende" }).click();
  const caption = await page.getByLabel("Légende", { exact: true }).inputValue();
  expect(caption).toContain("Et qui va jusqu'au résultat.");
  expect(caption.endsWith("Tu veux, toi aussi, rencontrer des entrepreneurs inspirants ?\nCommente « INSPI » pour recevoir ton invitation à découvrir un club BeeRecos.\n\n#MonReseauCestTonReseau #BeeRecos #InspiBEEzness")).toBe(true);
  expect(caption).not.toContain("#Inspi\n");
  await expect(page.getByRole("button", { name: "Copier le prompt carrousel" })).toBeVisible();
});

test("Post : visuels du carrousel, plan proposé par l'IA aux couleurs BeeRecos, invitation INSPI en dernier", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const plan = { slides: [
    { layout: "couverture", title: "Il a marqué nos cours.", accent: "marqué", photo: 4 },
    { layout: "date", title: "Le BOSS débarque", number: "1971", text: "Selon STABILO, une forme inspirée d'un coup de main.", source: "SOURCE : STABILO" },
    { layout: "chiffre-noir", title: "vendus", number: "3", prefix: "Plus de", text: "Milliards d'exemplaires, mai 2025.", source: "STABILO / MAI 2025" },
  ] };
  const ai = await mockBee(page, { "": () => ({ text: `Voici : ${JSON.stringify(plan)}` }) });
  await mockInstagram(page, { connected: true, items: [] });
  await page.goto("/post/nouveau?format=carrousel");
  const visuels = page.getByRole("region", { name: "Créer les visuels avec l'IA" });
  await expect(visuels.getByRole("button", { name: "Proposer les slides" })).toBeDisabled();
  await visuels.getByRole("textbox", { name: "Sujet", exact: true }).fill("L'histoire du STABILO BOSS");
  await visuels.getByLabel("Faits et sources").fill("1971 : lancement du STABILO BOSS (STABILO)\nMai 2025 : plus de trois milliards vendus");
  await visuels.getByRole("button", { name: "Proposer les slides" }).click();
  const strip = visuels.getByRole("list", { name: "Slides du carrousel" });
  await expect(strip.getByRole("listitem")).toHaveCount(4);
  const brief = String(ai.find((c) => c.channel === "instagram")?.brief);
  expect(brief).toContain("PLAN DE CARROUSEL");
  expect(brief).toContain("aucune photo fournie");
  // La photo 4 n'existe pas : jamais inventée. L'invitation officielle ferme le carrousel.
  await visuels.getByRole("button", { name: "Slide 4" }).click();
  await expect(visuels.getByText("Invitation finale officielle")).toBeVisible();
  await expect(strip.getByRole("listitem").last()).toContainText("« INSPI »");
  await visuels.getByRole("button", { name: "Slide 1" }).click();
  await visuels.getByRole("group", { name: "Réglages de la slide 1" }).getByRole("textbox", { name: "Titre", exact: true }).fill("Il a surligné nos cours.");
  await expect(strip.getByRole("listitem").first()).toContainText("Il a surligné nos cours.");
  // Illustrer : une photo ajoutée depuis la slide, puis inclinée et agrandie comme le produit de la référence.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await visuels.getByLabel("Ajouter une photo à la slide 1").setInputFiles({ name: "surligneur.png", mimeType: "image/png", buffer: png });
  const visuel = visuels.getByRole("group", { name: "Visuel de la slide 1" });
  await expect(visuel.getByRole("combobox", { name: "Photo" })).toHaveValue("1");
  await visuel.getByRole("combobox", { name: "Cadrage" }).selectOption("entier");
  await visuel.getByRole("slider", { name: "Inclinaison" }).fill("-30");
  await visuel.getByRole("slider", { name: "Taille" }).fill("1.5");
  const photo = visuels.getByRole("img", { name: "Aperçu de la slide 1" }).getByTestId("slide-photo");
  await expect(photo).toHaveAttribute("style", /rotate\(-30deg\) scale\(1\.5\)/);
  await expect(photo).toHaveCSS("object-fit", "contain");
  // Photo réaliste générée (OpenAI côté serveur, simulé ici) : posée sur la slide 2 en plein cadre.
  const asked: Record<string, unknown>[] = [];
  await page.route("**/api/instagram/image", async (route) => { asked.push(JSON.parse(route.request().postData() ?? "{}")); await route.fulfill({ json: { b64: png.toString("base64"), mime: "image/png", model: "gpt-image-1" } }); });
  await visuels.getByRole("button", { name: "Slide 2" }).click();
  const visuel2 = visuels.getByRole("group", { name: "Visuel de la slide 2" });
  await visuel2.getByLabel("Décris l'image").fill("cahier ouvert surligné en jaune sur un bureau en bois, lumière du matin");
  await visuel2.getByRole("button", { name: "Générer l'image" }).click();
  await expect(visuel2.getByRole("combobox", { name: "Photo" })).toHaveValue("2");
  await expect(visuel2.getByRole("combobox", { name: "Cadrage" })).toHaveValue("plein");
  expect(asked[0]).toMatchObject({ mode: "scene", subject: "L'histoire du STABILO BOSS", description: expect.stringContaining("cahier ouvert") });
  await expect(visuels.getByRole("img", { name: "Aperçu de la slide 2" }).getByTestId("slide-photo")).toBeVisible();
  await expect(visuels.getByRole("button", { name: "Créer les 4 images du carrousel" })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("Post : publier un brouillon demande une confirmation, puis suit Instagram jusqu'au lien public", async ({ page }) => {
  await mockBee(page);
  const calls = await mockInstagram(page, { connected: true, items: [draft] });
  await page.goto("/post/p1");
  await expect(page.getByRole("heading", { level: 1, name: "Éditeur de post" })).toBeVisible();
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Publier maintenant ?" });
  await expect(confirm.getByText(/public tout de suite/)).toBeVisible();
  await expect(confirm.getByText(/qui commente « CLUB » reçoit ton message/)).toBeVisible();
  await confirm.getByRole("button", { name: "Oui, publier" }).click();
  expect(calls.find((c) => c.path === "/posts/p1/publish")?.body).toEqual({ confirm: true });
  await confirm.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByText(/Publié sur Instagram/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /Voir le post/ })).toHaveAttribute("href", "https://www.instagram.com/p/ABC/");
});

test("Post : publier aussi sur LinkedIn, avec un texte adaptable et le profil par défaut", async ({ page }) => {
  await mockBee(page);
  const calls = await mockInstagram(page, { connected: true, items: [draft], linkedin: { connected: true, pageAllowed: false } });
  await page.goto("/post/p1");
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Publier maintenant ?" });
  await expect(confirm.getByLabel("Instagram")).toBeChecked();
  await expect(confirm.getByLabel("Aussi sur LinkedIn")).not.toBeChecked();
  await confirm.getByLabel("Aussi sur LinkedIn").check();
  await expect(confirm.getByRole("radio", { name: /Mon profil/ })).toHaveAttribute("aria-checked", "true");
  await expect(confirm.getByRole("radio", { name: /Page BeeRecos/ })).toBeDisabled();
  const text = confirm.getByLabel("Texte LinkedIn");
  await expect(text).toHaveValue("Viens visiter un club. Commente CLUB !");
  await text.fill("Viens visiter un club BeeRecos : lien en commentaire.");
  await confirm.getByRole("button", { name: "Oui, publier" }).click();
  await expect.poll(() => calls.find((c) => c.path === "/posts/p1/linkedin")?.body).toEqual({ confirm: true, text: "Viens visiter un club BeeRecos : lien en commentaire.", target: "profil" });
  expect(calls.some((c) => c.path === "/posts/p1/publish")).toBe(true);
  await confirm.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByRole("link", { name: /Voir sur LinkedIn/ })).toHaveAttribute("href", "https://www.linkedin.com/feed/update/urn:li:share:77/");
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

test("Carrousel : le sujet saisi pour les visuels est partagé avec la légende", async ({ page }) => {
  await mockBee(page);
  await mockInstagram(page, { connected: false, items: [] });
  await page.goto('/post/nouveau');
  await page.getByRole('radio', { name: 'Carrousel', exact: true }).click();
  await page.getByRole('textbox', { name: 'Sujet', exact: true }).fill('La rencontre des entrepreneurs');
  await expect(page.getByRole('textbox', { name: 'De quoi parle ce post ?' })).toHaveValue('La rencontre des entrepreneurs');
  await page.getByRole('textbox', { name: 'De quoi parle ce post ?' }).fill('Un nouveau sujet');
  await expect(page.getByRole('textbox', { name: 'Sujet', exact: true })).toHaveValue('Un nouveau sujet');
});
