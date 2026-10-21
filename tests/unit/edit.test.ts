import { describe, expect, it } from "vitest";
import { captionPages, layout, parseEdit, remapCaptions, toOutputMs, totalMs, type CaptionWord } from "@/domain/video/edit";
import { KIT_ANIMATIONS, renderAnimation } from "@/domain/video/animations";
import { buildEditComposition } from "@/domain/video/edit-composition";

const EDIT = {
  video: "prise.mp4",
  captions: "prise.json",
  ranges: [
    { fromMs: 0, toMs: 600 },
    { fromMs: 2000, toMs: 3000 },
  ],
  custom: [{ name: "titre", fromMs: 100, toMs: 2500, props: { texte: "Bonjour" } }],
};
const WORDS: CaptionWord[] = [
  { text: " Bonjour", startMs: 100, endMs: 400 },
  { text: " euh", startMs: 900, endMs: 1200 },
  { text: " à", startMs: 2100, endMs: 2200 },
  { text: " tous", startMs: 2200, endMs: 2600 },
];
const ctx = { id: "a0", start: 1, duration: 2, accent: "#693BFC" };

describe("edit.json : schéma et cohérence", () => {
  it("accepte un montage minimal et applique les valeurs par défaut", () => {
    const r = parseEdit({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 5000 }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.edit).toMatchObject({ accent: "violet", subtitles: true, voiceGain: 1, custom: [], sounds: [] });
  });

  it("refuse les clés inconnues, valeurs hors liste et chemins de fichier, avec des messages en français", () => {
    const r = parseEdit({ video: "../secret.mp4", accent: "rouge", ranges: [{ fromMs: 0, toMs: 1 }], foo: 1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain("• video → nom de fichier simple attendu (lettres, chiffres, . _ -)");
    expect(r.errors).toContain("• accent → valeur non autorisée — choix possibles : violet, vert");
    expect(r.errors).toContain("• (racine) → clé inconnue : foo");
  });

  it("signale clés manquantes et types incorrects", () => {
    const r = parseEdit({ ranges: [{ fromMs: "0", toMs: 1 }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain("• video → clé obligatoire manquante");
    expect(r.errors).toContain("• ranges[0].fromMs → nombre attendu");
  });

  it("refuse des morceaux non triés, qui se chevauchent ou vides", () => {
    const r = parseEdit({ video: "p.mp4", ranges: [{ fromMs: 1000, toMs: 2000 }, { fromMs: 1500, toMs: 1400 }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.startsWith("• ranges[1] → toMs"))).toBe(true);
    expect(r.errors.some((e) => e.includes("chevauche"))).toBe(true);
  });
});

describe("temps : prise → montage", () => {
  const segs = layout(EDIT.ranges);

  it("pose les morceaux bout à bout", () => {
    expect(segs).toEqual([
      { fromMs: 0, toMs: 600, atMs: 0 },
      { fromMs: 2000, toMs: 3000, atMs: 600 },
    ]);
    expect(totalMs(segs)).toBe(1600);
  });

  it("F(ms) : dans un morceau, dans une coupe (saut au raccord), après la fin", () => {
    expect(toOutputMs(segs, 300)).toBe(300);
    expect(toOutputMs(segs, 1000)).toBe(600);
    expect(toOutputMs(segs, 2500)).toBe(1100);
    expect(toOutputMs(segs, 9000)).toBe(1600);
  });

  it("recale le transcript : les mots coupés disparaissent, les autres suivent le montage", () => {
    const out = remapCaptions(WORDS, segs);
    expect(out.map((w) => w.text.trim())).toEqual(["Bonjour", "à", "tous"]);
    expect(out[1]).toMatchObject({ startMs: 700, endMs: 800 });
  });

  it("pages karaoké : 4 mots ou 26 caractères au plus, nouvelle page après un silence", () => {
    const w = (text: string, startMs: number): CaptionWord => ({ text, startMs, endMs: startMs + 200 });
    const pages = captionPages([w("un", 0), w("deux", 200), w("trois", 400), w("quatre", 600), w("cinq", 800), w("loin", 3000)]);
    expect(pages.map((p) => p.words.map((x) => x.text).join(" "))).toEqual(["un deux trois quatre", "cinq", "loin"]);
    expect(captionPages([w("anticonstitutionnellement", 0), w("bien", 200)])).toHaveLength(2);
  });
});

describe("registre d'animations", () => {
  it("rend une animation du kit, texte échappé", () => {
    const out = renderAnimation("titre", { texte: "<script>x</script>" }, ctx);
    expect(out.error).toBeUndefined();
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).not.toContain("<script>");
    expect(out.tweens.length).toBeGreaterThan(0);
  });

  it("barrière d'erreur : nom inconnu, réglages invalides ou exception → bandeau, jamais d'échec", () => {
    expect(renderAnimation("inconnue", {}, ctx).error).toBe("Animation « inconnue » introuvable");
    expect(renderAnimation("mot-cle", { mot: "club x" }, ctx).error).toContain("mot-clé en majuscules");
    expect(renderAnimation("toString", {}, ctx).error).toContain("introuvable");
    const boom = { ...KIT_ANIMATIONS, boom: { ...KIT_ANIMATIONS.titre, render: () => { throw new Error("cassé"); } } };
    const out = renderAnimation("boom", { texte: "x" }, ctx, boom);
    expect(out.error).toBe("Animation « boom » : cassé");
    expect(out.html).toContain("anim-erreur");
  });

  it("chaque animation du kit a une fiche complète", () => {
    for (const def of Object.values(KIT_ANIMATIONS)) {
      expect(def.label).toBeTruthy();
      expect(def.description.length).toBeGreaterThan(20);
      expect(def.lengthMs).toBeGreaterThan(0);
    }
  });
});

describe("composition Hyperframes d'un montage", () => {
  const html = buildEditComposition(EDIT, WORDS, { assetBase: "https://app.test/hyperframes/", mediaBase: "./media" });

  it("un clip vidéo par morceau, en temps du montage et décalé dans la prise", () => {
    expect(html).toContain('data-duration="1.6" data-fps="30"');
    expect(html).toContain('<video id="take-0" class="take" src="./media/prise.mp4" data-start="0" data-duration="0.6" data-media-start="0" data-has-audio="true"');
    expect(html).toContain('<video id="take-1" class="take" src="./media/prise.mp4" data-start="0.6" data-duration="1" data-media-start="2"');
    expect(html).not.toContain("crossorigin");
  });

  it("animations ancrées en ms de la prise, converties par F(ms)", () => {
    expect(html).toContain('<div id="anim-0" class="clip anim-host" data-start="0.1" data-duration="1"');
  });

  it("sous-titres karaoké sans les mots coupés", () => {
    expect(html).toContain('<span id="c0-w0">Bonjour</span>');
    expect(html).not.toContain("euh");
    expect(html).toContain('tl.to("#c1-w0", { color: "#ffffff", duration: 0.08, ease: "none" }, 0.7);');
    expect(buildEditComposition({ ...EDIT, subtitles: false }, WORDS, { assetBase: "." })).not.toContain('class="clip caption"');
  });

  it("refuse un edit.json invalide", () => {
    expect(() => buildEditComposition({ ...EDIT, ranges: [] }, WORDS, { assetBase: "." })).toThrow(/edit.json invalide/);
  });
});
