import { expect, test } from "@playwright/test";
import { mockBee } from "./bee-api";

// Studio des réels (Instagram BeeRecos), en mode démo : aucun appel réel, aucun serveur de montage configuré.
test("le studio d'un réel garde le choix du projet et revient au tableau de bord Post", async ({ page }) => {
  const base = { status: "ready", durationMs: 40000, keptMs: 40000, workspaceId: null, createdAt: "2026-11-02T09:00:00.000Z", renderStatus: null, sentToReels: false, finalVideoUrl: null };
  const old = { ...base, id: "m0", title: "V03 · Ancien", updatedAt: "2026-11-01T10:00:00.000Z" };
  const recent = { ...base, id: "m1", title: "V12 · Le réseau qui recommande", updatedAt: "2026-11-02T10:00:00.000Z" };
  await mockBee(page, { list: () => ({ montages: [old, recent] }), get: (b) => ({ montage: { ...(b.id === "m0" ? old : recent), aiSource: null, edit: null, captions: [], canUndo: false, error: null, renderError: null }, videoUrl: null }) });
  await page.goto("/reels/m1");
  const picker = page.getByLabel("Projet ouvert").filter({ visible: true });
  await expect(picker).toHaveValue("m1");
  await picker.selectOption("m0");
  await expect(page).toHaveURL(/\/reels\/m0$/);
  // La page précédente reste en mémoire, masquée (navigation Next.js) : on vise le sélecteur visible.
  await page.getByLabel("Projet ouvert").filter({ visible: true }).selectOption("__tous");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Post" })).toBeVisible();
});

test("Mes réels : statut, prochaine action, corbeille récupérable", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const summary = { id: "m1", title: "V12 · Le réseau qui recommande", status: "uploaded", durationMs: 40000, keptMs: null, workspaceId: null, createdAt: "2026-11-02T09:00:00.000Z", updatedAt: "2026-11-02T10:00:00.000Z", renderStatus: null, sentToReels: false, finalVideoUrl: null };
  let archived = false;
  const calls = await mockBee(page, {
    list: (b) => ({ montages: b.archived ? (archived ? [{ ...summary, archivedAt: "2026-11-03T10:00:00.000Z" }] : []) : (archived ? [] : [summary]) }),
    get: () => ({ montage: { ...summary, aiSource: null, edit: null, captions: [], canUndo: false, error: null, renderError: null }, videoUrl: null }),
    archive: () => { archived = true; return { archivedAt: "2026-11-03T10:00:00.000Z" }; },
    restore: () => { archived = false; return { restored: true }; },
  });
  await page.goto("/reels");
  await expect(page).toHaveTitle(/Mes réels · Instagram BeeRecos/);
  const create = page.getByRole("group", { name: "Créer un réel" }).first();
  await expect(create.getByRole("link", { name: "Importer ma vidéo" })).toHaveAttribute("href", "/reels/nouveau/video");
  const card = page.getByRole("link", { name: /V12 · Le réseau qui recommande/ });
  await expect(card).toHaveAttribute("href", "/reels/m1");
  await expect(card).toContainText("Lancer la transcription");
  await page.getByRole("button", { name: "Mettre « V12 · Le réseau qui recommande » à la corbeille" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Mettre à la corbeille" }).click();
  await expect(page.getByText(/est dans la corbeille : restaurable/)).toBeVisible();
  await expect(card).toHaveCount(0);
  await page.getByText("Corbeille (1)").click();
  await page.getByRole("button", { name: "Restaurer" }).click();
  await expect(page.getByRole("link", { name: /V12 · Le réseau qui recommande/ })).toBeVisible();
  expect(calls.filter((c) => c.action === "archive" || c.action === "restore").map((c) => c.action)).toEqual(["archive", "restore"]);
  await expect(page.getByRole("button", { name: /Demander à Queen Bee/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("navigation : Post (accueil, scripts compris) → Calendrier → Paramètres", async ({ page, isMobile }) => {
  await page.goto("/");
  const nav = () => page.getByRole("navigation", { name: isMobile ? "Navigation mobile" : "Navigation principale" });
  for (const label of ["Post", "Calendrier", "Paramètres"]) await expect(nav().getByRole("link", { name: label })).toBeVisible();
  await expect(nav().getByRole("link", { name: "Scripts" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Post" })).toBeVisible();
  await page.getByRole("link", { name: /Les 72 scripts et mes prises/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Scripts" })).toBeVisible();
  await expect(page.getByRole("link", { name: /J'ai déjà mes prises/ })).toHaveAttribute("href", "/reels/tournage");
  await expect(page.getByRole("link", { name: /Nouveau script/ }).first()).toHaveAttribute("href", "/scripts/nouveau");
  await nav().getByRole("link", { name: "Calendrier" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendrier éditorial" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajouter un réel terminé" })).toHaveAttribute("href", "/");
  await nav().getByRole("link", { name: "Paramètres" }).click();
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

test("vidéo IA : un seul éditeur, le modèle Recommandation devient des scènes modifiables", async ({ page }) => {
  await page.goto("/reels/nouveau/ia");
  await expect(page.getByRole("radiogroup", { name: "Style de la vidéo IA" })).toHaveCount(0);
  await page.getByRole("button", { name: "Modèle « Recommandation »" }).click();
  await expect(page.locator("textarea").filter({ hasText: "Tu recommandes un pro." }).first()).toBeVisible();
  await expect(page.locator("textarea").filter({ hasText: "Commente CLUB pour recevoir le lien de visite." }).first()).toBeVisible();
});

test("tournage : fichiers séparés et long rush, blocage serveur explicite", async ({ page }) => {
  await page.goto("/reels/tournage");
  await expect(page.getByRole("heading", { level: 1, name: "Découper un tournage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fichiers déjà séparés (une prise par réel)" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("production des extraits (FFmpeg) côté serveur");
  await expect(page.getByRole("button", { name: "Proposer les segments" })).toBeDisabled();
});

test("long rush : segments proposés depuis les annonces, corrigés, plan exporté sans toucher au rush", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "tableau large : vérifié sur ordinateur");
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "rush-"));
  const rush = join(dir, "session.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=black:s=108x192:d=20:r=10", "-f", "lavfi", "-i", "sine=d=20", "-c:v", "libx264", "-c:a", "aac", "-shortest", rush]);
  const size = statSync(rush).size;
  const w = (text: string, s: number) => ({ text, start: s, end: s + 0.3 });
  writeFileSync(join(dir, "transcript.json"), JSON.stringify({ words: [
    w("V1,", 0), w("le", 0.3), w("réseau", 0.6), w("qui", 0.9), w("recommande.", 1.2),
    w("Le", 3), w("réseau", 3.3), w("qui", 3.6), w("recommande,", 3.9), w("c'est", 4.2), w("BeeRecos.", 4.5),
    w("V2", 9), w("formation.", 9.3), w("Formation", 11), w("continue.", 11.3),
  ] }));
  await page.goto("/reels/tournage");
  await page.getByLabel("Rush (lu sur ce poste)").setInputFiles(rush);
  await page.getByLabel(/Transcription horodatée/).setInputFiles(join(dir, "transcript.json"));
  await expect(page.getByText(/15 mots transcrits/)).toBeVisible();
  await page.getByRole("button", { name: "Proposer les segments" }).click();
  await expect(page.getByRole("cell", { name: "V1", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "V2", exact: true })).toBeVisible();
  await expect(page.getByText(/Annonce introuvable pour : V3/)).toBeVisible();
  const start = page.getByLabel("Début de V2");
  await start.fill("0:00:10.5");
  await start.blur();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Télécharger le plan (JSON)" }).click()]);
  const plan = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(plan.rush).toMatchObject({ fileName: "session.mp4", size });
  expect(plan.segments.map((s: { n: number; sourceFromMs: number }) => [s.n, s.sourceFromMs])).toEqual([[1, 2600], [2, 10500]]);
  expect(statSync(rush).size).toBe(size);
});

test("éditeur de script : du hook au call to action, contrôles, prompteur, brouillon conservé", async ({ page }) => {
  await page.goto("/scripts");
  await page.getByRole("link", { name: /Nouveau script/ }).first().click();
  await expect(page).toHaveURL(/\/scripts\/nouveau$/);
  const blocks = page.locator('ol[aria-label="Blocs du script"] > li');
  await expect(blocks).toHaveCount(4);
  await expect(blocks.first()).toContainText("Hook · accroche");
  await expect(blocks.last()).toContainText("Call to action");
  await page.getByLabel("Titre").fill("Après la reco");
  const fill = async (i: number, voice: string, screen: string) => {
    await blocks.nth(i).getByLabel("Texte à dire").fill(voice);
    if (screen) await blocks.nth(i).getByLabel(/Texte à l'écran/).fill(screen);
  };
  await fill(0, "Tu recommandes un pro, et après ?", "Et après ?");
  await fill(1, "Une mise en relation réussie crée de la confiance entre trois personnes, et cette confiance se cultive chaque semaine.", "La confiance se cultive");
  await fill(2, "Chez BeeRecos, chaque recommandation est enregistrée et suivie, pour que personne ne l'oublie en chemin.", "Chaque reco suivie");
  await fill(3, "Envie de voir comment ça se passe ? Commente club.", "");
  await expect(blocks.last()).toContainText("prononce le mot-clé CLUB en majuscules");
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  await fill(3, "Envie de voir comment ça se passe ? Commente CLUB et je t'envoie les informations pour visiter un club.", "");
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Faire en réel IA/ })).toBeDisabled();
  await page.getByRole("button", { name: /Body 2/ }).click();
  await expect(blocks).toHaveCount(5);
  await expect(blocks.nth(3)).toContainText("Body 2");
  await page.getByRole("button", { name: "Prompteur" }).first().click();
  await expect(page.getByRole("dialog", { name: "Prompteur" })).toContainText("Tu recommandes un pro, et après ?");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Titre")).toHaveValue("Après la reco");
  await expect(page.getByText("brouillon sur cet appareil, non enregistré")).toBeVisible();
});

test("connexion : email et mot de passe, lien par email en secours", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Adresse email")).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await page.getByRole("button", { name: "Recevoir plutôt un lien par email" }).click();
  await expect(page.getByRole("button", { name: "Recevoir mon lien de connexion" })).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toHaveCount(0);
});

test("Réel filmé : zone d'import visible, choix de la vidéo puis envoi", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const calls = await mockBee(page, { create: () => ({ id: "m9", uploadUrl: "https://bee-api.test/upload/m9" }) });
  await page.goto("/reels/nouveau/video");
  const form = page.getByRole("form", { name: "Nouveau montage" }).filter({ visible: true });
  await expect(form.getByText("Choisir mes vidéos")).toBeVisible();
  await expect(form.getByText("ou glisse-les ici")).toBeVisible();
  await expect(form.getByRole("button", { name: "Envoyer et commencer" })).toBeDisabled();
  await form.getByLabel("Prises filmées").setInputFiles(`${process.cwd()}/tests/e2e/fixtures/paysage.mp4`);
  await expect(form.getByText("paysage.mp4")).toBeVisible();
  await expect(form.getByText("Changer de vidéo")).toBeVisible();
  await form.getByRole("button", { name: "Envoyer et commencer" }).click();
  await expect.poll(() => calls.some((c) => c.action === "create" && c.fileName === "paysage.mp4")).toBe(true);
  expect(errors).toEqual([]);
});
