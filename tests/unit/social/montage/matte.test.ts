import { describe, expect, it } from "vitest";
import { parseEdit, type Edit } from "@/domain/social/montage/edit";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { titleLines } from "@/domain/social/montage/animations";
import { behindErrors, matteAt, matteNameFor, MATTE_COMMAND, usedMattes } from "@/domain/social/montage/matte";
import { withTakes } from "@/domain/social/montage/montage";
import { buildMontageProject, takeFiles } from "@/domain/social/montage/project";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { checkStudioEdit } from "@/domain/social/montage/studio";
import { validateSuggestions } from "@/domain/social/montage/suggest";
import { checkStoryboard } from "@/domain/social/montage/ideation";

/** Lot S5 : titre derrière le sujet grâce au détourage de la prise (fait sur le poste). */
const base: Edit = { video: "prise-1.mp4", accent: "bleu", ranges: [{ fromMs: 0, toMs: 9000 }], subtitles: false, captionStyle: {}, voiceGain: 1, custom: [], sounds: [] };
const two: Edit = { ...withTakes(base, [{ file: "prise-1.mp4", durationMs: 4000 }, { file: "prise-2.mp4", durationMs: 5000 }]), mattes: { "prise-2.mp4": "prise-2.matte.webm" } };
const behind = (fromMs: number, toMs = fromMs + 2500) => ({ name: "titre-derriere", fromMs, toMs, props: { texte: "Ton réseau" } });

describe("détourage d'une prise", () => {
  it("nom et commande du détourage, prise détourée à un instant de la bande", () => {
    expect(matteNameFor("prise-2.mp4")).toBe("prise-2.matte.webm");
    expect(MATTE_COMMAND("prise-2.mp4")).toBe("npx hyperframes@0.8.126 remove-background prise-2.mp4 -o prise-2.matte.webm");
    expect(matteAt(two, 3999)).toBeNull();
    expect(matteAt(two, 4000)).toBe("prise-2.matte.webm");
  });

  it("schéma : détourage .webm d'une prise existante, jamais le nom d'une prise", () => {
    expect(parseEdit(two).ok).toBe(true);
    expect(parseEdit({ ...two, mattes: { "absente.mp4": "a.matte.webm" } })).toMatchObject({ ok: false, errors: ["• mattes.absente.mp4 → aucune prise de ce nom dans le montage"] });
    expect(parseEdit({ ...two, mattes: { "prise-2.mp4": "prise-2.mov" } }).ok).toBe(false);
    expect(parseEdit({ ...two, mattes: { "prise-1.mp4": "x.webm", "prise-2.mp4": "x.webm" } }).ok).toBe(false);
  });

  it("retirer une prise retire son détourage", () => {
    expect(withTakes(two, [{ file: "prise-1.mp4", durationMs: 4000 }]).mattes).toBeUndefined();
    expect(withTakes(two, two.takes!).mattes).toEqual(two.mattes);
  });

  it("titre derrière le sujet : seulement sur une prise détourée, sans déborder sur la prise suivante", () => {
    expect(behindErrors({ ...two, custom: [behind(5000)] }, ANIMATIONS)).toEqual([]);
    expect(behindErrors({ ...two, custom: [behind(1000)] }, ANIMATIONS)[0]).toContain("envoyez d'abord le détourage de la prise 1");
    const reverse: Edit = { ...two, mattes: { "prise-1.mp4": "prise-1.matte.webm" }, custom: [behind(3000, 5000)] };
    expect(behindErrors(reverse, ANIMATIONS)[0]).toContain("déborde sur la prise suivante");
    expect(usedMattes({ ...two, custom: [behind(5000)] }, ANIMATIONS)).toEqual(["prise-2.matte.webm"]);
    expect(usedMattes(two, ANIMATIONS)).toEqual([]);
  });

  it("le Studio ne change pas les détourages et refuse un titre derrière une prise non détourée", () => {
    expect(checkStudioEdit({ ...two, mattes: undefined }, two, 9000)).toMatchObject({ ok: false, errors: ["• mattes → les détourages s'envoient et se retirent depuis la carte Prises"] });
    expect(checkStudioEdit({ ...two, custom: [behind(5000)] }, two, 9000).ok).toBe(true);
    expect(checkStudioEdit({ ...two, custom: [behind(1000)] }, two, 9000).ok).toBe(false);
  });

  it("Bee ne propose un titre derrière le sujet que sur une prise détourée", () => {
    const words = [{ text: " Ton", startMs: 1000, endMs: 1300 }, { text: " réseau", startMs: 5000, endMs: 5400 }];
    const { accepted, rejected } = validateSuggestions([behind(1000), behind(5000)], words, 9000, [], ANIMATIONS, { matteAt: (ms) => matteAt(two, ms) });
    expect(accepted.map((a) => a.fromMs)).toEqual([5000]);
    expect(rejected[0].why).toContain("pas de détourage");
    expect(validateSuggestions([behind(5000)], words, 9000, [], ANIMATIONS).accepted).toEqual([]);
  });

  it("storyboard : plus d'avertissement « derrière le sujet » une fois la prise détourée", () => {
    const brief = { sujet: "Le réseau", angle: "Vu du terrain", motCle: "CLUB" };
    const sb = { sequences: [{ idee: "Accroche", titre: "Ton réseau", traitement: "derriere-sujet", dureeS: 4 }], cta: "Commente CLUB" };
    const words = [{ text: " Ton", startMs: 0, endMs: 300 }];
    const warn = (matte: boolean) => { const r = checkStoryboard(sb, brief, words, { matte }); return r.ok ? r.warnings : []; };
    expect(warn(false)[0]).toContain("demande le détourage");
    expect(warn(true)).toEqual([]);
  });
});

describe("composition : titre sous le détourage", () => {
  it("empile prise, titre, détourage (visible seulement pendant le titre), sous-titres", () => {
    const html = buildEditComposition({ ...two, custom: [behind(5000)] }, [], { assetBase: "." });
    expect(html).toContain('<div id="mw-1" class="matte-wrap"><video id="matte-1" class="take" src="./prise-2.matte.webm" data-start="4" data-duration="5" data-media-start="0" data-has-audio="false" muted playsinline data-track-index="4" data-rhythm-zoom="1"></video></div>');
    expect(html).not.toContain('id="mw-0"');
    expect(html).toContain('class="clip anim-host behind"');
    expect(html).toContain('tl.set("#mw-1", { opacity: 1 }, 5);');
    expect(html).toContain('tl.set("#mw-1", { opacity: 0 }, 7.5);');
    expect(html).toMatch(/\.anim-host \{[^}]*z-index: 6;[\s\S]*\.anim-host\.behind \{ z-index: 3; \}[\s\S]*\.matte-wrap \{[^}]*z-index: 5; opacity: 0;/);
    // Sans titre derrière le sujet : aucun calque de détourage, rien à envoyer au rendu.
    expect(buildEditComposition(two, [], { assetBase: "." })).not.toContain("matte-wrap\"");
    expect(takeFiles(two)).toEqual(["prise-1.mp4", "prise-2.mp4"]);
  });

  it("le titre tient en une ou deux lignes ; le projet de rendu embarque le détourage utilisé", async () => {
    expect(titleLines("Réseau")).toEqual(["Réseau"]);
    expect(titleLines("Ton réseau te recommande")).toEqual(["Ton réseau te", "recommande"]);
    const edit = { ...two, custom: [behind(5000)] };
    expect(takeFiles(edit)).toEqual(["prise-1.mp4", "prise-2.mp4", "prise-2.matte.webm"]);
    const project = await buildMontageProject(edit, [], async () => new Uint8Array(10), async () => new Uint8Array(10));
    expect(project.files).toContain("prise-2.matte.webm");
    await expect(buildMontageProject(edit, [], async (f) => new Uint8Array(f.endsWith(".webm") ? 0 : 10), async () => new Uint8Array(10))).rejects.toThrow("Détourage introuvable : prise-2.matte.webm");
  });
});
