import { expect, test, type Page } from "@playwright/test";
import { mockBee } from "./bee-api";
import { initialEdit } from "../../src/domain/social/montage/montage";

// Effets sonores SFX Kit dans le nouveau studio (2026-11-12) : panneau « Sons », ajout, association, son automatique,
// réglages, piste de la timeline, contrôle avant la vidéo finale. Téléphone et ordinateur.
const SPEECH = "Ton réseau vaut de l'or si tu sais quoi dire. Imagine un photographe qui travaille avec les restaurants du quartier. Retiens bien ceci, la recommandation se prépare. Commente RÉSEAU pour visiter un club.";
const WORDS = SPEECH.split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
const DURATION = WORDS[WORDS.length - 1].endMs + 500;
const SHOTS = process.env.STUDIO_SHOTS;
type AnyEdit = Record<string, unknown> & { sons?: { id: string; son: string; ancre: { type: string }; origine: string; volume: number; muet: boolean; cle?: string }[]; sonsReglages?: { auto: boolean } };

async function open(page: Page, extra: Record<string, unknown> = {}) {
  let version = 1;
  let edit: AnyEdit = { ...initialEdit("prise.mp4", DURATION), custom: [{ id: "t1", name: "titre", fromMs: 1200, toMs: 3500, props: { texte: "RÉSEAU" } }], zooms: [{ fromMs: 6000, toMs: 7500, type: "accent", amplitude: 1.1, focusX: 50, focusY: 32 }], ...extra };
  const saved: AnyEdit[] = [];
  await mockBee(page, {
    list: () => ({ montages: [] }),
    get: () => ({ montage: { id: "m9", title: "Conseils réseau", status: "ready", durationMs: DURATION, keptMs: DURATION, workspaceId: null, createdAt: "t", updatedAt: `v${version}`, renderStatus: null, sentToReels: false, finalVideoUrl: null, aiSource: null, edit, captions: WORDS, canUndo: false, canRedo: false, previewApproved: false, error: null, renderError: null, reel: null, brief: null, storyboard: null }, videoUrl: null }),
    "save-edit": (body) => { edit = body.edit as AnyEdit; saved.push(edit); version++; return {}; },
  });
  // Écoute : on enregistre les lectures du navigateur (une seule à la fois) sans dépendre de la sortie audio.
  await page.addInitScript(() => {
    const w = window as unknown as { __ecoute: { play: string[]; pause: number } };
    w.__ecoute = { play: [], pause: 0 };
    HTMLMediaElement.prototype.play = function () { if (this instanceof HTMLAudioElement) w.__ecoute.play.push(this.src); return Promise.resolve(); };
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () { if (this instanceof HTMLAudioElement) w.__ecoute.pause++; return pause.call(this); };
    localStorage.setItem("ibr.studio.vue", "studio");
  });
  await page.goto("/reels/m9");
  return { studio: page.getByTestId("studio-v2"), saved, last: () => saved[saved.length - 1] };
}

test("sons : écouter, ajouter ici, associer à l'animation, régler, remplacer, détacher, supprimer", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { studio, last } = await open(page);
  await studio.getByRole("tab", { name: "Animation" }).click();
  // Sélectionner l'animation, puis ouvrir le panneau « Sons ».
  await studio.getByRole("region", { name: "Animations de la vidéo" }).getByRole("button", { name: /^Titre/ }).click();
  await studio.getByRole("button", { name: "Sons", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Sons" });
  await expect(panel.getByText(/SFX Kit v1\.0\.0/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Essentiels" })).toHaveAttribute("aria-pressed", "true");
  // Recherche en français : « zoom » trouve le zoom avant.
  await panel.getByRole("searchbox", { name: "Rechercher un son" }).fill("zoom avant");
  await expect(panel.getByRole("list", { name: "Sons du catalogue" }).getByText("Rebond, rotation, zoom · zoom avant")).toBeVisible();
  // Une seule écoute à la fois.
  await panel.getByRole("searchbox", { name: "Rechercher un son" }).fill("pop");
  const sons = panel.getByRole("list", { name: "Sons du catalogue" });
  await sons.getByRole("button", { name: /^Écouter Pop · petit, entrée$/ }).click();
  await expect(sons.getByRole("button", { name: /^Arrêter Pop · petit, entrée$/ })).toHaveAttribute("aria-pressed", "true");
  await sons.getByRole("button", { name: /^Écouter Pop · moyen, entrée$/ }).click();
  await expect(sons.getByRole("button", { name: /^Arrêter/ })).toHaveCount(1);
  const plays = await page.evaluate(() => (window as unknown as { __ecoute: { play: string[] } }).__ecoute.play);
  expect(plays.map((u) => u.split("/").slice(-2).join("/"))).toEqual(["pops/pop-small-in.flac", "pops/pop-medium-in.flac"]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/sons-panneau-${info.project.name}.png`, fullPage: false });
  // Associer à l'animation sélectionnée.
  await sons.getByRole("listitem").filter({ hasText: "Pop · petit, entrée" }).getByRole("button", { name: "Associer à l’animation" }).click();
  await expect(panel).toBeHidden();
  await expect.poll(() => last()?.sons?.[0]).toMatchObject({ son: "pop-small-in", ancre: { type: "animation", animId: "t1", point: "debut" }, origine: "manuel", volume: 0.7 });
  // Fermer le panneau a arrêté l'écoute.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ecoute: { pause: number } }).__ecoute.pause)).toBeGreaterThan(0);
  // Ajouter ici : à la position de lecture.
  await studio.getByRole("button", { name: "Sons", exact: true }).click();
  await panel.getByRole("button", { name: "Tout" }).click();
  await panel.getByRole("searchbox", { name: "Rechercher un son" }).fill("ding");
  await panel.getByRole("listitem").filter({ hasText: "Ton · ding, médium" }).getByRole("button", { name: "Ajouter ici" }).click();
  await expect.poll(() => last()?.sons?.length).toBe(2);
  expect(last()!.sons![1]).toMatchObject({ son: "tone-ding-mid", ancre: { type: "libre" } });
  // Réglages de l'occurrence : volume, sourdine, remplacer, détacher, supprimer.
  const liste = studio.getByRole("region", { name: "Sons de la vidéo" });
  const occ = liste.getByTestId("son-occurrence").filter({ hasText: "Relié à : Titre" });
  await occ.getByRole("button", { name: /^Pop · petit, entrée/ }).click();
  await occ.getByRole("slider", { name: /^Volume de/ }).fill("0.4");
  await expect.poll(() => last()?.sons?.find((o) => o.son === "pop-small-in")?.volume).toBe(0.4);
  await occ.getByRole("button", { name: /^Rendre muet/ }).click();
  await expect.poll(() => last()?.sons?.find((o) => o.son === "pop-small-in")?.muet).toBe(true);
  await occ.getByRole("button", { name: "Remplacer" }).click();
  await expect(panel.getByText("Choisis le son qui remplace l’effet sélectionné.")).toBeVisible();
  await panel.getByRole("searchbox", { name: "Rechercher un son" }).fill("impact léger doux");
  await panel.getByRole("listitem").first().getByRole("button", { name: "Remplacer par ce son" }).click();
  await expect.poll(() => last()?.sons?.[0].son).toBe("impact-light-soft");
  await occ.getByRole("button", { name: /Détacher/ }).click();
  await expect.poll(() => last()?.sons?.[0].ancre.type).toBe("libre");
  // Piste de la timeline : un effet par son qui sonne (le son muet n'apparaît pas).
  await expect(page.getByTestId("timeline-effet")).toHaveCount(1);
  await liste.getByRole("button", { name: /^Supprimer Ton · ding/ }).click();
  await expect.poll(() => last()?.sons?.length).toBe(1);
  expect(errors).toEqual([]);
});

test("son automatique : activer, relancer sans doublon, déplacer sur la timeline", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "glisser sur la timeline : bureau");
  const { studio, last, saved } = await open(page, { outro: { durationMs: 2000, baseline: true } });
  await studio.getByRole("tab", { name: "Animation" }).click();
  const liste = studio.getByRole("region", { name: "Sons de la vidéo" });
  await studio.getByText(/^Sons de la vidéo/).click();
  await liste.getByRole("switch", { name: "Son automatique" }).check();
  await expect.poll(() => last()?.sonsReglages?.auto).toBe(true);
  const first = last()!.sons!;
  // Titre, changement de séquence, zoom et logo : un son chacun, rien par mot de sous-titre.
  expect(first.map((o) => o.cle).sort()).toEqual(["anim:t1", "logo:fin", "seq:3000", "zoom:6000"]);
  expect(first.every((o) => o.origine === "auto")).toBe(true);
  const before = saved.length;
  await liste.getByRole("button", { name: "Relancer" }).click();
  await expect.poll(() => saved.length).toBeGreaterThan(before);
  expect(last()!.sons).toEqual(first);
  // Déplacer l'effet du zoom aux flèches : son décalage change, il reste relié au zoom.
  const effet = page.getByTestId("timeline-effet").filter({ hasText: "move-zoom-in" });
  await effet.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => last()?.sons?.find((o) => o.cle === "zoom:6000")).toMatchObject({ decalageMs: 100, modifie: ["decalage"], ancre: { type: "repere" } });
});

test("avant la vidéo finale : un effet impossible à rendre est nommé ; continuer sans lui le rend muet", async ({ page }) => {
  const { studio, last } = await open(page, { sons: [{ id: "son-1", son: "son-disparu", lib: "sfx-kit@1.0.0", ancre: { type: "libre", debutMs: 2000 }, decalageMs: 0, volume: 0.7, muet: false, origine: "manuel" }] });
  await studio.getByRole("button", { name: "Publier" }).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Vidéo finale" });
  const warn = dialog.getByRole("region", { name: "Effets sonores à vérifier" });
  await expect(warn).toContainText("« son-disparu »");
  await expect(page).toHaveURL(/\/reels\/m9$/);
  await warn.getByRole("button", { name: /Continuer sans ces effets/ }).click();
  await expect.poll(() => last()?.sons?.[0].muet).toBe(true);
  await expect(dialog.getByRole("region", { name: "Effets sonores à vérifier" })).toHaveCount(0);
});
