import { describe, expect, it } from "vitest";
import { DEMO_MOTION, DEMO_STORY, normalizeAiNarration } from "@/domain/social/reel-story";
import { sourceData, sourceFingerprint, sourceTransfer, type StudioSourceRef } from "@/domain/social/studio-sources";
const source: StudioSourceRef = { assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", revision: 2, kind: "motion" };
const spec = normalizeAiNarration(DEMO_MOTION);
describe("persistent IA sources", () => {
  it("saves declarative content and ignores temporary voice assets for render matching", () => {
    const withAssets = { ...spec, assets: { voice: {} } };
    expect(sourceData("motion", withAssets)).not.toHaveProperty("assets");
    expect(sourceFingerprint("motion", spec)).toBe(sourceFingerprint("motion", withAssets));
    expect(sourceData("story", DEMO_STORY).title).toBe(DEMO_STORY.title);
  });
  it("a text or duration edit invalidates the export and transfer", () => {
    const fp = sourceFingerprint("motion", spec);
    const rendered = { source, fingerprint: fp, jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", renderId: "render-id" };
    expect(sourceTransfer(rendered, fp)).toEqual({ source, jobId: rendered.jobId, renderId: rendered.renderId });
    expect(sourceTransfer(rendered, sourceFingerprint("motion", { ...spec, title: "Changed" }))).toBeNull();
    expect(sourceTransfer(rendered, sourceFingerprint("motion", { ...spec, voice: { ...spec.voice, speed: 1 } }))).toBeNull();
  });
  it("legacy flattened MP4 and local-only render metadata cannot masquerade as editable verified IA", () => {
    expect(sourceTransfer(undefined, "fp")).toBeNull();
    expect(sourceTransfer({ fingerprint: "fp", source }, "fp")).toBeNull();
  });
});
