import { describe, expect, it } from "vitest";
import { ACCENT, ALERT, COLORS, DEFAULT_ACCENT } from "@/domain/social/montage/brand";
import { COLORS as REEL_COLORS, FONT_FAMILY } from "@/domain/social/reel-story/brand";
import { KIT_ANIMATIONS, ERROR_CSS, renderAnimation } from "@/domain/social/montage/animations";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { charteErrors, charteIssues, charteWarnings } from "@/domain/social/montage/charte";
import { checkStudioEdit } from "@/domain/social/montage/studio";
import { parseEdit, type Edit } from "@/domain/social/montage/edit";

const CHARTE = new Set(Object.values(COLORS).map((c) => c.toUpperCase()));
const hexes = (css: string) => [...css.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase());
const EDIT: Edit = { video: "p.mp4", accent: "bleu", ranges: [{ fromMs: 0, toMs: 8000 }], subtitles: true, captionStyle: {}, voiceGain: 1, custom: [], sounds: [] };

describe("charte BeeRecos des vidéos montées", () => {
  it("même palette et même police que les Reels IA ; accent bleu par défaut", () => {
    expect(COLORS).toEqual(REEL_COLORS);
    expect(FONT_FAMILY).toBe("Poppins");
    expect(DEFAULT_ACCENT).toBe("bleu");
    expect(ACCENT.bleu).toBe("#2851FF");
  });

  it("chaque template n'utilise que des couleurs de la charte (contrôle mesuré)", () => {
    for (const [name, def] of Object.entries(KIT_ANIMATIONS)) {
      const html = renderAnimation(name, def.example, { id: "a0", start: 0, duration: def.lengthMs / 1000, accent: ACCENT[DEFAULT_ACCENT] }, KIT_ANIMATIONS).html;
      expect(hexes(def.css + html).filter((h) => !CHARTE.has(h)), name).toEqual([]);
    }
    expect(hexes(ERROR_CSS).filter((h) => !CHARTE.has(h))).toEqual([ALERT.toUpperCase()]);
    const page = buildEditComposition({ ...EDIT, custom: [{ name: "titre", fromMs: 0, toMs: 2000, props: { texte: "Le réseau" } }] }, [], { assetBase: "." });
    expect(hexes(page).filter((h) => !CHARTE.has(h) && h !== ALERT.toUpperCase())).toEqual([]);
    expect(page).toContain('font-family: "Poppins"');
  });

  it("refuse le nom de marque mal écrit et la baseline déformée", () => {
    expect(charteIssues("Rejoins Beerecos et BEE RECOS")).toEqual(["« Beerecos », « BEE RECOS » : écrire BeeRecos"]);
    expect(charteIssues("#monreseaucesttonreseau")).toHaveLength(1);
    expect(charteIssues("Mon réseau c'est ton réseau")).toHaveLength(1);
    expect(charteIssues("Rejoins BeeRecos #MonReseauCestTonReseau")).toEqual([]);
    const bad = { ...EDIT, custom: [{ name: "titre", fromMs: 0, toMs: 2000, props: { texte: "Le club Beerecos" } }] };
    expect(charteErrors(bad)).toEqual(["• custom[0] (titre) → « Beerecos » : écrire BeeRecos"]);
    const checked = checkStudioEdit(bad, EDIT, 8000);
    expect(checked.ok ? [] : checked.errors).toContain("• custom[0] (titre) → « Beerecos » : écrire BeeRecos");
  });

  it("accent bleu seul : un ancien montage violet ou vert se relit en bleu", () => {
    expect(parseEdit({ ...EDIT, accent: "violet" })).toMatchObject({ ok: true, edit: { accent: "bleu" } });
    expect(parseEdit({ ...EDIT, accent: "vert" })).toMatchObject({ ok: true, edit: { accent: "bleu" } });
    expect(Object.keys(ACCENT)).toEqual(["bleu"]);
  });

  it("avertit : logo de fin absent, sans baseline ou trop tôt", () => {
    expect(charteWarnings(EDIT)).toEqual(["Pas de logo BeeRecos de fin (conclusion du prompt maître : logo officiel et baseline)."]);
    expect(charteWarnings({ ...EDIT, custom: [{ name: "logo-fin", fromMs: 6500, toMs: 8000, props: { baseline: true } }] })).toEqual([]);
    expect(charteWarnings({ ...EDIT, custom: [{ name: "logo-fin", fromMs: 6500, toMs: 8000, props: {} }] })).toEqual([]);
    expect(charteWarnings({ ...EDIT, custom: [{ name: "logo-fin", fromMs: 500, toMs: 2000, props: { baseline: false } }] })).toEqual([
      "Logo de fin sans la baseline #MonReseauCestTonReseau.", "Logo de fin posé plus de 6 s avant la fin : il doit clore la vidéo.",
    ]);
  });
});
