import { describe, expect, it } from "vitest";
import { KIT_ANIMATIONS, renderAnimation } from "@/domain/social/montage/animations";
import { MOTION_META, checkMotionRegistry, currentMotionVersion, listMotions, motionRegistryKey, parseMotionRef, searchMotions, stampMotionVersions } from "@/domain/social/montage/beemotion";
import { CustomAnimationSchema, parseEdit } from "@/domain/social/montage/edit";
import { buildAnimationPoster, buildAnimationPreview, buildEditComposition } from "@/domain/social/montage/edit-composition";
import { ANIMATIONS, ARCHIVED_ANIMATIONS } from "@/domain/social/montage/registry";

const edit = (custom: unknown[]) => ({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 10000 }], subtitles: false, custom });
const compose = (custom: unknown[]) => buildEditComposition(edit(custom), [], { assetBase: "." });

describe("BeeMotion — registre", () => {
  it("chaque animation du moteur a sa fiche, et chaque fiche son animation ; valeurs valides", () => {
    expect(checkMotionRegistry()).toEqual([]);
    expect(Object.keys(MOTION_META).sort()).toEqual(Object.keys(ANIMATIONS).sort());
  });

  it("identifiants et références versionnées uniques", () => {
    const refs = listMotions().map((m) => m.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect(refs).toContain("titre-derriere@1");
  });

  it("« approved » exige une source de validation écrite ; fiche manquante et catégorie inconnue détectées", () => {
    const saved = MOTION_META.titre;
    try {
      MOTION_META.titre = { ...saved, status: "approved", approval: undefined };
      expect(checkMotionRegistry()).toContain("« titre » : « approved » sans source de validation");
      MOTION_META.titre = { ...saved, category: "inconnue" as never };
      expect(checkMotionRegistry().some((e) => e.includes("catégorie « inconnue »"))).toBe(true);
    } finally {
      MOTION_META.titre = saved;
    }
    expect(checkMotionRegistry({ ...ANIMATIONS, nouvelle: KIT_ANIMATIONS.titre })).toContain("« nouvelle » : fiche BeeMotion manquante (ajouter une entrée draft dans MOTION_META)");
  });

  it("une version archivée doit être bien nommée, antérieure et conforme", () => {
    expect(checkMotionRegistry(ANIMATIONS, { "titre@1": KIT_ANIMATIONS.titre })).toContain("version archivée « titre@1 » : doit être antérieure à la version courante");
    expect(checkMotionRegistry(ANIMATIONS, { "titre-v0": KIT_ANIMATIONS.titre })).toContain("version archivée « titre-v0 » : format nom@version attendu");
    expect(ARCHIVED_ANIMATIONS).toEqual({});
  });
});

describe("BeeMotion — recherche", () => {
  it("par défaut (sélection automatique) : motions approuvés seulement", () => {
    const auto = searchMotions();
    expect(auto.length).toBeGreaterThan(0);
    expect(auto.every((m) => m.status === "approved")).toBe(true);
    expect(auto.map((m) => m.id)).toEqual(expect.arrayContaining(["chiffre", "liste"]));
    expect(auto.map((m) => m.id)).not.toContain("papier-dechire");
  });

  it("par catégorie, fonction de scène et durée disponible", () => {
    expect(searchMotions({ category: "cta" }).map((m) => m.id)).toEqual(["mot-cle"]);
    expect(searchMotions({ intent: "HOOK", approvedOnly: false }).map((m) => m.id).sort()).toEqual(["titre", "titre-derriere"]);
    expect(searchMotions({ maxDurationMs: 2000, approvedOnly: false }).every((m) => m.durationMs <= 2000)).toBe(true);
    expect(searchMotions({ maxDurationMs: 2000, approvedOnly: false }).map((m) => m.id)).toEqual(["logo-fin"]);
  });

  it("texte insensible aux accents et à la casse ; rien trouvé = liste vide (chercher avant de créer)", () => {
    expect(searchMotions({ text: "DETOURAGE" }).map((m) => m.id)).toEqual(["titre-derriere"]);
    expect(searchMotions({ text: "preuve", approvedOnly: false }).map((m) => m.id)).toEqual(["chiffre"]);
    expect(searchMotions({ text: "explosion 3d", approvedOnly: false })).toEqual([]);
  });
});

describe("BeeMotion — versions", () => {
  it("références : format strict, aucune donnée externe interprétée", () => {
    expect(parseMotionRef("titre-derriere@1")).toEqual({ id: "titre-derriere", version: 1 });
    for (const bad of ["titre@0", "titre@1;alert(1)", "<script>@1", "titre", "titre@1000", "../x@1"]) expect(parseMotionRef(bad)).toBeNull();
  });

  it("la version courante est figée sur les animations qui n'en ont pas ; une version déjà figée n'est jamais réécrite", () => {
    const stamped = stampMotionVersions([{ name: "titre", fromMs: 0, toMs: 1000, props: {} }, { name: "mot-cle", fromMs: 0, toMs: 1000, props: {}, version: 7 }]);
    expect(stamped.map((c) => c.version)).toEqual([currentMotionVersion("titre"), 7]);
  });

  it("le schéma d'edit.json accepte une version entière et refuse tout le reste", () => {
    expect(CustomAnimationSchema.safeParse({ name: "titre", fromMs: 0, toMs: 1000, version: 1 }).success).toBe(true);
    expect(CustomAnimationSchema.safeParse({ name: "titre", fromMs: 0, toMs: 1000, version: "1" }).success).toBe(false);
    expect(CustomAnimationSchema.safeParse({ name: "titre", fromMs: 0, toMs: 1000, version: 1.5 }).success).toBe(false);
    expect(parseEdit(edit([{ name: "titre", fromMs: 0, toMs: 2000, props: { texte: "A" } }])).ok).toBe(true);
  });

  it("une vidéo se rend avec la version qu'elle a figée ; sans version, la courante ; version disparue = bandeau, jamais une autre en silence", () => {
    const props = { texte: "Ton réseau" };
    const current = compose([{ name: "titre", fromMs: 0, toMs: 2000, props }]);
    expect(compose([{ name: "titre", fromMs: 0, toMs: 2000, props, version: 1 }])).toBe(current);
    expect(motionRegistryKey("titre", 1)).toBe("titre");
    expect(motionRegistryKey("titre", 3)).toBe("titre@3");
    const missing = compose([{ name: "titre", fromMs: 0, toMs: 2000, props, version: 3 }]);
    expect(missing).toContain("Animation « titre@3 » introuvable");
    expect(missing).not.toContain(">Ton réseau<");
  });

  it("une version archivée se rend avec SON implémentation", () => {
    const archived = { ...KIT_ANIMATIONS.titre, render: KIT_ANIMATIONS.onglet.render };
    const out = renderAnimation("titre@1", { texte: "Ancien rendu" }, { id: "a0", start: 0, duration: 2, accent: "#2851FF" }, { ...ANIMATIONS, "titre@1": archived });
    expect(out.html).toContain("anim-onglet");
  });
});

describe("BeeMotion — aperçu et sécurité", () => {
  it("affiche : aucun script ; aperçu : lecteur Hyperframes seulement à la demande", () => {
    const poster = buildAnimationPoster("chiffre", ANIMATIONS.chiffre.example, { assetBase: "." });
    expect(poster).not.toMatch(/<script/i);
    expect(poster).toContain("anim-chiffre");
    // L'affiche montre la valeur finale du compteur (12), pas sa valeur de départ (0).
    expect(poster).toContain('id="a0-v">12</span>');
    expect(buildAnimationPreview("chiffre", ANIMATIONS.chiffre.example, { assetBase: ".", preview: true })).toContain("hyperframe.runtime");
    expect(buildAnimationPreview("chiffre", ANIMATIONS.chiffre.example, { assetBase: "." })).not.toContain("hyperframe.runtime");
  });

  it("un texte externe ne devient jamais du code : échappé dans l'affiche comme dans la vidéo", () => {
    const hostile = { texte: '<img src=x onerror="fetch(1)"><script>alert(1)</script>' };
    const poster = buildAnimationPoster("titre", hostile, { assetBase: "." });
    expect(poster).not.toMatch(/<script>alert|<img src=x/);
    expect(poster).toContain("&lt;script&gt;");
    const video = compose([{ name: "titre", fromMs: 0, toMs: 2000, props: hostile, version: 1 }]);
    expect(video).not.toContain("<script>alert");
  });

  it("un nom de motion hostile est refusé par le schéma avant tout rendu", () => {
    expect(CustomAnimationSchema.safeParse({ name: "titre\"><script>", fromMs: 0, toMs: 1000 }).success).toBe(false);
  });
});
