import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mockBee } from "./bee-api";

// Réel IA ultra simple (preset Editorial Impact) : idée + mascotte → structure Hook → CTA → aperçu. Serveur simulé.
const sample = JSON.parse(readFileSync(new URL("../fixtures/editorial-sample.json", import.meta.url), "utf8"));
const IDEA = "Pourquoi venir visiter un club BeeRecos avant d'adhérer : tu connais 500 personnes mais qui te recommande ?";
const withVoice = { ...sample, scenes: sample.scenes.map((s: Record<string, unknown>, i: number) => ({ ...s, voice: i === 0 ? "Tu connais 500 personnes. Mais qui te recommande vraiment ?" : "Une phrase dite par Audrey sur cette scène." })) };

test("Réel IA : idée + mascotte → structure Hook → CTA, garder, modifier, valider → aperçu", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let reply: string = JSON.stringify(withVoice);
  const briefs: string[] = [];
  const tts: string[] = [];
  const research: Record<string, unknown>[] = [];
  let zipBytes = 0;
  await mockBee(page, {
    "": (body) => { briefs.push(String(body.brief ?? "")); return { text: reply }; },
    "research-facts": (body) => { research.push(body); return { facts: [{ date: "2024", text: "500 dirigeants interrogés sur la recommandation.", source: "Étude test", url: "https://etude.test/recommandation" }], text: "", dropped: 0 }; },
    tts: (body) => { tts.push(String(body.text)); return { duration: 2.4, receiptId: "a".repeat(64), audioBase64: "bXAz", words: [] }; },
    "upload-url": () => ({ jobId: "11111111-1111-4111-8111-111111111111", uploadUrl: "https://upload.test/projet.zip" }),
    jobs: () => ({ jobs: [] }),
    submit: () => ({ renderId: "render-123" }),
    status: () => ({ state: "done", narrationVerified: true, url: "https://video.test/reel.mp4", size: 1000 }),
  });
  await page.route("https://upload.test/**", async (route) => { zipBytes = route.request().postDataBuffer()?.length ?? 0; await route.fulfill({ status: 200, body: "" }); });
  await page.route("https://video.test/**", (route) => route.fulfill({ status: 200, contentType: "video/mp4", body: readFileSync(new URL("./fixtures/paysage.mp4", import.meta.url)) }));
  await page.goto("/reels/nouveau/ia");
  await page.getByLabel("Mon idée").fill(IDEA);
  await expect(page.getByLabel("Mascotte BeeRecos")).toBeChecked();
  await page.getByRole("button", { name: "Structurer ma vidéo (Hook → CTA)" }).click();

  const board = page.getByRole("list", { name: "Storyboard" });
  await expect(board.getByRole("listitem")).toHaveCount(5);
  expect(research[0]).toMatchObject({ action: "research-facts", kind: "reel" });
  expect(briefs[0]).toContain("FAITS TROUVÉS SUR LE WEB");
  await expect(page.getByText("Sources trouvées sur le web (1)")).toBeVisible();
  await expect(page.getByRole("link", { name: "Étude test" })).toHaveAttribute("href", "https://etude.test/recommandation");
  expect(briefs[0]).toContain("IDÉE :");
  expect(briefs[0]).toContain(IDEA);
  const first = board.getByRole("listitem").first();
  await expect(first).toContainText("Accroche");
  await expect(first).toContainText("Audrey dit : Tu connais 500 personnes.");
  await expect(board.getByRole("listitem").last()).toContainText("Appel à l'action");

  // Modifier : la phrase d'Audrey et le texte à l'écran se changent sur la carte.
  await first.getByRole("button", { name: "Modifier" }).click();
  await first.getByLabel("Mot en couleur").fill("QUI TE RECOMMANDENT ?");
  await first.getByLabel("Mot en couleur").blur();
  await expect(first).toContainText("QUI TE RECOMMANDENT ?");

  // Garder la 1re carte puis demander une autre structure : elle reste.
  await first.getByRole("button", { name: "Garder" }).click();
  reply = "pas de JSON";
  const before = briefs.length;
  await page.getByRole("button", { name: "Proposer une autre structure" }).click();
  await expect(page.getByText(/Réponse de l'IA inutilisable deux fois/)).toBeVisible();
  expect(briefs.length - before).toBe(2); // une seconde tentative avant la structure de secours
  await expect(board.getByRole("listitem").first()).toContainText("QUI TE RECOMMANDENT ?");

  // Valider → aperçu, avec retour possible à la structure.
  await page.getByRole("button", { name: "Valider la structure" }).click();
  await expect(page.getByRole("group", { name: "Timeline" })).toBeVisible();
  await expect(page.getByText("Fin BeeRecos")).toBeVisible();

  // Compiler avec la voix d'Audrey : une voix par phrase, projet envoyé, vidéo revenue (rien n'est publié).
  await page.getByRole("button", { name: "Compiler la vidéo avec la voix d'Audrey" }).click();
  await expect(page.getByLabel("Réel IA avec la voix d'Audrey")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("✅ Vidéo compilée avec la voix d'Audrey")).toBeVisible();
  // Une voix par scène qui a une phrase (ici la carte gardée ; le CTA automatique n'en a pas).
  expect(tts).toEqual(["Tu connais 500 personnes. Mais qui te recommande vraiment ?"]);
  expect(zipBytes).toBeGreaterThan(10000);
  await expect(page.getByRole("link", { name: "Télécharger le MP4" })).toHaveAttribute("href", "https://video.test/reel.mp4");

  await page.getByRole("button", { name: "Modifier la structure" }).click();
  await expect(board).toBeVisible();
  expect(errors).toEqual([]);
});

test("Réel IA : la vidéo compilée part au montage avec sa preuve de rendu", async ({ page }) => {
  const saved: Record<string, unknown>[] = [];
  const created: Record<string, unknown>[] = [];
  let uploaded = 0;
  const MONTAGE = "22222222-2222-4222-8222-222222222222";
  await mockBee(page, {
    "": () => ({ text: JSON.stringify(withVoice) }),
    "research-facts": () => ({ facts: [], text: "", dropped: 0 }),
    tts: () => ({ duration: 2.4, receiptId: "a".repeat(64), audioBase64: "bXAz", words: [] }),
    "upload-url": () => ({ jobId: "11111111-1111-4111-8111-111111111111", uploadUrl: "https://upload.test/projet.zip" }),
    jobs: () => ({ jobs: [] }),
    submit: () => ({ renderId: "render-123" }),
    status: () => ({ state: "done", narrationVerified: true, url: "https://video.test/reel.mp4", size: 1000 }),
    "asset-save": (body) => { saved.push(body); return { asset: { id: "33333333-3333-4333-8333-333333333333", kind: "editorial", title: body.title, revision: 1, status: "draft", data: body.data, createdAt: "2026-11-11T00:00:00Z", updatedAt: "2026-11-11T00:00:00Z" } }; },
    create: (body) => { created.push(body); return { id: MONTAGE, uploadUrl: "https://upload.test/montage.mp4" }; },
    uploaded: () => { uploaded++; return {}; },
    brief: () => ({ storyboardStatus: "draft" }),
    get: () => ({ montage: { id: MONTAGE, updatedAt: "2026-11-11T00:00:00Z" }, videoUrl: null }),
    "storyboard-save": () => ({ warnings: [] }),
  });
  await page.route("https://upload.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("https://video.test/**", (route) => route.fulfill({ status: 200, contentType: "video/mp4", body: readFileSync(new URL("./fixtures/paysage.mp4", import.meta.url)) }));
  await page.goto("/reels/nouveau/ia");
  await page.getByLabel("Mon idée").fill(IDEA);
  await page.getByRole("button", { name: "Structurer ma vidéo (Hook → CTA)" }).click();
  await page.getByRole("button", { name: "Valider la structure" }).click();
  await page.getByRole("button", { name: "Compiler la vidéo avec la voix d'Audrey" }).click();
  await expect(page.getByText("✅ Vidéo compilée avec la voix d'Audrey")).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Envoyer au montage" }).click();
  await expect(page).toHaveURL(new RegExp(`/reels/${MONTAGE}$`), { timeout: 20000 });
  // Source enregistrée (structure seule, sans voix générées), puis montage créé avec la preuve du rendu.
  expect(saved[0]).toMatchObject({ kind: "editorial", title: IDEA.slice(0, 120) });
  expect(saved[0].data).not.toHaveProperty("assets");
  expect(created[0]).toMatchObject({ aiSource: { source: { assetId: "33333333-3333-4333-8333-333333333333", revision: 1, kind: "editorial" }, jobId: "11111111-1111-4111-8111-111111111111", renderId: "render-123" } });
  expect(uploaded).toBe(1);
});

test("Réel IA : un chiffre absent de l'idée bloque la validation", async ({ page }) => {
  const bad = { ...withVoice, scenes: withVoice.scenes.map((s: Record<string, unknown>, i: number) => (i === 1 ? { ...s, voice: "Plus de 300 entrepreneurs nous rejoignent chaque mois." } : s)) };
  await mockBee(page, { "": () => ({ text: JSON.stringify(bad) }) });
  await page.goto("/reels/nouveau/ia");
  await page.getByLabel("Mon idée").fill(IDEA);
  await page.getByRole("button", { name: "Structurer ma vidéo (Hook → CTA)" }).click();
  await expect(page.getByText(/Chiffre absent de ton idée et des sources trouvées : 300/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Valider la structure" })).toBeDisabled();
});

test("Réel IA : l'éditeur détaillé reste accessible, l'ancienne adresse redirige", async ({ page }) => {
  await mockBee(page);
  await page.goto("/reels/nouveau/editorial");
  await expect(page).toHaveURL(/\/reels\/nouveau\/ia$/);
  await page.getByRole("link", { name: "Éditeur détaillé" }).click();
  await expect(page).toHaveURL(/mode=detaille/);
  await expect(page.getByRole("link", { name: "Revenir au Studio simple" })).toBeVisible();
});
