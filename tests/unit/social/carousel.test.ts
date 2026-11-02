import { describe, expect, it } from "vitest";
import { accentsFor, cardItems, carouselChecks, emphasis, fileName, isBaseline, looksLikeBaseline, newSlide, safeColor, starterCarousel, tabStyle, type Carousel } from "@/domain/social/carousel";
import { COLORS } from "@/domain/social/reel-story/brand";

const carousel = (patch: Partial<Carousel> = {}): Carousel => ({ ...starterCarousel(), ...patch });
const failed = (c: Carousel) => carouselChecks(c).filter((x) => !x.ok).map((x) => x.key);

describe("studio de carrousels", () => {
  it("le carrousel de départ passe tous les contrôles (aucun chiffre, CTA en fin et en légende)", () => {
    expect(failed(carousel())).toEqual([]);
  });
  it("*mot* est mis en valeur, le reste est gardé tel quel", () => {
    expect(emphasis("Ton réseau *mérite* mieux")).toEqual([{ text: "Ton réseau ", em: false }, { text: "mérite", em: true }, { text: " mieux", em: false }]);
    expect(emphasis("sans accent")).toEqual([{ text: "sans accent", em: false }]);
  });
  it("couverture trop longue, slide trop chargée, slide sans titre : bloquant", () => {
    const c = carousel();
    c.slides[0] = { ...c.slides[0], title: "Un titre de couverture beaucoup trop long pour arrêter le pouce en une seconde" };
    c.slides[1] = { ...c.slides[1], body: Array.from({ length: 30 }, () => "mot").join(" ") };
    c.slides[2] = { ...c.slides[2], title: "" };
    expect(failed(c)).toEqual(expect.arrayContaining(["couverture", "slides_mots", "titres"]));
  });
  it("graphie fautive, promesse interdite : bloquant ; un chiffre exige une source (à vérifier)", () => {
    const c = carousel();
    c.slides[1] = { ...c.slides[1], title: "Beerecos garanti" };
    c.slides.splice(2, 0, newSlide("bignum", { bignum: "120", toplabel: "membres", title: "x" }));
    const checks = carouselChecks(c);
    expect(checks.find((x) => x.key === "marque")?.ok).toBe(false);
    expect(checks.find((x) => x.key === "interdits")?.ok).toBe(false);
    expect(checks.find((x) => x.key === "chiffres")).toMatchObject({ ok: false, level: "à vérifier" });
  });
  it("CTA : la dernière slide (bulle du mot-clé) et la légende doivent porter le mot-clé", () => {
    expect(failed(carousel({ keyword: "FORMATION" }))).toEqual(["cta_legende"]);
    expect(failed(carousel({ keyword: "" }))).toEqual(expect.arrayContaining(["cta_fin", "cta_legende"]));
    const c = carousel();
    c.slides.push(newSlide("plain", { title: "Encore une" }));
    expect(failed(c)).toContain("cta_fin");
  });
  it("couleurs : bleu, noir et blanc seulement, rien d'illisible selon le fond", () => {
    for (const bg of ["blue", "black", "white"] as const) {
      expect(accentsFor({ img: null, background: bg })).not.toContain(COLORS.green);
      expect(accentsFor({ img: null, background: bg })).not.toContain(COLORS.violet);
    }
    expect(accentsFor({ img: null, background: "blue" })).toEqual([COLORS.white]);
    expect(safeColor({ img: null, background: "white" }, COLORS.white)).toBe(COLORS.blue);
    expect(safeColor({ img: "data:", background: "blue" }, COLORS.violet)).toBe(COLORS.white);
  });
  it("modèle de départ = maquettes du 2026-10-22 : couverture bleue, carte d'étapes, fin avec bulle", () => {
    const c = starterCarousel();
    expect(c.slides.map((s) => [s.type, s.background])).toEqual([["cover", "blue"], ["card", "white"], ["outro", "white"]]);
    expect(c.slides.every((s) => s.sig === "#MonReseauCestTonReseau")).toBe(true);
    expect(cardItems(c.slides[1])).toEqual(["Enregistrée", "Qualifiée", "Réciproque"]);
    expect(cardItems({ items: " a \n\n b \n c\nd\ne\nf" })).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("le texte de la carte compte dans les contrôles (mots, chiffres)", () => {
    const c = carousel();
    c.slides[1] = { ...c.slides[1], items: "Étape 1\nÉtape 2" };
    expect(carouselChecks(c).find((x) => x.key === "chiffres")).toMatchObject({ ok: false, proof: expect.stringContaining("slide 2") });
  });
  it("nom des fichiers exportés", () => {
    expect(fileName(0)).toBe("beerecos_carrousel_slide_01.png");
    expect(fileName(11)).toBe("beerecos_carrousel_slide_12.png");
  });
});

describe("baseline et onglets (règles de rendu 2026-10-21)", () => {
  it("seule la baseline exacte passe en écriture manuscrite ; une variante est signalée", () => {
    expect(isBaseline("#MonReseauCestTonReseau")).toBe(true);
    expect(isBaseline("#monreseaucesttonreseau")).toBe(false);
    for (const t of ["#Mon réseau c'est ton réseau", "#MonRéseauCestTonRéseau.", "#monreseaucesttonreseau"]) expect(looksLikeBaseline(t)).toBe(true);
    expect(looksLikeBaseline("#MonReseauCestTonReseau")).toBe(false);
    expect(looksLikeBaseline("Rejoins un club")).toBe(false);
  });
  it("contrôle bloquant sur une baseline mal écrite en slide de fin", () => {
    const c = starterCarousel();
    const last = c.slides[c.slides.length - 1];
    expect(carouselChecks(c).find((x) => x.key === "baseline")?.ok).toBe(true);
    last.sig = "#Mon Reseau Cest Ton Reseau";
    const check = carouselChecks(c).find((x) => x.key === "baseline");
    expect(check?.ok).toBe(false);
    expect(check?.level).toBe("bloquant");
  });
  it("onglet bleu texte blanc sur fond clair, blanc texte noir accent bleu sur fond sombre", () => {
    expect(tabStyle(false)).toEqual({ background: COLORS.blue, color: COLORS.white, accent: null });
    expect(tabStyle(true)).toEqual({ background: COLORS.white, color: "#000000", accent: COLORS.blue });
  });
});
