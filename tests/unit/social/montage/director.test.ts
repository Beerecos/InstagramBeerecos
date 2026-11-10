import { describe, expect, it } from "vitest";
import { parseEdit, type Edit } from "@/domain/social/montage/edit";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { directorShots, DIRECTOR_INTENSITIES, MIN_SHOT_MS, shotAt } from "@/domain/social/montage/director";
import { studioSequences } from "@/domain/social/montage/studio-sequences";

/** Auto Director (refonte du Studio, 2026-11-10) : plans simulés aux moments forts, jamais de zoom permanent. */
const SPEECH = "Ton réseau vaut de l'or si on sait quoi dire. Imagine un photographe qui travaille avec les restaurants du quartier. Nous avons accueilli 120 entrepreneurs cette année dans nos clubs. D'abord tu dis qui tu aides, ensuite dans quelle situation, enfin tu vérifies ce qu'on a retenu. Retiens bien ceci, la recommandation se prépare. Commente RÉSEAU pour visiter un club.";
const words = SPEECH.split(" ").map((w, i) => ({ text: w, startMs: i * 300, endMs: i * 300 + 250 }));
const end = words[words.length - 1].endMs + 500;
const scenes = studioSequences(words, [{ fromMs: 0, toMs: end }], "RÉSEAU");
const base: Edit = { video: "prise.mp4", accent: "bleu", ranges: [{ fromMs: 0, toMs: end }], subtitles: false, captionStyle: {}, voiceGain: 1, custom: [], sounds: [] };

describe("Auto Director : calcul des plans", () => {
  it("déterministe, premier plan au début, plans d'au moins 1,5 s, zooms de la palette", () => {
    for (const k of DIRECTOR_INTENSITIES) {
      const shots = directorShots(scenes, k);
      expect(directorShots(scenes, k)).toEqual(shots);
      expect(shots[0].atMs).toBe(0);
      shots.slice(1).forEach((s, i) => expect(s.atMs - shots[i].atMs).toBeGreaterThanOrEqual(MIN_SHOT_MS));
      shots.forEach((s) => expect([1, 1.1, 1.15, 1.25]).toContain(s.zoom));
      // Jamais deux plans identiques de suite (un « changement » qui ne change rien).
      shots.slice(1).forEach((s, i) => expect(s.zoom !== shots[i].zoom || s.offsetX !== shots[i].offsetX).toBe(true));
    }
  });

  it("pas de zoom permanent : retour au plan large au moins une fois", () => {
    for (const k of DIRECTOR_INTENSITIES) expect(directorShots(scenes, k).some((s) => s.zoom === 1)).toBe(true);
  });

  it("accroche serrée ; l'intensité augmente le zoom de l'accroche et le nombre de plans", () => {
    const zoom0 = (k: (typeof DIRECTOR_INTENSITIES)[number]) => directorShots(scenes, k)[0].zoom;
    expect([zoom0("sobre"), zoom0("equilibre"), zoom0("dynamique")]).toEqual([1.1, 1.15, 1.25]);
    expect(directorShots(scenes, "sobre").length).toBeLessThanOrEqual(directorShots(scenes, "dynamique").length);
    expect(directorShots(scenes, "sobre").every((s) => s.offsetX === 0)).toBe(true);
  });

  it("appel à l'action en plan serré", () => {
    const cta = scenes.find((s) => s.intent === "CTA");
    expect(cta).toBeDefined();
    for (const k of DIRECTOR_INTENSITIES) expect(shotAt(directorShots(scenes, k), cta!.startMs + 10).zoom).toBeGreaterThan(1);
  });

  it("sans scène : plan large centré", () => {
    expect(directorShots([], "dynamique")).toEqual([]);
    expect(shotAt([], 1000)).toMatchObject({ zoom: 1, offsetX: 0 });
  });
});

describe("Auto Director : rendu", () => {
  it("schéma : intensité facultative, valeur inconnue refusée", () => {
    expect(parseEdit({ ...base, rythme: { director: "equilibre" } })).toMatchObject({ ok: true, edit: { rythme: { director: "equilibre" } } });
    expect(parseEdit({ ...base, rythme: { director: "fou" } }).ok).toBe(false);
  });

  it("désactivé : composition identique à celle d'avant", () => {
    const html = buildEditComposition(base, words, { assetBase: "." });
    expect(html).not.toContain("scale(");
    expect(buildEditComposition({ ...base, rythme: { zoomCoupes: false, zoom: 1.1, volumeSon: 0.35 } }, words, { assetBase: "." })).toBe(html);
  });

  it("actif : plan de départ sur la prise, coupes nettes ensuite, détourage aligné", () => {
    const edit: Edit = { ...base, rythme: { zoomCoupes: true, zoom: 1.2, volumeSon: 0.35, director: "dynamique" } };
    const html = buildEditComposition(edit, words, { assetBase: "." });
    expect(html).toContain('style="transform: translate(0px, 0px) scale(1.25); transform-origin: 50% 32%"');
    const cuts = html.match(/tl\.set\("#take-0", \{ x: -?\d+, y: 0, scale: [\d.]+, transformOrigin: "50% 32%" \}/g) ?? [];
    expect(cuts.length).toBe(directorShots(studioSequences(words, edit.ranges), "dynamique").length - 1);
    // Le zoom alterné est remplacé (pas de 1,2 cumulé).
    expect(html).not.toContain("scale(1.2)");
  });

  it("respecte le cadrage manuel (zoom multiplié, décalage ajouté)", () => {
    const edit: Edit = { ...base, framing: { x: 10, y: -20, scale: 1.2 }, rythme: { zoomCoupes: false, zoom: 1.1, volumeSon: 0.35, director: "sobre" } };
    const html = buildEditComposition(edit, words, { assetBase: "." });
    expect(html).toContain(`translate(10px, -20px) scale(${1.2 * 1.1})`);
  });
});
