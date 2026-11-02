import { describe, expect, it } from "vitest";
import { parseEdit, splitAtTakes, takeBreaks, takeIndexAt, takeStrip, type Edit } from "@/domain/social/montage/edit";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { addTakeError, removeTake, uniqueTakeName, withTakes } from "@/domain/social/montage/montage";
import { planAutoCut } from "@/domain/social/montage/pipeline";
import { buildMontageProject } from "@/domain/social/montage/project";
import { checkStudioEdit } from "@/domain/social/montage/studio";

/** Lot S3 bis : plusieurs prises posées bout à bout sur une « bande de prises » (temps en ms de la bande). */
const base: Edit = { video: "prise-1.mp4", accent: "bleu", ranges: [{ fromMs: 0, toMs: 9000 }], subtitles: false, captionStyle: {}, voiceGain: 1, custom: [], sounds: [] };
const two = withTakes(base, [{ file: "prise-1.mp4", durationMs: 4000 }, { file: "prise-2.mp4", durationMs: 5000 }]);
const w = (text: string, startMs: number, endMs: number) => ({ text: ` ${text}`, startMs, endMs });

describe("bande de prises", () => {
  it("pose les prises bout à bout ; sans liste, une seule prise couvre tout", () => {
    expect(takeStrip(two)).toEqual([{ file: "prise-1.mp4", fromMs: 0, toMs: 4000 }, { file: "prise-2.mp4", fromMs: 4000, toMs: 9000 }]);
    expect(takeBreaks(two)).toEqual([4000]);
    expect(takeBreaks(base)).toEqual([]);
    expect(takeIndexAt(takeStrip(two), 3999)).toBe(0);
    expect(takeIndexAt(takeStrip(two), 4000)).toBe(1);
  });

  it("un morceau qui franchit un raccord est coupé en deux (le montage obtenu ne change pas)", () => {
    expect(splitAtTakes([{ fromMs: 3000, toMs: 6000 }], [4000])).toEqual([{ fromMs: 3000, toMs: 4000 }, { fromMs: 4000, toMs: 6000 }]);
    expect(two.ranges).toEqual([{ fromMs: 0, toMs: 4000 }, { fromMs: 4000, toMs: 9000 }]);
    const parsed = parseEdit({ ...two, ranges: [{ fromMs: 1000, toMs: 8000 }] });
    expect(parsed.ok && parsed.edit.ranges).toEqual([{ fromMs: 1000, toMs: 4000 }, { fromMs: 4000, toMs: 8000 }]);
  });

  it("refuse une première prise différente de video, une prise en double, plus de 10 min ou un morceau après la bande", () => {
    const bad = (e: unknown) => { const r = parseEdit(e); return r.ok ? [] : r.errors.join("\n"); };
    expect(bad({ ...two, video: "autre.mp4" })).toContain("première prise");
    expect(bad({ ...two, takes: [{ file: "prise-1.mp4", durationMs: 4000 }, { file: "prise-1.mp4", durationMs: 5000 }] })).toContain("en double");
    expect(bad({ ...two, takes: [{ file: "prise-1.mp4", durationMs: 400_000 }, { file: "prise-2.mp4", durationMs: 300_000 }], ranges: [{ fromMs: 0, toMs: 1000 }] })).toContain("10 min");
    expect(bad({ ...two, ranges: [{ fromMs: 0, toMs: 9500 }] })).toContain("après la dernière prise");
    expect(bad({ ...two, takes: Array.from({ length: 7 }, (_, i) => ({ file: i ? `p-${i}.mp4` : "prise-1.mp4", durationMs: 1000 })), ranges: [{ fromMs: 0, toMs: 1000 }] })).toContain("6 prises");
  });

  it("composition : chaque morceau lit SA prise, à son temps propre", () => {
    const edit = { ...two, ranges: [{ fromMs: 500, toMs: 3000 }, { fromMs: 5000, toMs: 7000 }] };
    const html = buildEditComposition(edit, [], { assetBase: "." });
    expect(html).toContain('id="take-0" class="take" src="./prise-1.mp4" data-start="0" data-duration="2.5" data-media-start="0.5"');
    expect(html).toContain('id="take-1" class="take" src="./prise-2.mp4" data-start="2.5" data-duration="2" data-media-start="1"');
  });

  it("coupe auto : nouvelle phrase à chaque raccord ; une phrase redite dans une prise suivante garde la dernière prise", () => {
    const words = [
      w("Je", 0, 300), w("présente", 300, 900), w("le", 900, 1000), w("réseau", 1000, 1500), w("BeeRecos", 1500, 2100),
      w("Bonjour", 4000, 4400), w("je", 4400, 4600), w("présente", 4600, 5100), w("le", 5100, 5200), w("réseau", 5200, 5600), w("BeeRecos.", 5600, 6300),
    ];
    const clauses = planAutoCut(words, { takeBreaks: [4000] });
    expect(clauses.map((c) => c.text)).toEqual(["Je présente le réseau BeeRecos", "Bonjour je présente le réseau BeeRecos."]);
    expect(clauses[0].suggestDrop).toBe("redite (version gardée : prise 2, phrase 2)");
    expect(clauses[1].suggestDrop).toBeUndefined();
    // Sans raccord, les deux phrases (séparées de plus de 0,7 s) relèvent de la règle « reprise » habituelle.
    expect(planAutoCut(words)[0].suggestDrop).toBe("reprise (version gardée : 2)");
  });

  it("ajout et retrait de prises : nom libre, limites, îlots de parole recalés", () => {
    expect(uniqueTakeName("prise.mp4", ["prise.mp4", "prise-2.mp4"])).toBe("prise-3.mp4");
    expect(uniqueTakeName("b.mov", ["prise.mp4"])).toBe("b.mov");
    expect(addTakeError(Array.from({ length: 6 }, () => ({ file: "x.mp4", durationMs: 1000 })))).toContain("6 prises");
    expect(addTakeError([{ file: "a.mp4", durationMs: 590_000 }], 20_000)).toContain("10 min");
    expect(addTakeError([{ file: "a.mp4", durationMs: 1000 }], 2000)).toBeNull();
    const removed = removeTake(two.takes!, [{ fromMs: 100, toMs: 900 }, { fromMs: 4100, toMs: 4900 }], 1);
    expect(removed).toEqual({ takes: [{ file: "prise-1.mp4", durationMs: 4000 }], islands: [{ fromMs: 100, toMs: 900 }] });
    const three = [...two.takes!, { file: "prise-3.mp4", durationMs: 2000 }];
    expect(removeTake(three, [{ fromMs: 9100, toMs: 9500 }], 1).islands).toEqual([{ fromMs: 4100, toMs: 4500 }]);
    // Revenir à une seule prise rend la forme d'origine (sans liste de prises).
    expect(withTakes(two, removed.takes)).toEqual({ ...base, ranges: [{ fromMs: 0, toMs: 4000 }] });
  });

  it("le Studio ne change pas les prises ; le rendu embarque toutes les prises", async () => {
    expect(checkStudioEdit({ ...two, takes: [two.takes![0]] }, two, 9000).ok).toBe(false);
    expect(checkStudioEdit(two, two, 9000).ok).toBe(true);
    const read: string[] = [];
    const p = await buildMontageProject(two, [], async (file) => { read.push(file); return new Uint8Array(10); }, async (path) => new TextEncoder().encode(path));
    expect(read).toEqual(["prise-1.mp4", "prise-2.mp4"]);
    expect(p.files.slice(0, 3)).toEqual(["index.html", "prise-1.mp4", "prise-2.mp4"]);
  });
});
