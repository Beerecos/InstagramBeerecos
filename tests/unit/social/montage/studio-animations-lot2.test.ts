import { describe, expect, it } from "vitest";
import { checkAnimation, renderAnimation } from "@/domain/social/montage/animations";
import { REEL_HEIGHT } from "@/domain/social/montage/brand";
import { CAPTION_DEFAULTS } from "@/domain/social/montage/brand";
import { parseEdit, type Edit } from "@/domain/social/montage/edit";
import { buildEditComposition, videoLayout } from "@/domain/social/montage/edit-composition";
import { SAFE } from "@/domain/social/montage/fx";
import { mediaErrors, usedMedia } from "@/domain/social/montage/media";
import { ANIMATIONS } from "@/domain/social/montage/registry";

// Studio animations, lot 2 (2026-11-11) : réels FILMÉS seulement — sous-titres à deux niveaux, zooms, mises en page,
// objets d'interface. Tout est en temps de la prise : les effets suivent les coupes.
const words = ["Ta", "recommandation", "a", "de", "la", "valeur", "et", "le", "réseau", "te", "recommande"].map((text, i) => ({ text, startMs: 1000 + i * 600, endMs: 1000 + i * 600 + 450 }));
const base = (extra: Record<string, unknown> = {}): Edit => {
  const r = parseEdit({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 20000 }], subtitles: true, captionStyle: { mode: "clean" }, custom: [], ...extra });
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.edit;
};
const compose = (e: Edit) => buildEditComposition(e, words, { assetBase: "." });
const VALEUR = 1000 + 5 * 600;

describe("sous-titres : mots d'accentuation", () => {
  it("le mot choisi est mis en valeur (couleur par défaut) et rebondit quand il est dit", () => {
    const html = compose(base({ motsAccent: [VALEUR] }));
    const span = /<span id="(c\d+-w\d+)" class="acc acc-couleur"[^>]*>valeur<\/span>/.exec(html);
    expect(span).not.toBeNull();
    expect(html).toContain(`tl.fromTo("#${span![1]}", { scale: 1.3 }, { scale: 1, duration: 0.2, ease: "back.out(2)" }, ${VALEUR / 1000});`);
    expect(html).toContain(".caption .acc-couleur");
  });

  it("style « fond » ou « taille » ; aucun accent = rendu d'avant", () => {
    expect(compose(base({ motsAccent: [VALEUR], captionStyle: { mode: "clean", accent: "fond" } }))).toContain('class="acc acc-fond"');
    const plain = compose(base());
    expect(plain).not.toContain("acc-");
    expect(plain).not.toContain(".caption .acc");
  });

  it("après une coupe en amont, le même mot reste accentué, à son nouvel instant", () => {
    const html = compose(base({ motsAccent: [VALEUR], ranges: [{ fromMs: 0, toMs: 1500 }, { fromMs: 2500, toMs: 20000 }] }));
    const id = /<span id="(c\d+-w\d+)" class="acc acc-couleur"[^>]*>valeur<\/span>/.exec(html)![1];
    expect(html).toContain(`tl.fromTo("#${id}", { scale: 1.3 }, { scale: 1, duration: 0.2, ease: "back.out(2)" }, ${(VALEUR - 1000) / 1000});`);
  });
});

describe("zooms d'accentuation et rapprochements progressifs", () => {
  it("prise et détourage reçoivent la même transformation (enveloppes .cadre), ancrée sur le visage", () => {
    const html = compose(base({ zooms: [{ fromMs: 4000, toMs: 6000, type: "accent", amplitude: 1.1 }] }));
    expect(html).toContain('<div id="zw-0" class="cadre"><video id="take-0"');
    expect(html).toContain('tl.set(".cadre", { transformOrigin: "50% 32%" }, 4);');
    expect(html).toContain('tl.to(".cadre", { scale: 1.1, duration: 0.25, ease: "power3.out" }, 4);');
    expect(html).toContain('tl.to(".cadre", { scale: 1, duration: 0.4, ease: "power2.inOut" }, 5.6);');
  });

  it("progressif : rapprochement lent puis retour fluide ; suit une coupe en amont", () => {
    const html = compose(base({ ranges: [{ fromMs: 0, toMs: 1000 }, { fromMs: 2000, toMs: 20000 }], zooms: [{ fromMs: 5000, toMs: 9000, type: "progressif", amplitude: 1.06 }] }));
    expect(html).toContain('tl.to(".cadre", { scale: 1.06, duration: 3.5, ease: "sine.inOut" }, 4);');
    expect(html).toContain('tl.to(".cadre", { scale: 1, duration: 0.5, ease: "power2.inOut" }, 7.5);');
  });

  it("amplitude bornée (3 à 20 %)", () => {
    expect(parseEdit({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 1000 }], zooms: [{ fromMs: 0, toMs: 900, amplitude: 1.5 }] }).ok).toBe(false);
  });
});

describe("vidéo en carte et mosaïque", () => {
  it("carte : la vidéo réduite reste entre le titre et les sous-titres, arrondie", () => {
    const v = videoLayout({ type: "carte", titre: "Découvre un club" }).video;
    const top = REEL_HEIGHT / 2 + v.y - (REEL_HEIGHT * v.scale) / 2, bottom = REEL_HEIGHT / 2 + v.y + (REEL_HEIGHT * v.scale) / 2;
    expect(top).toBeGreaterThanOrEqual(400);
    expect(bottom).toBeLessThan(CAPTION_DEFAULTS.top);
    expect(v.clip).toMatch(/round \d+px/);
  });

  it("mosaïque : tuiles dans les zones de sécurité, au-dessus des sous-titres ; la vidéo occupe la première", () => {
    const { tiles } = videoLayout({ type: "mosaique", titre: "Nos clubs", images: ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"] });
    expect(tiles).toHaveLength(6);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(SAFE.left);
      expect(t.x + t.w).toBeLessThanOrEqual(1080 - SAFE.right);
      expect(t.y + t.h).toBeLessThan(CAPTION_DEFAULTS.top);
    }
  });

  it("composition : fond, images de la bibliothèque, titre ; images embarquées et contrôlées", () => {
    const e = base({ miseEnPage: [{ fromMs: 3000, toMs: 7000, type: "mosaique", titre: "Nos clubs", images: ["club-1.jpg", "club-2.jpg"] }] });
    const html = compose(e);
    expect(html).toContain('id="fond-0"');
    expect(html).toContain('src="./club-1.jpg"');
    expect(html).toContain("Nos clubs");
    expect(html.indexOf('id="fond-0"')).toBeLessThan(html.indexOf('id="zw-0"'));
    expect(usedMedia(e)).toEqual(expect.arrayContaining(["club-1.jpg", "club-2.jpg"]));
    expect(mediaErrors(e, [{ fileName: "club-1.jpg", kind: "image" }] as never)).toEqual([expect.stringContaining("club-2.jpg")]);
  });

  it("mosaïque sans image refusée ; texte externe échappé", () => {
    expect(parseEdit({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 1000 }], miseEnPage: [{ fromMs: 0, toMs: 900, type: "mosaique" }] }).ok).toBe(false);
    expect(compose(base({ miseEnPage: [{ fromMs: 3000, toMs: 7000, titre: "<b>x</b>" }] }))).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("objets d'interface", () => {
  const TYPES = ["touches", "recherche", "saisie", "bouton", "interrupteur", "curseur", "notification", "bulle"];
  it("fiche conforme", () => expect(checkAnimation("objet-interface", ANIMATIONS["objet-interface"])).toEqual([]));
  it.each(TYPES)("%s : se rend sans erreur, identifiants préfixés", (type) => {
    const out = renderAnimation("objet-interface", { type, texte: "Ctrl C", detail: "Club de Lyon" }, { id: "a1", start: 1, duration: 3.5, accent: "#2851FF" }, ANIMATIONS);
    expect(out.error).toBeUndefined();
    for (const [, id] of out.html.matchAll(/\sid="([^"]*)"/g)) expect(id.startsWith("a1")).toBe(true);
  });
  it("recherche : le texte se tape lettre par lettre puis le résultat apparaît", () => {
    const out = renderAnimation("objet-interface", { type: "recherche", texte: "Club", detail: "Club de Lyon" }, { id: "a1", start: 1, duration: 3.5, accent: "#2851FF" }, ANIMATIONS);
    expect(out.tweens.filter((t) => t.includes("textContent")).length).toBe(4);
    expect(out.html).toContain("Club de Lyon");
  });
});
