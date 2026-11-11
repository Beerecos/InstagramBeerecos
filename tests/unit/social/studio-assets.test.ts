import { describe, expect, it } from "vitest";
import { parseStudioAssetData, instantiateEffect } from "@/domain/social/studio-assets";
import { DEMO_STORY } from "@/domain/social/reel-story/spec";
import { DEMO_MOTION } from "@/domain/social/reel-story/motion-spec";
import { directFromScript } from "@/domain/social/editorial/director";
const effect = { schemaVersion: 1, durationMs: 2000, layers: [{ name: "titre", fromMs: 0, toMs: 2000, props: { texte: "Bonjour" } }] };
describe("Studio assets declarations", () => {
  it("validates bounded relative layers, known primitives and props", () => {
    expect(parseStudioAssetData("effect", effect)).toMatchObject(effect);
    for (const data of [ { ...effect, durationMs: 60001 }, { ...effect, layers: Array(31).fill(effect.layers[0]) }, { ...effect, layers: [{ ...effect.layers[0], toMs: 3000 }] }, { ...effect, layers: [{ ...effect.layers[0], name: "execute-script" }] }, { ...effect, layers: [{ ...effect.layers[0], props: { texte: "Titre", code: "alert(1)" } }] } ]) expect(() => parseStudioAssetData("effect", data)).toThrow();
  });
  it("rejects non JSON and oversized declarations", () => {
    expect(() => parseStudioAssetData("effect", { ...effect, durationMs: NaN })).toThrow();
    expect(() => parseStudioAssetData("effect", { ...effect, extra: "x".repeat(300_000) })).toThrow();
  });
  it("stores editable IA sources without temporary generated voice assets", () => {
    expect(parseStudioAssetData("story", { ...DEMO_STORY, assets: { voice: { hook: { src: "blob:temporary" } } } })).not.toHaveProperty("assets");
    expect(parseStudioAssetData("motion", DEMO_MOTION)).toHaveProperty("scenes");
    expect(() => parseStudioAssetData("motion", {})).toThrow();
  });
  it("Réel IA simple (editorial) : la source enregistrée est celle du rendu, sans voix générées ni état d'écran", () => {
    const sb = directFromScript("Tu connais 500 personnes ? Mais qui te recommande vraiment ? Commente RÉSEAU.", { mascot: true });
    const onScreen = { ...sb, scenes: sb.scenes.map((x, i) => (i === 0 ? { ...x, locked: true } : x)) };
    const saved = parseStudioAssetData("editorial", onScreen);
    expect(saved).not.toHaveProperty("assets");
    expect(saved.scenes.some((x) => "locked" in x)).toBe(false);
    // narration.json du rendu : même structure + voix générées (adresses temporaires) et durées mesurées.
    const voice = { src: "blob:temporaire", duration: 2.4, text: "x", voiceId: "v", speed: 0.92, pronunciationVersion: "1", receiptId: "a".repeat(64) };
    const rendered = { ...onScreen, voiceDurations: { s1: 2.4 }, assets: { voice: { s1: voice } } };
    expect(JSON.stringify(parseStudioAssetData("editorial", rendered))).toBe(JSON.stringify(saved));
    expect(() => parseStudioAssetData("editorial", { preset: "autre" })).toThrow();
  });
  it("creates independent source-time snapshots with new identities", () => {
    const parsed = parseStudioAssetData("effect", effect);
    const clips = instantiateEffect(parsed, 5000, () => "new-layer");
    expect(clips[0]).toMatchObject({ id: "new-layer", fromMs: 5000, toMs: 7000 });
    clips[0].props.texte = "Autre scène";
    expect(parsed.layers[0].props.texte).toBe("Bonjour");
  });
});
describe("Studio effect immutable primitive versions", () => {
  it("rejects missing historical primitive implementation rather than silently substituting current", () => {
    expect(() => parseStudioAssetData("effect", { ...effect, layers: [{ ...effect.layers[0], version: 999 }] })).toThrow();
  });
});
