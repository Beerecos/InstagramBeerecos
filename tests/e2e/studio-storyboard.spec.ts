import { expect, test } from "@playwright/test";
import { mockBee } from "./bee-api";
import { initialEdit } from "../../src/domain/social/montage/montage";

// Étape Storyboard : une carte par séquence, Garder / Modifier / Régénérer / Supprimer (restaurable). Serveur simulé.
const SPEECH = "Ton réseau vaut de l'or si tu sais quoi dire. Imagine un photographe qui travaille avec les restaurants du quartier. Nous avons accueilli 120 entrepreneurs cette année dans nos clubs. Retiens bien ceci, la recommandation se prépare. Commente RÉSEAU pour visiter un club.";
const WORDS = SPEECH.split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
const DURATION = WORDS[WORDS.length - 1].endMs + 500;

test("storyboard en cartes : garder, modifier avec ses mots, régénérer, supprimer puis restaurer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let version = 1;
  // Une animation déjà posée : le Standard ne s'applique pas à l'ouverture (les enregistrements comptés sont les nôtres).
  let edit = { ...initialEdit("prise.mp4", DURATION), custom: [{ name: "logo-fin", fromMs: DURATION - 2000, toMs: DURATION, props: { baseline: true } }] };
  const saved: typeof edit[] = [];
  const feedback: string[] = [];
  const calls = await mockBee(page, {
    get: () => ({ montage: { id: "m9", title: "Prise", status: "ready", durationMs: DURATION, keptMs: DURATION, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: null }),
    "save-edit": (body) => { edit = body.edit as typeof edit; saved.push(edit); version++; return {}; },
    feedback: (body) => { feedback.push(String(body.message)); return { reply: "Je pose BUSINESS derrière toi sur cette séquence.", proposal: { ...edit, rythme: { zoomCoupes: true, zoom: 1.08, volumeSon: 0.35 } }, applied: ["rythme"], rejected: [], baseUpdatedAt: `v${version}` }; },
  });
  await page.goto("/reels/m9");
  const board = page.getByRole("region", { name: "Storyboard" }).filter({ visible: true });
  const hook = board.getByRole("listitem", { name: "Séquence Accroche" });
  await expect(hook).toContainText("Ton réseau vaut de l'or");
  await expect(hook).toContainText("Suggestion IA");

  // Garder.
  await hook.getByRole("button", { name: "Garder" }).click();
  await expect(hook).toContainText("Validé");
  expect(saved.at(-1)?.sceneMarks).toEqual({ "0": "validated" });

  // Modifier avec ses mots : consigne limitée à la séquence, proposition appliquée, statut Modifié.
  const proof = board.getByRole("listitem", { name: "Séquence Preuve" });
  await proof.getByRole("button", { name: "Modifier" }).click();
  await proof.getByLabel("Ce que tu veux changer dans cette séquence").fill("mets BUSINESS derrière moi");
  await proof.getByRole("button", { name: "Demander à Bee" }).click();
  await expect(proof.getByText("Je pose BUSINESS derrière toi sur cette séquence.")).toBeVisible();
  expect(feedback.at(-1)).toMatch(/^Seulement pour la séquence de .*120 entrepreneurs.*: mets BUSINESS derrière moi$/);
  await proof.getByRole("button", { name: "Appliquer" }).click();
  await expect(proof).toContainText("Modifié");

  // Régénérer : une mise en scène pour cette séquence seulement.
  const explain = board.getByRole("listitem", { name: "Séquence Explication" });
  const before = saved.length;
  await explain.getByRole("button", { name: "Régénérer" }).click();
  await expect(explain.getByText(/Nouvelle mise en scène|Aucune autre mise en scène/)).toBeVisible();
  if (saved.length > before) await expect(explain).toContainText("Modifié");

  // Supprimer puis restaurer.
  const demo = board.getByRole("listitem", { name: "Séquence Démonstration" });
  const ranges = saved.at(-1)!.ranges.length;
  await demo.getByRole("button", { name: "Supprimer" }).click();
  await expect(demo).toContainText("Supprimé");
  expect(saved.at(-1)!.ranges.length).toBeGreaterThan(ranges);
  await demo.getByRole("button", { name: "Restaurer" }).click();
  await expect(demo).toContainText("Suggestion IA");
  expect(saved.at(-1)!.ranges.length).toBe(ranges);

  // Rien n'est rendu ni publié.
  expect(calls.map((c) => c.action).filter((a) => /render|to-reel|publish/.test(String(a)))).toEqual([]);
  expect(errors).toEqual([]);
});
