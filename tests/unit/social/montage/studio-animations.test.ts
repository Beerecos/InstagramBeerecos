import { describe, expect, it } from "vitest";
import { checkAnimation, renderAnimation } from "@/domain/social/montage/animations";
import { parseEdit, type Edit } from "@/domain/social/montage/edit";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { SFX_FILES, itemAt } from "@/domain/social/montage/fx";
import { initialEdit } from "@/domain/social/montage/montage";
import { applyStudioPreset } from "@/domain/social/montage/presets";
import { buildMontageProject } from "@/domain/social/montage/project";
import { ANIMATIONS } from "@/domain/social/montage/registry";

// Studio animations (2026-11-11) : six effets ajoutés à la bibliothèque, mêmes définitions pour l'aperçu et l'export.
const NEW = ["carte-flottante", "checklist", "capsules", "mot-central", "parcours", "cta-saisie"];
const ctx = { id: "a1", start: 2, duration: 4, accent: "#2851FF" };

const base = (custom: unknown[], extra: Record<string, unknown> = {}): Edit => {
  const r = parseEdit({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 20000 }], subtitles: false, custom, ...extra });
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.edit;
};
const compose = (e: Edit) => buildEditComposition(e, [], { assetBase: "." });
const startOf = (html: string, sel: string) => Number(new RegExp(`tl\\.fromTo\\("#${sel}"[^)]*\\}, ([\\d.]+)\\);`).exec(html)?.[1]);

describe("Studio animations — bibliothèque", () => {
  it.each(NEW)("%s : fiche complète, exemple valide, identifiants et CSS conformes", (name) => {
    expect(ANIMATIONS[name], name).toBeDefined();
    expect(checkAnimation(name, ANIMATIONS[name])).toEqual([]);
  });

  it("aucun texte externe ne devient du code (échappé)", () => {
    const out = renderAnimation("carte-flottante", { titre: "<img src=x onerror=alert(1)>" }, ctx, ANIMATIONS);
    expect(out.html).not.toContain("<img");
    expect(out.html).toContain("&lt;img");
  });

  it("CTA : le mot se tape lettre par lettre, la consigne par défaut reprend le mot", () => {
    const out = renderAnimation("cta-saisie", { mot: "club" }, ctx, ANIMATIONS);
    expect(out.html).toContain("Écris CLUB en commentaire");
    expect(out.tweens.filter((t) => t.includes("textContent")).map((t) => /textContent: "([^"]*)"/.exec(t)?.[1])).toEqual(["C", "CL", "CLU", "CLUB"]);
  });

  it("intensité 0 : aucun déplacement ni flottement ; 2 : plus ample", () => {
    const calm = renderAnimation("carte-flottante", { titre: "Une idée" }, { ...ctx, intensity: 0 }, ANIMATIONS);
    expect(calm.tweens.join("")).not.toContain("yoyo");
    expect(calm.tweens[0]).toContain("y: 0, scale: 1 }, { opacity: 1");
    const strong = renderAnimation("carte-flottante", { titre: "Une idée" }, { ...ctx, intensity: 2 }, ANIMATIONS);
    expect(strong.tweens[0]).toContain("y: 56");
  });

  it("repère d'un élément : utilisé s'il existe, borné à la durée de l'effet ; sinon répartition régulière", () => {
    expect(itemAt({ start: 2, duration: 4, marks: [3.5] }, 0, 3)).toBe(3.5);
    expect(itemAt({ start: 2, duration: 4, marks: [99] }, 0, 3)).toBe(5.4);
    expect(itemAt({ start: 2, duration: 4 }, 1, 3)).toBeCloseTo(2.15 + 0.8, 2);
  });
});

describe("Studio animations — synchronisation avec les coupes", () => {
  const checklist = { name: "checklist", fromMs: 4000, toMs: 12000, props: { items: ["Choisir son club", "Demander son invitation", "Participer à une réunion"] }, reperes: [5000, 8000, 10000] };

  it("chaque ligne apparaît sur son repère (temps du montage)", () => {
    const html = compose(base([checklist]));
    expect(startOf(html, "a0-l0")).toBe(5);
    expect(startOf(html, "a0-l1")).toBe(8);
    expect(startOf(html, "a0-l2")).toBe(10);
  });

  it("après une coupe en amont (6 à 7 s supprimées), les repères suivants avancent d'une seconde", () => {
    const html = compose(base([checklist], { ranges: [{ fromMs: 0, toMs: 6000 }, { fromMs: 7000, toMs: 20000 }] }));
    expect(startOf(html, "a0-l0")).toBe(5);
    expect(startOf(html, "a0-l1")).toBe(7);
    expect(startOf(html, "a0-l2")).toBe(9);
  });

  it("le schéma refuse un repère invalide ou trop de repères", () => {
    expect(parseEdit({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 1000 }], custom: [{ ...checklist, reperes: [-1] }] }).ok).toBe(false);
    expect(parseEdit({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 1000 }], custom: [{ ...checklist, reperes: Array(13).fill(1) }] }).ok).toBe(false);
  });
});

describe("Studio animations — accents sonores", () => {
  const cta = { name: "cta-saisie", fromMs: 10000, toMs: 15000, props: { mot: "CLUB" } };

  it("désactivés par défaut : aucun son ajouté (rendu d'avant)", () => {
    expect(compose(base([cta]))).not.toContain('id="accent-');
  });

  it("activés : une saisie par lettre et un clic à l'envoi, volume par type ; un type à 0 est muet", () => {
    const html = compose(base([cta], { effetsSonores: { actif: true, volumes: { clic: 0.3, saisie: 0, glisse: 0.2 } } }));
    expect(html.match(/id="accent-/g)?.length).toBe(1);
    expect(html).toContain(`src="./${SFX_FILES.clic}"`);
    expect(html).toContain('data-volume="0.3"');
    const all = compose(base([cta], { effetsSonores: { actif: true } }));
    expect(all.match(/sfx\/digitalTick\.wav/g)?.length).toBe(4);
  });

  it("le projet de rendu embarque les sons seulement quand ils sont activés", async () => {
    const load = async (path: string) => new TextEncoder().encode(`contenu de ${path}`);
    const off = await buildMontageProject({ ...initialEdit("prise.mp4", 5000), custom: [] }, [], new Uint8Array([1]), load);
    expect(off.files.some((f) => f.startsWith("sfx/"))).toBe(false);
    const on = await buildMontageProject({ ...initialEdit("prise.mp4", 5000), custom: [], effetsSonores: { actif: true, volumes: { clic: 0.2, saisie: 0.2, glisse: 0.2 } } }, [], new Uint8Array([1]), load);
    expect(on.files.filter((f) => f.startsWith("sfx/")).sort()).toEqual(Object.values(SFX_FILES).sort());
  });
});

describe("Studio animations — styles et déterminisme", () => {
  it("Sobre / Dynamique / Impact règlent sous-titres, plans, sons et intensité ; une intensité réglée à la main est gardée", () => {
    const e = base([{ id: "x1", name: "capsules", fromMs: 1000, toMs: 4000, props: { items: ["A", "B"] }, intensite: 0.3 }, { id: "x2", name: "parcours", fromMs: 6000, toMs: 11000, props: { etapes: ["A", "B"] } }]);
    const impact = applyStudioPreset(e, "impact", { manualIntensity: new Set(["x1"]) });
    expect(impact.captionStyle.mode).toBe("punch");
    expect(impact.rythme?.director).toBe("dynamique");
    expect(impact.effetsSonores?.actif).toBe(true);
    expect(impact.custom.map((c) => c.intensite)).toEqual([0.3, 1.4]);
    expect(parseEdit(impact).ok).toBe(true);
    expect(applyStudioPreset(e, "sobre").effetsSonores?.actif).toBe(false);
  });

  it("même edit → même composition, image pour image (aperçu et export identiques)", () => {
    const e = base(NEW.map((name, i) => ({ name, fromMs: i * 3000, toMs: i * 3000 + 2800, props: ANIMATIONS[name].example })), { effetsSonores: { actif: true } });
    expect(compose(e)).toBe(compose(e));
    expect(compose(e)).not.toContain("anim-erreur\"");
  });
});
