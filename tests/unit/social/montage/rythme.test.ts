import { describe, expect, it } from "vitest";
import { parseEdit, type Edit } from "@/domain/social/montage/edit";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { mediaErrors, usedMedia } from "@/domain/social/montage/media";
import { applyFeedbackOps } from "@/domain/social/montage/feedback";
import { StudioSettingsSchema, withSettings } from "@/domain/social/montage/ideation";
import { initialEdit } from "@/domain/social/montage/montage";
import { ANIMATIONS } from "@/domain/social/montage/registry";

/** Lot S6 : Reels dynamiques — zoom alterné à chaque coupe et son d'entrée des animations. */
const base: Edit = { video: "prise.mp4", accent: "bleu", ranges: [{ fromMs: 0, toMs: 2000 }, { fromMs: 3000, toMs: 5000 }, { fromMs: 6000, toMs: 8000 }], subtitles: false, captionStyle: {}, voiceGain: 1, custom: [{ name: "titre", fromMs: 3000, toMs: 4500, props: { texte: "Ton réseau" } }], sounds: [] };

describe("rythme du montage", () => {
  it("schéma : zoom entre 104 et 120 %, son pris par son nom de fichier", () => {
    expect(parseEdit({ ...base, rythme: { zoomCoupes: true } })).toMatchObject({ ok: true, edit: { rythme: { zoomCoupes: true, zoom: 1.1, volumeSon: 0.35 } } });
    expect(parseEdit({ ...base, rythme: { zoomCoupes: true, zoom: 1.5 } }).ok).toBe(false);
    expect(parseEdit({ ...base, rythme: { sonAnimations: "../x.mp3" } }).ok).toBe(false);
    expect(parseEdit(base)).toMatchObject({ ok: true });
  });

  it("zoom alterné : un morceau sur deux en plan serré, rien sans coupe", () => {
    const html = buildEditComposition({ ...base, rythme: { zoomCoupes: true, zoom: 1.15, volumeSon: 0.35 } }, [], { assetBase: "." });
    expect(html).toMatch(/id="take-0"[^>]*data-track-index="0"><\/video>/);
    expect(html).toContain('data-track-index="0" style="transform: scale(1.15); transform-origin: 50% 32%"></video>');
    expect(html).toMatch(/id="take-2"[^>]*data-track-index="0"><\/video>/);
    const single = buildEditComposition({ ...base, ranges: [{ fromMs: 0, toMs: 8000 }], rythme: { zoomCoupes: true, zoom: 1.1, volumeSon: 0.35 } }, [], { assetBase: "." });
    expect(single).not.toContain("scale(");
  });

  it("son d'entrée de chaque animation : bibliothèque, embarqué au rendu", () => {
    const edit: Edit = { ...base, rythme: { zoomCoupes: false, zoom: 1.1, sonAnimations: "whoosh-1a2b3c4d.mp3", volumeSon: 0.4 } };
    expect(buildEditComposition(edit, [], { assetBase: "." })).toContain('<audio id="whoosh-0" src="./whoosh-1a2b3c4d.mp3" data-start="2" data-duration="1" data-volume="0.4" data-track-index="5"></audio>');
    expect(usedMedia(edit)).toEqual(["whoosh-1a2b3c4d.mp3"]);
    expect(mediaErrors(edit, [])).toEqual(["• rythme.sonAnimations → « whoosh-1a2b3c4d.mp3 » n'est pas un son de la bibliothèque"]);
    expect(mediaErrors(edit, [{ fileName: "whoosh-1a2b3c4d.mp3", kind: "son" }])).toEqual([]);
  });

  it("Bee peut activer le zoom alterné ; les préférences l'appliquent aux nouveaux montages", () => {
    const r = applyFeedbackOps(base, [], 8000, [{ op: "rythme", zoomCoupes: true, zoom: 1.2 }], ANIMATIONS);
    expect(r.edit.rythme).toMatchObject({ zoomCoupes: true, zoom: 1.2 });
    expect(r.applied).toEqual(["Zoom alterné à chaque coupe (120 %)"]);
    const s = StudioSettingsSchema.parse({ accent: "bleu", zoomCoupes: true });
    expect(withSettings(initialEdit("p.mp4", 4000), s).rythme).toEqual({ zoomCoupes: true, zoom: 1.1, volumeSon: 0.35 });
    expect(withSettings(initialEdit("p.mp4", 4000), StudioSettingsSchema.parse({ accent: "bleu" })).rythme).toBeUndefined();
  });
});
