import { describe, it, expect } from "vitest";
import {
  buildVariableContext, resolveVariables, missingMarker,
  isTextVariable, isMediaVariable, TEXT_VARIABLES, MEDIA_VARIABLES,
} from "@/domain/social/social-variables";
import type { TemplateData } from "@/domain/social/social-templates";

const DATA: TemplateData = {
  club: { name: "Maignon Business Club", city: "Bayonne", link: "https://beerecos.com/maignon" },
  event: { date: "6 octobre", time: "10h-12h", location: "Le Patio", address: "12 rue X", name: "Réunion" },
  member: { first_name: "Julien", last_name: "Martin", profession: "Architecte", company: "ACME", quote: "J'ai triplé mon réseau." },
};

describe("vocabulaire de variables", () => {
  it("distingue variables texte et média", () => {
    expect(isTextVariable("nom_club")).toBe(true);
    expect(isTextVariable("heure_evenement")).toBe(true);
    expect(isMediaVariable("photo_club")).toBe(true);
    expect(isMediaVariable("logo_club")).toBe(true);
    expect(isTextVariable("photo_club")).toBe(false);
    expect(TEXT_VARIABLES).toContain("citation");
    expect(MEDIA_VARIABLES).toContain("logo_partenaire");
  });
});

describe("buildVariableContext (depuis club/événement/membre)", () => {
  it("mappe les champs réels", () => {
    const ctx = buildVariableContext(DATA);
    expect(ctx.nom_club).toBe("Maignon Business Club");
    expect(ctx.ville).toBe("Bayonne");
    expect(ctx.lieu).toBe("Le Patio");
    expect(ctx.adresse).toBe("12 rue X");
    expect(ctx.heure_evenement).toBe("10h-12h");
    expect(ctx.lien_club).toBe("https://beerecos.com/maignon");
    expect(ctx.prenom).toBe("Julien");
    expect(ctx.entreprise).toBe("ACME");
    expect(ctx.citation).toBe("J'ai triplé mon réseau.");
  });
  it("les champs absents ne sont pas inventés (clé absente du contexte)", () => {
    const ctx = buildVariableContext({ club: { name: "X" } });
    expect(ctx.nom_club).toBe("X");
    expect("ville" in ctx).toBe(false);
    expect("prenom" in ctx).toBe(false);
  });
});

describe("resolveVariables (§3 : jamais inventé)", () => {
  it("remplace les variables texte renseignées", () => {
    const ctx = buildVariableContext(DATA);
    const r = resolveVariables("Réunion de {{nom_club}} à {{ville}} le {{date_evenement}} ({{heure_evenement}})", ctx);
    expect(r.text).toBe("Réunion de Maignon Business Club à Bayonne le 6 octobre (10h-12h)");
    expect(r.missing).toHaveLength(0);
  });
  it("laisse un marqueur « donnée manquante » et liste la variable manquante", () => {
    const ctx = buildVariableContext({ club: { name: "X" } });
    const r = resolveVariables("À {{ville}}, le {{date_evenement}}", ctx);
    expect(r.missing).toEqual(expect.arrayContaining(["ville", "date_evenement"]));
    expect(r.text).toContain(missingMarker("ville"));
    expect(r.text).not.toContain("{{ville}}");
  });
  it("conserve les variables média (résolues par la médiathèque) et les signale", () => {
    const r = resolveVariables("Fond {{photo_club}} + {{logo_club}}", buildVariableContext(DATA));
    expect(r.mediaVars).toEqual(expect.arrayContaining(["photo_club", "logo_club"]));
    expect(r.text).toContain("{{photo_club}}");
    expect(r.missing).toHaveLength(0);
  });
  it("signale les variables inconnues sans les résoudre", () => {
    const r = resolveVariables("{{truc_inconnu}}", {});
    expect(r.unknown).toEqual(["truc_inconnu"]);
    expect(r.text).toContain("{{truc_inconnu}}");
  });
  it("dédoublonne les listes", () => {
    const r = resolveVariables("{{ville}} {{ville}} {{photo_club}} {{photo_club}}", {});
    expect(r.missing).toEqual(["ville"]);
    expect(r.mediaVars).toEqual(["photo_club"]);
  });
});
