import { expect, test } from "@playwright/test";
import { mockBee } from "./bee-api";
import { readFileSync } from "node:fs";

// « GÉNÉRER MON REEL » (preset Editorial Impact) : script → storyboard de l'IA → cartes modifiables, aperçu, QA. Serveur simulé.
const sample = JSON.parse(readFileSync(new URL("../fixtures/editorial-sample.json", import.meta.url), "utf8"));
const SCRIPT = "Tu connais 500 personnes qui te recommandent ? Chez BeeRecos, tu ne viens pas chercher des cartes de visite. Chaque semaine : une réunion de club, des recommandations, des chefs d'entreprise. Et ce qui fait la différence ? La confiance. Commente RÉSEAU pour recevoir ton invitation.";

test("Reel éditorial : génération par l'IA, cartes, verrou, suppression, repli automatique", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let reply: string = JSON.stringify(sample);
  const briefs: string[] = [];
  await mockBee(page, { "": (body) => { briefs.push(String(body.brief ?? "")); return { text: reply }; } });
  await page.goto("/reels/nouveau/editorial");
  await page.getByLabel("Script ou transcription").fill(SCRIPT);
  await page.getByLabel("Mot-clé du CTA (facultatif)").fill("réseau");
  await page.getByRole("button", { name: "GÉNÉRER MON REEL" }).click();

  const board = page.getByRole("list", { name: "Storyboard" });
  await expect(board.getByRole("listitem")).toHaveCount(5);
  await expect(page.getByText("Storyboard proposé par l'IA")).toBeVisible();
  expect(briefs[0]).toContain("AI MOTION DIRECTOR");
  expect(briefs[0]).toContain("Commente RÉSEAU");
  await expect(page.getByText("✅ Aucun problème détecté.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Timeline" })).toBeVisible();

  // Modifier un texte : la carte garde la valeur, l'aperçu est recalculé.
  const first = board.getByRole("listitem").first();
  await expect(first).toContainText("Accroche chiffrée");
  await first.getByLabel("Mot en couleur").fill("QUI TE RECOMMANDENT ?");
  await first.getByLabel("Mot en couleur").blur();
  await expect(first.getByLabel("Mot en couleur")).toHaveValue("QUI TE RECOMMANDENT ?");

  // Verrouiller la 1re carte puis régénérer : elle reste, le reste est remplacé (repli automatique, IA illisible).
  await first.getByRole("button", { name: "Verrouiller" }).click();
  reply = "pas de JSON";
  await page.getByRole("button", { name: /RÉGÉNÉRER/ }).click();
  await expect(page.getByText("storyboard construit automatiquement")).toBeVisible();
  await expect(board.getByRole("listitem").first().getByLabel("Mot en couleur")).toHaveValue("QUI TE RECOMMANDENT ?");
  await expect(board.getByRole("listitem").last()).toContainText("Appel à l'action");

  // Supprimer une carte.
  const before = await board.getByRole("listitem").count();
  await board.getByRole("listitem").nth(1).getByRole("button", { name: "Supprimer" }).click();
  await expect(board.getByRole("listitem")).toHaveCount(before - 1);
  expect(errors).toEqual([]);
});

test("Réel IA : lien vers le Reel éditorial", async ({ page }) => {
  await mockBee(page);
  await page.goto("/reels/nouveau/ia");
  await page.getByRole("link", { name: /Nouveau : Reel éditorial/ }).click();
  await expect(page).toHaveURL(/\/reels\/nouveau\/editorial$/);
  await expect(page.getByRole("heading", { name: "Reel éditorial" })).toBeVisible();
});
