import { describe, it, expect } from "vitest";
import { renderSlideSvg, wrapText, toAspect, ASPECT_DIMS, escapeXml } from "@/domain/social/social-layout";
import { ICONS, iconForText, iconForRole } from "@/domain/social/social-icons";
import { assemblePublication } from "@/domain/social/social-publication";
import { DEFAULT_STYLE_MEMORY } from "@/domain/social/social-templates";

describe("icônes", () => {
  it("chaque icône a un contenu SVG non vide", () => {
    for (const [name, markup] of Object.entries(ICONS)) {
      expect(markup, name).toBeTruthy();
      expect(markup).toMatch(/<(path|circle|rect)/);
    }
  });
  it("choix d'icône déterministe par texte et par rôle", () => {
    expect(iconForText("Rencontrer des dirigeants")).toBe("network");
    expect(iconForText("Créer des opportunités")).toBe("growth");
    expect(iconForText("Développez vos compétences")).toBe("formation");
    expect(iconForText("Des outils innovants")).toBe("digital");
    expect(iconForRole("date")).toBe("calendar");
    expect(iconForRole("location")).toBe("location");
    expect(iconForRole("inconnu")).toBeNull();
  });
});

describe("utilitaires de layout", () => {
  it("wrapText coupe aux espaces sans dépasser maxChars", () => {
    const lines = wrapText("un deux trois quatre cinq", 10);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(10);
    expect(lines.join(" ")).toBe("un deux trois quatre cinq");
  });
  it("toAspect normalise les ratios d'export", () => {
    expect(toAspect("4:5")).toBe("4:5");
    expect(toAspect("4:5hd")).toBe("4:5");
    expect(toAspect("9:16")).toBe("9:16");
    expect(toAspect("1:1")).toBe("1:1");
  });
  it("escapeXml protège les caractères spéciaux", () => {
    expect(escapeXml('a & b < c > "d"')).toBe("a &amp; b &lt; c &gt; &quot;d&quot;");
  });
});

function firstSlide(type: Parameters<typeof assemblePublication>[0]["type"], data = {}) {
  return assemblePublication({ type, data }).slides[0];
}

describe("renderSlideSvg (image composée finale)", () => {
  it("produit un SVG valide aux bonnes dimensions selon l'aspect", () => {
    const s = firstSlide("club_event", { club: { name: "Rennes BC", city: "Rennes" }, event: { date: "6 oct", time: "10h", location: "Centre", url: "u" } });
    const svg = renderSlideSvg(s, { memory: DEFAULT_STYLE_MEMORY, aspect: "4:5" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`width="${ASPECT_DIMS["4:5"].w}"`);
    expect(svg).toContain(`height="${ASPECT_DIMS["4:5"].h}"`);
    expect(svg).toContain("viewBox=\"0 0 1080 1350\"");
    const story = renderSlideSvg(s, { memory: DEFAULT_STYLE_MEMORY, aspect: "9:16" });
    expect(story).toContain(`height="1920"`);
  });

  it("grave le texte du headline (échappé)", () => {
    const s = firstSlide("club_event", {});
    const svg = renderSlideSvg(s, { memory: DEFAULT_STYLE_MEMORY });
    // Le headline est enveloppé sur plusieurs lignes <text> ; on vérifie les mots gravés.
    expect(svg).toContain("rencontrait");
    expect(svg).toContain("prochain");
  });

  it("colore le mot-clé (accent) en bleu dans le headline", () => {
    const s = firstSlide("club_event", {});
    const svg = renderSlideSvg(s, { memory: DEFAULT_STYLE_MEMORY });
    // Un tspan bleu enveloppe le mot-clé « CLUB ».
    expect(svg).toMatch(/<tspan fill="#2851FF">CLUB<\/tspan>/i);
  });

  it("grave une pilule CTA bleue avec flèche quand un CTA est présent", () => {
    const s = assemblePublication({ type: "club_event", data: { club: { name: "X", city: "Y" }, event: { date: "1", time: "2", location: "L", url: "u" } } }).slides[4];
    const svg = renderSlideSvg(s, { memory: DEFAULT_STYLE_MEMORY });
    expect(svg).toContain('<rect'); // pilule
    expect(svg).toContain("JE M&apos;INSCRIS MAINTENANT"); // label CTA gravé (majuscules, échappé)
    expect(svg).toContain('fill="#2851FF"'); // pilule bleue
  });

  it("grave les logos résolus (bibliothèque de logos) dans le rendu", () => {
    const s = firstSlide("club_event", { club: { name: "X", city: "Y" } });
    const svg = renderSlideSvg(s, { memory: DEFAULT_STYLE_MEMORY, logos: [{ slot: "logo_beerecos", href: "https://x/logo.png" }] });
    expect(svg).toContain('<image href="https://x/logo.png"');
  });

  it("utilise le fond fourni (média réel/IA) en <image>, sinon un dégradé bleu nuit", () => {
    const s = firstSlide("club_event", {});
    const withBg = renderSlideSvg(s, { memory: DEFAULT_STYLE_MEMORY, backgroundHref: "data:image/png;base64,AAA" });
    expect(withBg).toContain('<image href="data:image/png;base64,AAA"');
    const noBg = renderSlideSvg(s, { memory: DEFAULT_STYLE_MEMORY });
    expect(noBg).toContain('fill="url(#bgGrad)"');
  });

  it("grave la tagline manuscrite pour l'événement spécial et le membre à l'honneur", () => {
    const t4 = firstSlide("special_event", { event: { name: "BeeToBee" } });
    expect(renderSlideSvg(t4, { memory: DEFAULT_STYLE_MEMORY })).toContain("Plus qu'un réseau, une dynamique.".replace(/'/g, "&apos;"));
    const t5 = firstSlide("member_spotlight", { member: { first_name: "Julien", last_name: "Martin" } });
    expect(renderSlideSvg(t5, { memory: DEFAULT_STYLE_MEMORY })).toContain("Poppins");
  });
});
