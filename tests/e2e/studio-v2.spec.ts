import { expect, test } from "@playwright/test";
import { mockBee } from "./bee-api";
import { initialEdit } from "../../src/domain/social/montage/montage";

// Nouveau studio (refonte 2026-11-12) : en-tête, colonne gauche, vidéo, Cadrage / Coupe / Animation, timeline, Publier.
const SPEECH = "Ton réseau vaut de l'or si tu sais quoi dire. Imagine un photographe qui travaille avec les restaurants du quartier. Retiens bien ceci, la recommandation se prépare. Commente RÉSEAU pour visiter un club.";
const WORDS = SPEECH.split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
const DURATION = WORDS[WORDS.length - 1].endMs + 500;
const SHOTS = process.env.STUDIO_SHOTS;

test("nouveau studio : trois onglets, animation en 1 clic, coupe au curseur, Publier", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "disposition bureau");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let version = 1;
  let edit = { ...initialEdit("prise.mp4", DURATION), custom: [{ name: "onglet", fromMs: 300, toMs: 2500, props: { texte: "RÉSEAU", variante: "blanc" } }] };
  const saved: typeof edit[] = [];
  await mockBee(page, {
    list: () => ({ montages: [{ id: "m9", title: "Conseils réseau", status: "ready", keptMs: DURATION, updatedAt: new Date().toISOString(), renderStatus: null, finalVideoUrl: null, sentToReels: false }] }),
    get: () => ({ montage: { id: "m9", title: "Conseils réseau", status: "ready", durationMs: DURATION, keptMs: DURATION, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: null }),
    "save-edit": (body) => { edit = body.edit as typeof edit; saved.push(edit); version++; return {}; },
  });
  await page.addInitScript(() => localStorage.setItem("ibr.studio.mode", "studio"));
  await page.goto("/reels/m9");
  const studio = page.getByTestId("studio-v2");
  await expect(studio.getByRole("navigation", { name: "Studio" }).getByRole("button", { name: "Créer une vidéo" })).toBeVisible();
  await expect(studio.getByRole("button", { name: "Importer une vidéo" })).toBeVisible();
  await expect(studio.getByRole("button", { name: /Conseils réseau/ })).toBeVisible();
  // Uniquement trois onglets.
  await expect(studio.getByRole("tab")).toHaveText([/Cadrage/, /Coupe/, /Animation/]);
  await expect(studio.getByRole("tab", { name: "Animation" })).toHaveAttribute("aria-selected", "true");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/studio-v2-animation.png` });

  // Animation en 1 clic : posée sur le passage en cours, enregistrée toute seule.
  // Passage déjà animé : message clair, rien n'est ajouté.
  await studio.getByRole("button", { name: "Mot impact" }).click();
  await expect(studio.getByText(/Ce passage a déjà une animation/)).toBeVisible();
  // Sur un autre passage : ajoutée d'un clic.
  await studio.getByRole("button", { name: "Sélectionner la séquence 3" }).click();
  await studio.getByRole("button", { name: "Mot impact" }).click();
  await expect(studio.getByRole("region", { name: "Animations de la vidéo" }).getByRole("button", { name: /^Mot impact · RECOMMANDATION/ })).toBeVisible();
  await expect.poll(() => saved.some((e) => e.custom.some((c) => c.name === "mot-impact"))).toBe(true);

  // Coupe : 1 clic = 1 action.
  await studio.getByRole("tab", { name: "Coupe" }).click();
  await expect(studio.getByRole("button", { name: "✂ Couper au curseur", exact: true })).toBeVisible();
  await expect(studio.getByRole("button", { name: "↶ Annuler", exact: true })).toBeVisible();
  await studio.getByRole("tab", { name: "Cadrage" }).click();
  await expect(studio.getByText("Afficher le logo BeeRecos")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/studio-v2-cadrage.png` });

  // Publier : une fenêtre simple.
  await studio.getByRole("button", { name: /Publier/ }).click();
  await expect(page.getByRole("dialog", { name: "Publier ma vidéo" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Publier ma vidéo" }).getByText("1. Vérifier l’aperçu")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/studio-v2-publier.png` });
  await page.getByRole("dialog", { name: "Publier ma vidéo" }).getByRole("button", { name: "Fermer", exact: true }).click();

  // Les outils experts restent accessibles.
  await studio.getByLabel("Paramètres").click();
  await studio.getByRole("button", { name: "Mode avancé (tous les outils)" }).click();
  await expect(page.getByRole("toolbar", { name: "Outils du montage" })).toBeVisible();
  await page.getByRole("button", { name: "Nouveau studio" }).click();
  await expect(page.getByTestId("studio-v2")).toBeVisible();
  expect(errors).toEqual([]);
});
