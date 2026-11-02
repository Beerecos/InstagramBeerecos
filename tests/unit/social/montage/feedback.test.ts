import { describe, expect, it } from "vitest";
import { applyFeedbackOps, autoCutRanges, cleanHistory, extractJsonObject } from "@/domain/social/montage/feedback";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import type { Edit } from "@/domain/social/montage/edit";

const WORDS = [
  [" Je", 0, 300], [" présente", 300, 900], [" le", 900, 1000], [" réseau.", 1000, 1500],
  [" Je", 2500, 2800], [" présente", 2800, 3400], [" le", 3400, 3500], [" réseau", 3500, 3900], [" BeeRecos.", 3900, 4600],
].map(([text, startMs, endMs]) => ({ text: text as string, startMs: startMs as number, endMs: endMs as number }));
const EDIT: Edit = { video: "p.mp4", captions: "p.json", accent: "bleu", ranges: [{ fromMs: 0, toMs: 6000 }], subtitles: true, captionStyle: {}, voiceGain: 1, custom: [], sounds: [] };
const apply = (ops: unknown[], edit: Edit = EDIT) => applyFeedbackOps(edit, WORDS, 6000, ops, ANIMATIONS);

describe("retours du Studio : opérations", () => {
  it("coupe, rétablit, règle les sous-titres ; la couleur ne se change pas", () => {
    const r = apply([{ op: "cut", from: 3, to: 0 }, { op: "caption-style", style: { fontSize: 50 } }, { op: "subtitles", on: false }, { op: "accent", value: "vert" }]);
    expect(r.rejected).toEqual([{ op: "accent", why: "opération illisible" }]);
    expect(r.edit).toMatchObject({ ranges: [{ fromMs: 2500, toMs: 6000 }], captionStyle: { fontSize: 50 }, subtitles: false, accent: "bleu" });
    expect(apply([{ op: "restore", from: 0, to: 3 }], r.edit).edit.ranges).toEqual([{ fromMs: 0, toMs: 6000 }]);
  });

  it("écarte l'illisible, le hors transcript et la coupe qui ne garde rien", () => {
    const spoken = { ...EDIT, ranges: [{ fromMs: 0, toMs: 4600 }] };
    const r = apply([{ op: "cut", from: 0, to: 99 }, { op: "cut", from: 0, to: 8 }, { op: "caption-style", style: { top: 100 } }, "n'importe quoi"], spoken);
    expect(r.rejected.map((x) => x.why)).toEqual(["mot introuvable dans le transcript", "cette coupe ne garderait rien", "opération illisible", "opération illisible"]);
    expect(r.edit.ranges).toEqual(spoken.ranges);
  });

  it("retire une animation, et celle dont la phrase est coupée", () => {
    const edit = { ...EDIT, custom: [{ name: "titre", fromMs: 0, toMs: 1400, props: { texte: "Je présente" } }, { name: "titre", fromMs: 2500, toMs: 4000, props: { texte: "le réseau" } }] };
    expect(apply([{ op: "remove-animation", index: 1 }], edit).edit.custom).toHaveLength(1);
    const cut = apply([{ op: "cut", from: 0, to: 3 }], edit);
    expect(cut.edit.custom.map((c) => c.fromMs)).toEqual([2500]);
    expect(cut.applied).toContain("Animation retirée (sa phrase est coupée) : « titre » à 0,0 s");
  });

  it("une animation ajoutée passe le filtre anti-invention", () => {
    const r = apply([{ op: "add-animation", name: "mot-cle", fromMs: 3900, toMs: 5500, props: { mot: "CLUB" } }]);
    expect(r.edit.custom).toEqual([]);
    expect(r.rejected[0].why).toContain("n'est pas prononcé");
  });
});

describe("retours du Studio : utilitaires", () => {
  it("lit l'objet JSON d'une réponse et nettoie l'historique", () => {
    expect(extractJsonObject('Bien sûr : {"reply":"ok","ops":[]} voilà')).toEqual({ reply: "ok", ops: [] });
    expect(extractJsonObject("[1]")).toBeNull();
    expect(cleanHistory([{ role: "user", text: "a".repeat(2000) }, { role: "system", text: "x" }, null])).toEqual([{ role: "user", text: "a".repeat(1000) }]);
  });

  it("tout auto : même coupe suggérée que le panneau Coupe auto", () => {
    expect(autoCutRanges(WORDS, 6000)).toEqual({ ranges: [{ fromMs: 2430, toMs: 4710 }], dropped: 1 });
  });
});
