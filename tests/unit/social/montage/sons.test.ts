import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEdit, type Edit } from "@/domain/social/montage/edit";
import { buildEditComposition, speechWindows } from "@/domain/social/montage/edit-composition";
import { layout } from "@/domain/social/montage/edit";
import { buildMontageProject } from "@/domain/social/montage/project";
import { SFX_KIT_COMMIT, SFX_KIT_DATA, SFX_KIT_VERSION } from "@/domain/social/montage/sfx-kit-data";
import { ANIMATION_EVENEMENT, SONS_AUTO, detacherSon, genererSonsAuto, modifierSon, placeSons, retirerSonsAuto, sfxInfo, sfxPath, supprimerSon, usedSfxFiles } from "@/domain/social/montage/sons";
import { ANIMATIONS } from "@/domain/social/montage/registry";

// Effets sonores SFX Kit (2026-11-12) : réels filmés seulement.
const catalogue = JSON.parse(readFileSync("public/hyperframes/sfx-kit/catalogue.json", "utf8"));
const words = "Ton réseau vaut de l'or. Imagine un photographe du quartier. Retiens bien ceci. Commente CLUB pour visiter."
  .split(" ").map((text, i) => ({ text, startMs: 500 + i * 450, endMs: 500 + i * 450 + 380 }));
const base = (extra: Record<string, unknown> = {}): Edit => {
  const r = parseEdit({ video: "prise.mp4", ranges: [{ fromMs: 0, toMs: 10000 }], subtitles: false, custom: [], ...extra });
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.edit;
};
const titre = { id: "t1", name: "titre", fromMs: 2000, toMs: 4000, props: { texte: "RÉSEAU" } };
const occ = (o: Record<string, unknown>) => ({ id: "s1", son: "pop-small-in", ancre: { type: "animation", animId: "t1" }, ...o });
const compose = (e: Edit, w = words) => buildEditComposition(e, w, { assetBase: "." });

describe("SFX Kit importé (v1.0.0)", () => {
  it("320 sons, version et commit épinglés, chaque entrée a son fichier et ses métadonnées", () => {
    expect(SFX_KIT_VERSION).toBe("1.0.0");
    expect(SFX_KIT_COMMIT).toBe("71815349a59fd9aa157fd61fedb2ae8482c96f39");
    const ids = Object.keys(SFX_KIT_DATA);
    expect(ids).toHaveLength(320);
    for (const id of ids) expect(existsSync(`public/hyperframes/${sfxPath(id)}`), id).toBe(true);
    expect(catalogue.sons.map((s: { id: string }) => s.id).sort()).toEqual(ids.sort());
    expect(catalogue.licence).toBe("CC0-1.0");
    const essentiels = catalogue.sons.filter((s: { essentiel: boolean }) => s.essentiel).length;
    expect(essentiels).toBeGreaterThanOrEqual(30);
    expect(essentiels).toBeLessThanOrEqual(50);
  });
  it("table automatique : sons existants, courts, et animations réelles du Studio", () => {
    for (const [ev, t] of Object.entries(SONS_AUTO)) {
      const info = sfxInfo(t.son);
      expect(info, ev).not.toBeNull();
      expect(info!.durationS, ev).toBeLessThan(ev === "logo" ? 2 : 1.2);
    }
    for (const name of Object.keys(ANIMATION_EVENEMENT)) expect(ANIMATIONS[name], name).toBeDefined();
  });
});

describe("placement : début = instant visé − sync.at", () => {
  it("associé à une animation : le point de synchro tombe à l'entrée de l'animation", () => {
    const e = base({ custom: [titre], sons: [occ({ son: "impact-light-soft" })] });
    const { placed } = placeSons(e, []);
    const info = sfxInfo("impact-light-soft")!;
    expect(placed[0].startMs).toBe(Math.round(2000 + 120 - info.syncS * 1000));
    expect(compose(e)).toContain(`<audio id="son-s1" src="./sfx-kit/impacts/impact-light-soft.flac" data-start="${placed[0].startMs / 1000}"`);
  });
  it("son qui commencerait avant le montage : début rogné, point de synchro aligné, petit fondu", () => {
    const e = base({ sons: [occ({ son: "move-zoom-in", ancre: { type: "repere", atMs: 200, nature: "zoom" } })] });
    const p = placeSons(e, []).placed[0];
    const sync = Math.round(sfxInfo("move-zoom-in")!.syncS * 1000);
    expect(p.startMs).toBe(0);
    expect(p.mediaStartMs).toBe(sync - 200);
    expect(p.fadeInMs).toBeGreaterThan(0);
    expect(compose(e)).toContain(`data-media-start="${(sync - 200) / 1000}"`);
  });
  it("un son très court (clic de 17 ms) sonne en entier", () => {
    const p = placeSons(base({ sons: [occ({ son: "click-button-medium", ancre: { type: "libre", debutMs: 5000 } })] }), []).placed[0];
    expect(p).toMatchObject({ startMs: 5000, durationMs: Math.round(sfxInfo("click-button-medium")!.durationS * 1000), mediaStartMs: 0 });
  });
  it("fin du montage : la fin du son est coupée avec un fondu", () => {
    const e = base({ sons: [occ({ son: "sting-warm-short", ancre: { type: "libre", debutMs: 9500 } })] });
    const p = placeSons(e, []).placed[0];
    expect(p.startMs + p.durationMs).toBe(10000);
    expect(p.fadeOutMs).toBeGreaterThan(0);
  });
  it("suit l'animation quand elle bouge, et les coupes en amont", () => {
    const moved = base({ custom: [{ ...titre, fromMs: 5000, toMs: 7000 }], sons: [occ({})] });
    const cut = base({ custom: [titre], ranges: [{ fromMs: 0, toMs: 1000 }, { fromMs: 1500, toMs: 10000 }], sons: [occ({})] });
    const at = (e: Edit) => placeSons(e, []).placed[0].startMs;
    const ref = at(base({ custom: [titre], sons: [occ({})] }));
    expect(at(moved)).toBe(ref + 3000);
    expect(at(cut)).toBe(ref - 500);
  });
  it("animation supprimée : l'effet associé se tait ; passage d'un son libre coupé : il se tait", () => {
    const e = base({ sons: [occ({}), occ({ id: "s2", ancre: { type: "libre", debutMs: 1200 } })], ranges: [{ fromMs: 0, toMs: 1000 }, { fromMs: 1500, toMs: 10000 }] });
    const { placed, problemes } = placeSons(e, []);
    expect(placed).toEqual([]);
    expect(problemes.map((p) => p.raison)).toEqual(["animation-supprimee", "hors-montage"]);
    expect(compose(e)).not.toContain("<audio id=\"son-");
  });
  it("muet ou supprimé : absent de l'aperçu et du rendu ; plusieurs occurrences du même son coexistent", () => {
    const e = base({ custom: [titre], sons: [occ({}), occ({ id: "s2", ancre: { type: "libre", debutMs: 6000 } }), occ({ id: "s3", muet: true, ancre: { type: "libre", debutMs: 8000 } })] });
    const html = compose(e);
    expect(html.match(/src="\.\/sfx-kit\/pops\/pop-small-in\.flac"/g)).toHaveLength(2);
    expect(html).not.toContain('id="son-s3"');
    expect(usedSfxFiles(e)).toEqual(["sfx-kit/pops/pop-small-in.flac"]);
    expect(compose(supprimerSon(e, "s2"))).not.toContain('id="son-s2"');
  });
  it("volume : occurrence × réglage global, baissé sous la voix (under_voiceover_db), jamais au-dessus de 0 dB", () => {
    const e = base({ custom: [titre], sons: [occ({ volume: 0.8 })], sonsReglages: { volume: 0.5, auto: false } });
    expect(placeSons(e, []).placed[0].volume).toBe(0.4);
    const speech = speechWindows(words, layout(e.ranges));
    const p = placeSons(e, speech).placed[0];
    expect(p.duckDb).toBe(sfxInfo("pop-small-in")!.underVoiceDb);
    expect(p.volume).toBeCloseTo(0.4 * 10 ** (p.duckDb / 20), 3);
    expect(placeSons(base({ custom: [titre], sons: [occ({ volume: 1.5 })], sonsReglages: { volume: 1.5, auto: false } }), []).placed[0].volume).toBe(1);
  });
  it("ancien projet : il s'ouvre sans effet, rendu identique", () => {
    const old = base({ custom: [titre] });
    expect(old.sons).toBeUndefined();
    expect(compose(old)).not.toContain("sfx-kit");
  });
  it("identifiant de son inconnu : signalé, jamais rendu", () => {
    const e = base({ custom: [titre], sons: [occ({ son: "son-qui-n-existe-pas" })] });
    expect(placeSons(e, []).problemes[0]).toMatchObject({ raison: "introuvable" });
    expect(compose(e)).not.toContain("son-qui-n-existe-pas");
  });
});

describe("son automatique", () => {
  const anims = [
    { id: "a1", name: "titre", fromMs: 1000, toMs: 3000, props: { texte: "Ton réseau" } },
    { id: "a2", name: "mot-impact", fromMs: 1200, toMs: 2500, props: { mot: "OR" } },
    { id: "a3", name: "chiffre", fromMs: 5000, toMs: 7000, props: { valeur: 500 } },
  ];
  const projet = () => base({ custom: anims, zooms: [{ fromMs: 3500, toMs: 5000, type: "accent", amplitude: 1.1 }], outro: { durationMs: 2000, baseline: true } });

  it("sonorise les événements importants, sans superposition ni son à chaque mot", () => {
    const e = genererSonsAuto(projet(), words);
    const placed = placeSons(e, []).placed;
    expect(e.sonsReglages?.auto).toBe(true);
    expect(e.sons!.every((o) => o.origine === "auto")).toBe(true);
    // Le titre et le mot impact sont à 200 ms : le mot impact (accent) passe, le titre non.
    expect(e.sons!.map((o) => o.cle)).toEqual(expect.arrayContaining(["anim:a2", "anim:a3", "zoom:3500", "logo:fin"]));
    expect(e.sons!.map((o) => o.cle)).not.toContain("anim:a1");
    expect(e.sons!.find((o) => o.cle === "anim:a3")?.son).toBe("tone-ding-mid");
    expect(e.sons!.find((o) => o.cle === "logo:fin")?.son).toBe("sting-warm-short");
    expect(e.sons!.length).toBeLessThan(words.length / 3);
    for (let i = 1; i < placed.length; i++) expect(placed[i].startMs - placed[i - 1].startMs).toBeGreaterThan(300);
    expect(parseEdit(e).ok).toBe(true);
  });
  it("relancer : même résultat, aucun doublon ; l'ordre de lecture ne change rien", () => {
    const once = genererSonsAuto(projet(), words);
    const twice = genererSonsAuto(once, words);
    expect(twice.sons).toEqual(once.sons);
    expect(new Set(twice.sons!.map((o) => o.cle)).size).toBe(twice.sons!.length);
    expect(compose(twice)).toBe(compose(once));
  });
  it("garde les remplacements, volumes et suppressions de l'utilisateur ; ne touche pas aux sons manuels", () => {
    let e = genererSonsAuto(projet(), words);
    const ding = e.sons!.find((o) => o.cle === "anim:a3")!;
    e = modifierSon(e, ding.id, { son: "shimmer-short-soft", volume: 0.3 });
    e = supprimerSon(e, e.sons!.find((o) => o.cle === "zoom:3500")!.id);
    e = { ...e, sons: [...e.sons!, { id: "m1", son: "click-button-medium", lib: "sfx-kit@1.0.0", ancre: { type: "libre", debutMs: 8000 }, decalageMs: 0, volume: 0.7, muet: false, origine: "manuel" }] };
    const again = genererSonsAuto(e, words);
    expect(again.sons!.find((o) => o.cle === "anim:a3")).toMatchObject({ son: "shimmer-short-soft", volume: 0.3, modifie: ["son", "volume"] });
    expect(again.sons!.some((o) => o.cle === "zoom:3500")).toBe(false);
    expect(again.sons!.find((o) => o.id === "m1")).toBeDefined();
  });
  it("une animation supprimée puis relance : son automatique retiré ; désactiver retire les sons non retouchés", () => {
    const e = genererSonsAuto(projet(), words);
    const without = genererSonsAuto({ ...e, custom: e.custom.filter((c) => c.id !== "a3") }, words);
    expect(without.sons!.some((o) => o.cle === "anim:a3")).toBe(false);
    const off = retirerSonsAuto(modifierSon(e, e.sons!.find((o) => o.cle === "logo:fin")!.id, { volume: 0.4 }));
    expect(off.sonsReglages?.auto).toBe(false);
    expect(off.sons!.map((o) => o.cle)).toEqual(["logo:fin"]);
  });
  it("détacher : le son devient libre, au même instant", () => {
    const e = genererSonsAuto(projet(), words);
    const id = e.sons!.find((o) => o.cle === "anim:a3")!.id;
    const before = placeSons(e, []).placed.find((p) => p.occ.id === id)!.startMs;
    const d = detacherSon(e, id, (out) => out);
    const after = placeSons(d, []).placed.find((p) => p.occ.id === id)!;
    expect(after.occ.ancre.type).toBe("libre");
    expect(after.occ.origine).toBe("manuel");
    expect(after.startMs).toBe(before);
    expect(parseEdit(d).ok).toBe(true);
  });
});

describe("projet de rendu", () => {
  it("embarque les fichiers des effets qui sonnent ; un fichier absent nomme l'effet", async () => {
    const e = base({ custom: [titre], sons: [occ({}), occ({ id: "s2", son: "tone-ding-mid", muet: true, ancre: { type: "libre", debutMs: 6000 } })] });
    const load = async (path: string) => new TextEncoder().encode(`contenu de ${path}`);
    const p = await buildMontageProject(e, words, new Uint8Array([1]), load);
    expect(p.files).toContain("sfx-kit/pops/pop-small-in.flac");
    expect(p.files).not.toContain("sfx-kit/tones/tone-ding-mid.flac");
    const failing = async (path: string) => { if (path.startsWith("sfx-kit/")) throw new Error("HTTP 404"); return load(path); };
    await expect(buildMontageProject(e, words, new Uint8Array([1]), failing)).rejects.toThrow("Effet sonore introuvable : pop-small-in");
  });
});
