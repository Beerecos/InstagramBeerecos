import { describe, expect, it } from "vitest";
import { parseStudioAssetData, instantiateEffect } from "@/domain/social/studio-assets";
import { DEMO_STORY } from "@/domain/social/reel-story/spec";
import { DEMO_MOTION } from "@/domain/social/reel-story/motion-spec";
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
