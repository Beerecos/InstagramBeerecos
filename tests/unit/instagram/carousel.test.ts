import { describe, expect, it } from "vitest";
import { INVITATION, fitSize, normalizePlan, parsePlan, planBrief, SlideSchema } from "@/domain/instagram/carousel";
import { INSPI_CTA } from "@/domain/instagram/story-caption";

const slide = (patch: Record<string, unknown>) => SlideSchema.parse({ layout: "affiche", title: "Du fluo lisible", ...patch });

describe("visuels de carrousel", () => {
  it("8 slides au plus, l'invitation officielle toujours en dernier et une seule fois", () => {
    const many = Array.from({ length: 12 }, (_, i) => slide({ title: `Slide ${i}` }));
    const plan = normalizePlan([slide({ layout: "invitation", title: "Autre invitation" }), ...many], 0);
    expect(plan).toHaveLength(8);
    expect(plan.at(-1)).toMatchObject({ layout: "invitation", title: INVITATION.title, number: "INSPI" });
    expect(plan.filter((s) => s.layout === "invitation")).toHaveLength(1);
  });

  it("l'invitation reprend exactement le texte du CTA", () => {
    expect(INSPI_CTA).toBe(`${INVITATION.title}\n${INVITATION.prefix} « ${INVITATION.number} » ${INVITATION.text}`);
  });

  it("ne garde que les photos réellement fournies et un mot en bleu présent dans le titre", () => {
    const [s] = normalizePlan([slide({ photo: 3, photo2: 1, accent: "fluo" }), slide({ accent: "absent" })], 2);
    expect(s).toMatchObject({ photo: null, photo2: 1, accent: "fluo" });
    expect(normalizePlan([slide({ accent: "absent" })], 0)[0].accent).toBe("");
  });

  it("lit le JSON de l'IA même entouré de texte, et refuse un plan illisible", () => {
    const text = 'Voici le plan : {"slides":[{"layout":"couverture","title":"Il a marqué nos cours.","accent":"marqué","photo":1}]} Bonne journée';
    const plan = parsePlan(text, 1);
    expect(plan[0]).toMatchObject({ layout: "couverture", accent: "marqué", photo: 1 });
    expect(plan).toHaveLength(2);
    expect(() => parsePlan("pas de plan", 0)).toThrow(/lisible/);
    expect(() => parsePlan('{"slides":[{"layout":"inconnu"}]}', 0)).toThrow(/incomplet/);
  });

  it("la consigne liste les modèles, les photos et interdit d'inventer", () => {
    const brief = planBrief("STABILO BOSS", "1971 : lancement (STABILO)", ["surligneur jaune détouré"]);
    expect(brief).toContain("chiffre-noir");
    expect(brief).toContain("photo 1 : surligneur jaune détouré");
    expect(brief).toMatch(/n'invente ni chiffre/);
    expect(planBrief("x", "y", [])).toContain("compositions typographiques uniquement");
  });

  it("réduit le titre long au lieu de le couper", () => {
    expect(fitSize("Il a marqué", 150, 20, 80)).toBe(150);
    expect(fitSize("x".repeat(80), 150, 20, 80)).toBe(80);
    expect(fitSize("x".repeat(30), 150, 20, 80)).toBeLessThan(150);
  });
});
