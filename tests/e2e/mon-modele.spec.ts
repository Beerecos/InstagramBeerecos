import { expect, test } from "@playwright/test";
import { mockBee } from "./bee-api";

// « Mon modèle » : la base d'animation du montage se règle dans Paramètres, s'enregistre par l'action template-save,
// se remet au Standard sur demande. Aucun rendu, aucune publication.
test("Mon modèle : régler, enregistrer, puis revenir au Standard BeeRecos v1", async ({ page }) => {
  const calls = await mockBee(page, { "template-save": (body) => ({ template: body.template ?? null }) });
  page.on("dialog", (d) => d.accept());
  await page.goto("/settings");
  const editor = page.getByRole("region", { name: "Mon modèle d’animation" });
  await expect(editor.getByText("Aucun modèle enregistré : le Standard BeeRecos v1 s’applique.")).toBeVisible();

  const hook = editor.getByRole("group", { name: "Accroche (premier grand mot)" });
  await hook.getByLabel("Position").selectOption("milieu");
  await hook.getByLabel("Couleur").selectOption("bleu");
  await hook.getByLabel("Entrée").selectOption("laterale");
  await editor.getByLabel("Grands mots derrière moi").selectOption("1");
  await editor.getByLabel("Vidéo de fin BeeRecos").uncheck();
  await expect(editor.getByText(/Sans logo de fin/)).toBeVisible();
  await expect(editor.getByTestId("mon-modele-apercu").locator("iframe")).toHaveCount(1);

  await editor.getByRole("button", { name: "Enregistrer mon modèle" }).click();
  await expect(editor.getByText(/Mon modèle est enregistré/)).toBeVisible();
  const saved = calls.filter((c) => c.action === "template-save").at(-1)!.template as Record<string, unknown>;
  expect(saved).toMatchObject({ format: 1, name: "Mon modèle", hook: { position: "milieu", couleur: "bleu", entree: "laterale" }, maxBehind: 1, auto: { "logo-fin": false } });
  await expect(editor.getByRole("button", { name: "Enregistrer mon modèle" })).toBeDisabled();
  // Le modèle ne marque pas les préférences « à enregistrer ».
  await expect(page.getByRole("button", { name: "Enregistrer les préférences" })).toBeDisabled();

  await editor.getByRole("button", { name: "Revenir au Standard BeeRecos v1" }).click();
  await expect(editor.getByText("Retour au Standard BeeRecos v1.")).toBeVisible();
  expect(calls.filter((c) => c.action === "template-save").at(-1)!.template).toBeNull();
  // Aucun rendu ni publication.
  expect(calls.map((c) => c.action).filter((a) => /render|publish|to-reel/.test(String(a)))).toEqual([]);
});
