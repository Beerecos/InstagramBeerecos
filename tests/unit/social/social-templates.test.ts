import { describe, it, expect } from "vitest";
import {
  buildTemplate, DEFAULT_STYLE_MEMORY, TEMPLATE_LABELS, SOCIAL_VISUAL_TEMPLATES, EXPORT_RATIOS,
  type SocialTemplateType, type StyleMemory,
} from "@/domain/social/social-templates";

const ALL: SocialTemplateType[] = ["club_event", "why_join", "club_life", "special_event", "member_spotlight"];

describe("catalogue des 5 templates visuels", () => {
  it("existent tous avec un libellé + une entrée catalogue", () => {
    for (const t of ALL) {
      expect(TEMPLATE_LABELS[t]).toBeTruthy();
      expect(SOCIAL_VISUAL_TEMPLATES.find((m) => m.key === t)).toBeTruthy();
    }
    expect(SOCIAL_VISUAL_TEMPLATES).toHaveLength(5);
  });
  it("catégories attendues (seed 0038)", () => {
    const cats = SOCIAL_VISUAL_TEMPLATES.map((m) => m.category).sort();
    expect(cats).toEqual(["social-acquisition", "social-club-event", "social-club-life", "social-member-spotlight", "social-special-event"]);
  });
  it("formats : carrousels vs visuels uniques", () => {
    expect(buildTemplate("club_event", {}).format).toBe("carousel");
    expect(buildTemplate("why_join", {}).format).toBe("carousel");
    expect(buildTemplate("club_life", {}).format).toBe("carousel");
    expect(buildTemplate("special_event", {}).format).toBe("single");
    expect(buildTemplate("member_spotlight", {}).format).toBe("single");
  });
  it("nombre de slides (carrousels = 5, visuels uniques = 1)", () => {
    expect(buildTemplate("club_event", {}).slides).toHaveLength(5);
    expect(buildTemplate("why_join", {}).slides).toHaveLength(5);
    expect(buildTemplate("club_life", {}).slides).toHaveLength(5);
    expect(buildTemplate("special_event", {}).slides).toHaveLength(1);
    expect(buildTemplate("member_spotlight", {}).slides).toHaveLength(1);
    // Le nombre de slides construit correspond au catalogue (slideCount)
    for (const t of ALL) {
      const meta = SOCIAL_VISUAL_TEMPLATES.find((m) => m.key === t)!;
      expect(buildTemplate(t, {}).slides.length).toBe(meta.slideCount);
    }
  });
  it("ratios d'export : dimensions réelles, jamais « 4K » comme dimension unique", () => {
    expect(EXPORT_RATIOS["4:5"]).toEqual({ label: "Instagram 1080×1350", w: 1080, h: 1350 });
    expect(EXPORT_RATIOS["9:16"].w).toBe(1080);
    expect(EXPORT_RATIOS["9:16"].h).toBe(1920);
    // special_event propose bien story + carré
    expect(buildTemplate("special_event", {}).ratios).toContain("9:16");
    expect(buildTemplate("special_event", {}).ratios).toContain("1:1");
  });
});

describe("données manquantes (§3 : jamais inventées)", () => {
  it("liste les champs manquants et laisse un placeholder", () => {
    const t = buildTemplate("club_event", {});
    expect(t.missing).toContain("club.name");
    expect(t.missing).toContain("event.date");
    expect(JSON.stringify(t)).toContain("⟨club.name⟩");
  });
  it("données fournies → pas de manquant pour ces champs", () => {
    const t = buildTemplate("member_spotlight", { member: { first_name: "Thomas", last_name: "Durand", company: "ACME", profession: "Architecte", club: "Chiberta Business Club" } });
    expect(t.missing).toHaveLength(0);
    // Identité et club apparaissent dans la composition (légende + overlay), le CTA suit la maquette.
    expect(t.caption).toContain("Thomas");
    expect(t.caption).toContain("Chiberta Business Club");
    expect(JSON.stringify(t.slides[0].visual.overlay)).toContain("Thomas Durand");
  });
});

describe("séparation LAYOUT / IMAGE + logos dynamiques", () => {
  it("la palette de la mémoire est injectée dans le brief visuel (aiPrompt)", () => {
    const t = buildTemplate("club_event", { club: { name: "X", city: "Bayonne" } });
    expect(t.slides[0].visual.aiPrompt).toContain(DEFAULT_STYLE_MEMORY.palette.primary);
    expect(t.slides[0].visual.aiPrompt).toContain(DEFAULT_STYLE_MEMORY.palette.secondary);
    expect(t.slides[0].visual.aiPrompt.toLowerCase()).toContain("jamais de violet");
  });
  it("une mémoire personnalisée change palette + hashtags + signature", () => {
    const mem: StyleMemory = { ...DEFAULT_STYLE_MEMORY, palette: { ...DEFAULT_STYLE_MEMORY.palette, primary: "#123456" }, defaultHashtags: ["#Test"], signature: "Signé BeeRecos" };
    const t = buildTemplate("special_event", { event: { name: "Gala" } }, mem);
    expect(t.slides[0].visual.aiPrompt).toContain("#123456");
    expect(t.hashtags).toContain("#Test");
    expect(t.caption).toContain("Signé BeeRecos");
  });
  it("le fond IA ne contient jamais logo/texte/date/CTA (§55)", () => {
    const t = buildTemplate("why_join", {});
    const p = t.slides[0].visual.aiPrompt.toUpperCase();
    expect(p).toContain("AUCUN LOGO");
    expect(p).toContain("AUCUN TEXTE");
    expect(t.slides[0].visual.logo.toLowerCase()).toContain("zone de sécurité");
  });
  it("chaque slide expose des logo_slots (0..N), logo_beerecos par défaut", () => {
    const t = buildTemplate("club_event", { club: { name: "X", city: "Y" } });
    for (const s of t.slides) expect(s.visual.logoSlots).toContain("logo_beerecos");
    // slide événement peut porter le logo lieu ; slide 1 porte le logo club
    expect(t.slides[0].visual.logoSlots).toContain("logo_club");
  });
  it("photo_strategy : vie du club exige des photos réelles ; membre exige un portrait", () => {
    const life = buildTemplate("club_life", {});
    expect(life.slides[1].visual.photoStrategy).toBe("real_required");
    const member = buildTemplate("member_spotlight", {});
    expect(member.slides[0].visual.photoStrategy).toBe("portrait_required");
  });
});

describe("alignement sur la maquette validée (2026-09-13)", () => {
  it("T1 club_event : ordre hook → infos → pourquoi → réseau → cta", () => {
    const roles = buildTemplate("club_event", {}).slides.map((s) => s.role);
    expect(roles).toEqual(["hook", "infos", "pourquoi", "reseau", "cta"]);
  });
  it("T2 why_join : un pilier par slide (réseau / formation / digitalisation) + CTA final", () => {
    const roles = buildTemplate("why_join", {}).slides.map((s) => s.role);
    expect(roles).toEqual(["hook", "constat", "reseau", "formation", "digitalisation"]);
    const last = buildTemplate("why_join", { club: { link: "u" } }).slides[4];
    expect(JSON.stringify(last.visual.overlay)).toContain("Visitez un club");
  });
  it("T4 special_event & T5 member_spotlight : tagline manuscrite présente", () => {
    const t4 = buildTemplate("special_event", { event: { name: "BeeToBee" } });
    expect(JSON.stringify(t4.slides[0].visual.overlay)).toContain("tagline_manuscrite");
    const t5 = buildTemplate("member_spotlight", { member: { first_name: "A", last_name: "B" } });
    expect(JSON.stringify(t5.slides[0].visual.overlay)).toContain("tagline_manuscrite");
  });
  it("le fond suit la direction artistique de la maquette (bleu nuit, photo assombrie)", () => {
    const p = buildTemplate("club_event", { club: { name: "X", city: "Rennes" } }).slides[0].visual.aiPrompt.toLowerCase();
    expect(p).toContain("bleu nuit");
  });
});

describe("légende (§63)", () => {
  it("contient hashtags et CTA/lien", () => {
    const t = buildTemplate("club_event", { club: { name: "Maignon", city: "Bayonne" }, event: { date: "6 octobre", time: "10h-12h", location: "Bayonne", url: "https://x" } });
    expect(t.caption).toContain(t.hashtags[0]);
    expect(t.caption).toContain("https://x");
  });
});
