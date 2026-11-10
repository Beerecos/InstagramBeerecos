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

test("storyboard : Modifier ouvre la bibliothèque d'effets, changer ou supprimer l'effet en un clic", async ({ page }) => {
  let version = 1;
  let edit = { ...initialEdit("prise.mp4", DURATION), custom: [
    { name: "onglet", fromMs: 300, toMs: 2800, props: { texte: "RÉSEAU", variante: "blanc" } },
    { name: "logo-fin", fromMs: DURATION - 2000, toMs: DURATION, props: { baseline: true } },
  ] };
  const saved: typeof edit[] = [];
  await mockBee(page, {
    get: () => ({ montage: { id: "m9", title: "Prise", status: "ready", durationMs: DURATION, keptMs: DURATION, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: null }),
    "save-edit": (body) => { edit = body.edit as typeof edit; saved.push(edit); version++; return {}; },
  });
  await page.goto("/reels/m9");
  const board = page.getByRole("region", { name: "Storyboard" }).filter({ visible: true });
  const hook = board.getByRole("listitem", { name: "Séquence Accroche" });
  await hook.getByRole("button", { name: "Modifier" }).click();
  const fx = hook.getByRole("group", { name: "Effets de la séquence Accroche" });
  // Changer l'animation : même texte.
  await fx.getByRole("combobox", { name: "Changer l'animation de « RÉSEAU »" }).selectOption("mot-impact");
  await expect.poll(() => saved.at(-1)?.custom[0]).toMatchObject({ name: "mot-impact", props: { texte: "RÉSEAU" } });
  expect(saved.at(-1)?.sceneMarks).toEqual({ "0": "modified" });
  // Supprimer l'effet.
  await fx.getByRole("button", { name: "Supprimer l'effet Mot impact" }).click();
  await expect.poll(() => saved.at(-1)?.custom.map((c) => c.name)).toEqual(["logo-fin"]);
  await expect(fx.getByText("Aucun effet : sous-titres seuls.")).toBeVisible();
  // Ajouter depuis la bibliothèque, avec son texte.
  await fx.getByLabel("Texte affiché").fill("TON RÉSEAU");
  await fx.getByRole("group", { name: "Bibliothèque d'effets" }).getByRole("button", { name: "Titre 3D" }).click();
  await expect.poll(() => saved.at(-1)?.custom.map((c) => c.name)).toEqual(["titre-profondeur", "logo-fin"]);
  expect(saved.at(-1)?.custom[0].props).toEqual({ texte: "TON RÉSEAU" });
});

test("réglages d'une animation : libellés clairs, textes proposés par l'IA depuis ce qui est dit", async ({ page }) => {
  let version = 1;
  let edit = { ...initialEdit("prise.mp4", DURATION), custom: [
    { id: "a1", name: "bandeau-double", fromMs: 300, toMs: 2800, props: { texte: "TON RÉSEAU", detail: "vaut de l'or" } },
    { id: "a2", name: "logo-fin", fromMs: DURATION - 2000, toMs: DURATION, props: { baseline: true } },
  ] };
  const briefs: string[] = [];
  await mockBee(page, {
    get: () => ({ montage: { id: "m9", title: "Prise", status: "ready", durationMs: DURATION, keptMs: DURATION, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: null }),
    "save-edit": (body) => { edit = body.edit as typeof edit; version++; return {}; },
    "": (body) => { briefs.push(String(body.brief)); return { text: JSON.stringify({ texte: "TON RÉSEAU VAUT DE L'OR", detail: "si tu sais quoi dire", remplacement: "" }) }; },
  });
  await page.goto("/reels/m9");
  await page.getByRole("navigation", { name: "Étapes du montage" }).filter({ visible: true }).getByRole("button", { name: /Style/ }).click();
  await page.getByRole("list", { name: "Animations du réel" }).filter({ visible: true }).getByRole("button", { name: /^Bandeau double ·/ }).click();
  const panel = page.getByRole("region", { name: "Réglages de l’animation" }).filter({ visible: true });
  await expect(panel.getByLabel("Texte principal")).toHaveValue("TON RÉSEAU");
  await expect(panel.getByLabel("Deuxième ligne", { exact: true })).toHaveValue("vaut de l'or");
  await expect(panel.getByText("remplacement", { exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Proposer avec l'IA" }).click();
  await expect(panel.getByLabel("Texte principal")).toHaveValue("TON RÉSEAU VAUT DE L'OR");
  expect(briefs[0]).toContain("Ton réseau vaut de l'or");
  await expect.poll(() => edit.custom.find((c) => c.name === "bandeau-double")?.props).toMatchObject({ texte: "TON RÉSEAU VAUT DE L'OR", detail: "si tu sais quoi dire" });
});

test("musique de fond : un morceau de la bibliothèque, léger, baissé pendant la voix", async ({ page }) => {
  let version = 1;
  let edit = { ...initialEdit("prise.mp4", DURATION), custom: [{ name: "logo-fin", fromMs: DURATION - 2000, toMs: DURATION, props: { baseline: true } }] };
  await mockBee(page, {
    get: () => ({ montage: { id: "m9", title: "Prise", status: "ready", durationMs: DURATION, keptMs: DURATION, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: null }),
    "save-edit": (body) => { edit = body.edit as typeof edit; version++; return {}; },
    "media-list": () => ({ media: [{ id: "s1", kind: "son", title: "Ambiance douce", fileName: "ambiance-1a2b3c4d.mp3", durationMs: 120000, licence: "Pixabay", sourceUrl: null }] }),
  });
  await page.goto("/reels/m9");
  await page.getByRole("navigation", { name: "Étapes du montage" }).filter({ visible: true }).getByRole("button", { name: /Style/ }).click();
  const music = page.getByRole("radiogroup", { name: "Musique de fond" }).filter({ visible: true });
  await expect(music.getByRole("radio", { name: "Sans musique" })).toHaveAttribute("aria-checked", "true");
  await music.getByRole("radio", { name: /Ambiance douce/ }).click();
  await expect.poll(() => edit.sounds).toEqual([{ file: "ambiance-1a2b3c4d.mp3", atMs: 0, volume: 0.12, duck: { volume: 0.05 } }]);
  await page.getByRole("radiogroup", { name: "Volume de la musique" }).filter({ visible: true }).getByRole("radio", { name: "Moyen" }).click();
  await expect.poll(() => edit.sounds[0]?.volume).toBe(0.22);
  await music.getByRole("radio", { name: "Sans musique" }).click();
  await expect.poll(() => edit.sounds).toEqual([]);
});
