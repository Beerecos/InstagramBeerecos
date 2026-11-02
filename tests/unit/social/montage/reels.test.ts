import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { alignScenes, checkStructure, editorialHash, hasKeyword, normalizeKeyword, patchScene, planImport, prompteurBlocks, reelTodo, scriptFromScenes, seedAnimations, sha256Hex, type Reel } from "@/domain/social/montage/reels";
import { checkTimeline } from "@/domain/social/montage/suggest";
import type { CaptionWord } from "@/domain/social/montage/edit";

const FILE = JSON.parse(readFileSync(new URL("../../../../content/reels-72/BeeRecos_72_Reels_Structure.json", import.meta.url), "utf8"));

/** Transcript synthétique : chaque mot du script lu à 350 ms, 600 ms de pause entre deux scènes. */
function speak(reel: Reel, startMs = 500): CaptionWord[] {
  const words: CaptionWord[] = [];
  let t = startMs;
  for (const s of reel.scenes) {
    for (const w of s.spoken_text.split(/\s+/).filter(Boolean)) { words.push({ text: ` ${w}`, startMs: t, endMs: t + 300 }); t += 350; }
    t += 600;
  }
  return words;
}

describe("les 72 Reels (lot S7)", () => {
  it("le fichier fourni passe tous les contrôles : 72 Reels, 384 scènes, textes exacts", async () => {
    const r = await checkStructure(FILE);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.reels).toHaveLength(72);
    expect(r.reels.reduce((n, x) => n + x.scenes.length, 0)).toBe(384);
    for (const reel of r.reels) expect(scriptFromScenes(reel.scenes)).toBe(reel.script.text);
    expect(new Set(r.reels.map((x) => x.cta.display_keyword))).toEqual(new Set(["CLUB", "RÉSEAU", "FORMATION", "DIGITALISATION", "INVITATION", "VISITE", "BUSINESS"]));
  });

  it("un fichier abîmé est refusé avec la raison", async () => {
    const bad = structuredClone(FILE);
    bad.reels[0].scenes[1].spoken_text += " (ajout)";
    bad.reels.pop();
    const r = await checkStructure(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/V01 : les paroles des scènes ne reproduisent pas exactement le script/);
    expect(r.errors.join("\n")).toMatch(/71 Reels lisibles/);
    expect((await checkStructure({ foo: 1 })).errors[0]).toMatch(/Fichier illisible/);
    expect((await checkStructure({ ...FILE, schema_version: "2.0.0" })).errors[0]).toMatch(/Version du schéma 2\.0\.0/);
  });

  it("mot-clé comparé sans accent ni casse", () => {
    expect(hasKeyword("Commente RESEAU et découvre BeeRecos", "RÉSEAU")).toBe(true);
    expect(hasKeyword("Ton réseau te recommande", "RÉSEAU")).toBe(false);
    expect(normalizeKeyword("RÉSEAU")).toBe("reseau");
    expect(normalizeKeyword(" Réseau ")).toBe("reseau");
  });

  it("import idempotent et protecteur", async () => {
    const { reels } = await checkStructure(FILE);
    const items = await Promise.all(reels.map(async (reel) => ({ reel, hash: await editorialHash(reel) })));
    const first = planImport(items, []);
    expect(first.insert).toHaveLength(72);
    const existing = items.map((i) => ({ reel_id: i.reel.reel_id, source_hash: i.hash, source_revision: 1, edited: false }));
    const again = planImport(items, existing);
    expect(again.insert).toHaveLength(0);
    expect(again.unchanged).toHaveLength(72);
    // V01 changé à la source : mis à jour s'il n'a pas été retouché, protégé sinon.
    const changed = items.map((i, k) => (k === 0 ? { reel: { ...i.reel, revision: 2 }, hash: "f".repeat(64) } : i));
    expect(planImport(changed, existing).update.map((r) => r.reel_id)).toEqual(["V01"]);
    const edited = existing.map((e, k) => (k === 0 ? { ...e, edited: true } : e));
    expect(planImport(changed, edited).protected[0]).toMatchObject({ reelId: "V01" });
  });

  it("modifier le texte d'une scène reconstruit le script, l'empreinte et retire la validation", async () => {
    const { reels } = await checkStructure(FILE);
    const v01 = reels[0];
    const out = await patchScene(v01, "V01_S02", { spokenText: "Nouveau texte.\n\nSur deux paragraphes." });
    if (!out.ok) throw new Error(out.error);
    expect(out.reel.revision).toBe(v01.revision + 1);
    expect(out.reel.editorial_status).toBe("needs_review");
    expect(out.reel.script.text).toBe(scriptFromScenes(out.reel.scenes));
    expect(out.reel.scenes[1].spoken_text).toBe("Nouveau texte.\nSur deux paragraphes.");
    expect(out.reel.script.sha256).toBe(await sha256Hex(out.reel.script.text));
    // Le résultat reste un Reel valide (concaténation, indices de paragraphes).
    const again = await checkStructure({ schema_version: "1.0.0", reels: [out.reel] }, { partial: true });
    expect(again.errors).toEqual([]);
    expect((await patchScene(v01, "V01_S01", { overlayText: "un deux trois quatre cinq six sept huit neuf" }))).toMatchObject({ ok: false });
    expect((await patchScene(v01, "V99_S01", { overlayText: "x" }))).toMatchObject({ ok: false, error: "Scène introuvable." });
  });

  it("le prompteur montre le texte à lire, scène par scène", async () => {
    const { reels } = await checkStructure(FILE);
    const blocks = prompteurBlocks(reels[0]);
    expect(blocks.map((b) => b.text).join("\n\n")).toBe(reels[0].script.text);
    expect(blocks[0].label).toBe("Accroche");
  });

  it("V01 : scènes recalées sur la voix, textes posés, pastille RÉSEAU et carte de fin de 2 s", async () => {
    const { reels } = await checkStructure(FILE);
    const v01 = reels[0];
    const words = speak(v01);
    const end = words[words.length - 1].endMs + 2500;
    const align = alignScenes(v01, words);
    expect(align.every((a) => a.startMs != null)).toBe(true);
    // Sans détourage : tout en onglet, le mode retenu est noté.
    const plain = seedAnimations(v01, words, [{ fromMs: 0, toMs: end }]);
    expect(plain.custom.map((c) => c.name)).toEqual(["onglet", "onglet", "onglet", "onglet", "mot-cle", "logo-fin"]);
    expect(plain.resolved.V01_S01).toBe("tab");
    expect(plain.warnings.join("\n")).toMatch(/pas de détourage de la prise — « 500 contacts… et après \? » passe en onglet/);
    expect(plain.custom.find((c) => c.name === "mot-cle")?.props).toEqual({ mot: "RÉSEAU" });
    const logo = plain.custom.find((c) => c.name === "logo-fin")!;
    expect(logo.toMs - logo.fromMs).toBe(2000);
    expect(checkTimeline(plain.custom)).toEqual([]);
    // Avec détourage : les textes prévus « derrière le sujet » le sont vraiment.
    const behind = seedAnimations(v01, words, [{ fromMs: 0, toMs: end }], { matteAt: () => "prise.matte.webm" });
    expect(behind.custom.filter((c) => c.name === "titre-derriere").map((c) => c.props.texte)).toEqual(["500 contacts… et après ?", "Un message facile à transmettre"]);
    expect(behind.resolved.V01_S01).toBe("behind_subject");
  });

  it("les 72 Reels se posent sans chevauchement sur une lecture fidèle", async () => {
    const { reels } = await checkStructure(FILE);
    for (const reel of reels) {
      const words = speak(reel);
      const out = seedAnimations(reel, words, [{ fromMs: 0, toMs: words[words.length - 1].endMs + 2500 }], { matteAt: () => "m.webm" });
      expect(checkTimeline(out.custom), reel.reel_id).toEqual([]);
      expect(out.custom.some((c) => c.name === "mot-cle" && c.props.mot === reel.cta.display_keyword), reel.reel_id).toBe(true);
      expect(Object.values(out.resolved).filter((m) => m === null), reel.reel_id).toEqual([]);
    }
  });

  it("liste « à compléter »", async () => {
    const { reels } = await checkStructure(FILE);
    expect(reelTodo(reels[0], null)).toEqual(["Texte à valider", "Prise à filmer", "Légende du post"]);
    expect(reelTodo(reels[0], { hasTake: true, transcribed: true, seededRevision: 1, previewApproved: false, finalReady: false })).toContain("Aperçu à valider");
    expect(reelTodo(reels[0], { hasTake: true, transcribed: true, seededRevision: 0, previewApproved: false, finalReady: false })).toContain("Texte changé : animations à replacer");
  });
});
