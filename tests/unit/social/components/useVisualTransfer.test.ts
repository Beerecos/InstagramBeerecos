import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVisualTransfer } from "@/components/social/useVisualTransfer";
import * as api from "@/lib/social/api";

vi.mock("react", () => ({ useRef: (value: unknown) => ({ current: value }), useState: (value: unknown) => [value, vi.fn()] }));
vi.mock("@/lib/social/api", () => ({ savePublication: vi.fn(), getPublication: vi.fn(), transferStudioMedia: vi.fn() }));
const id = "c11b4b4b-5260-4dfd-957e-8111d68cc027";
const version = "2026-10-23T08:00:00.000Z";
const input = { templateKey: "visual", composition: { slides: [{ id: "first" }, { id: "second" }], format: "carousel" } };
const media = [{ assetId: "asset-first", storagePath: "first.png", url: null, type: "image" as const, alt: "Premier" }, { assetId: "asset-second", storagePath: "second.png", url: null, type: "image" as const, alt: "Second" }];
beforeEach(() => {
  vi.resetAllMocks();
  const items = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => items.set(key, value) });
  vi.mocked(api.getPublication).mockRejectedValue(new Error("Read unavailable"));
  vi.mocked(api.savePublication).mockImplementation(async (request) => serverRow(request));
  vi.mocked(api.transferStudioMedia).mockResolvedValue({ id: "real-deliverable" } as api.Deliverable);
});

describe("visual transfer orchestration", () => {
  it("locks overlapping clicks and opens the direct Deliverable only after the ordered source save", async () => {
    let release!: (value: typeof media) => void;
    const render = vi.fn(() => new Promise<typeof media>((resolve) => { release = resolve; }));
    const open = vi.fn();
    const transfer = useVisualTransfer("account.project", id);
    const first = transfer.send(input, render, open);
    await vi.waitFor(() => expect(render).toHaveBeenCalledOnce());
    await transfer.send(input, render, open);
    release(media); await first;
    expect(render).toHaveBeenCalledOnce();
    expect(api.savePublication).toHaveBeenCalledWith(expect.objectContaining({ id, status: "brouillon", composition: { ...input.composition, media } }));
    expect(api.transferStudioMedia).toHaveBeenCalledWith({ sourceType: "visual", sourceId: id, expectedSourceVersion: version });
    expect(open).toHaveBeenCalledWith("real-deliverable");
  });
  it("retries a failed transfer after remount without another source save or another render", async () => {
    const render = vi.fn().mockResolvedValue(media);
    const open = vi.fn();
    vi.mocked(api.transferStudioMedia).mockRejectedValueOnce(new Error("Network interrupted"));
    await useVisualTransfer("account.project", id).send(input, render, open);
    expect(open).not.toHaveBeenCalled();
    await useVisualTransfer("account.project", id).send(input, render, open);
    expect(api.savePublication).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
  });
  it("passes the restored source version and keeps the editor open on a concurrent save conflict", async () => {
    vi.mocked(api.savePublication).mockRejectedValue(new Error("Version conflict"));
    const open = vi.fn();
    await useVisualTransfer("account.project", id, version).send(input, async () => media, open);
    expect(api.savePublication).toHaveBeenCalledWith(expect.objectContaining({ id, expectedVersion: version }));
    expect(api.transferStudioMedia).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});

function serverRow(request: api.SavePublicationInput): api.SocialPublicationRow {
  return { id: request.id!, updated_at: version, created_at: version, template_key: request.templateKey,
    channel: request.channel ?? "instagram", workspace_id: request.workspaceId ?? null,
    event_id: request.eventId ?? null, contact_id: request.contactId ?? null,
    title: request.title || request.templateKey, composition: request.composition,
    caption: request.caption ?? null, cta: request.cta ?? null, hashtags: request.hashtags ?? [],
    link: request.link ?? null, ratios: request.ratios ?? ["4:5"], missing: request.missing ?? [],
    status: "brouillon", scheduled_at: null, deliverable_id: null };
}

describe("lost save response recovery", () => {
  it("recovers a committed create after remount without reuploading or saving again", async () => {
    let committed!: api.SocialPublicationRow;
    vi.mocked(api.savePublication).mockImplementationOnce(async (request) => {
      committed = serverRow(request);
      throw new Error("Save response lost");
    });
    const render = vi.fn().mockResolvedValue(media);
    const open = vi.fn();
    await useVisualTransfer("account.project", id).send(input, render, open);
    expect(open).not.toHaveBeenCalled();
    // Recovery is a fresh hook instance; no in-memory request/version survives.
    vi.mocked(api.getPublication).mockResolvedValue(committed);
    await useVisualTransfer("account.project", id).send(input, render, open);
    expect(render).toHaveBeenCalledOnce();
    expect(api.savePublication).toHaveBeenCalledOnce();
    expect(api.transferStudioMedia).toHaveBeenCalledWith({ sourceType: "visual", sourceId: id, expectedSourceVersion: version });
    expect(open).toHaveBeenCalledWith("real-deliverable");
  });
  it("recovers immediately when the write succeeds but only its HTTP response is lost", async () => {
    vi.mocked(api.savePublication).mockImplementationOnce(async (request) => {
      const row = serverRow(request);
      // Mimic JSONB reordering keys without altering slide/media array order.
      row.composition = { media, format: "carousel", slides: input.composition.slides };
      vi.mocked(api.getPublication).mockResolvedValue(row);
      throw new Error("Save response lost");
    });
    const open = vi.fn();
    await useVisualTransfer("account.project", id).send(input, async () => media, open);
    expect(open).toHaveBeenCalledWith("real-deliverable");
    expect(api.savePublication).toHaveBeenCalledOnce();
  });
  it("does not overwrite or transfer a newer edit discovered after a lost update response", async () => {
    let committed!: api.SocialPublicationRow;
    vi.mocked(api.savePublication).mockImplementationOnce(async (request) => {
      committed = serverRow(request);
      throw new Error("Update response lost");
    });
    const render = vi.fn().mockResolvedValue(media);
    const open = vi.fn();
    await useVisualTransfer("account.project", id, "2026-10-23T07:00:00.000Z").send(input, render, open);
    vi.mocked(api.getPublication).mockResolvedValue({ ...committed, updated_at: "2026-10-23T09:00:00.000Z",
      composition: { ...input.composition, slides: [...input.composition.slides].reverse(), media } });
    await useVisualTransfer("account.project", id).send(input, render, open);
    expect(api.savePublication).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledOnce();
    expect(api.transferStudioMedia).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
  it("replays the identical uploaded request and original expectedVersion if the first save never committed", async () => {
    vi.mocked(api.savePublication).mockRejectedValueOnce(new Error("Connection lost before write"));
    const render = vi.fn().mockResolvedValue(media);
    const open = vi.fn();
    const originalVersion = "2026-10-23T07:00:00.000Z";
    await useVisualTransfer("account.project", id, originalVersion).send(input, render, open);
    const firstRequest = vi.mocked(api.savePublication).mock.calls[0][0];
    await useVisualTransfer("account.project", id).send(input, render, open);
    expect(api.savePublication).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.savePublication).mock.calls[1][0]).toEqual(firstRequest);
    expect(firstRequest.expectedVersion).toBe(originalVersion);
    expect(render).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith("real-deliverable");
  });
});

describe("explicit post channel resume", () => {
  it("transfers to LinkedIn without changing the visual source channel", async () => {
    vi.mocked(api.transferStudioMedia).mockResolvedValue({ id: "linkedin-post", channel: "linkedin" } as api.Deliverable);
    const open = vi.fn();
    await useVisualTransfer("account.project", id).send({ ...input, channel: "instagram" }, async () => media, open, "linkedin");
    expect(api.savePublication).toHaveBeenCalledWith(expect.objectContaining({ channel: "instagram" }));
    expect(api.transferStudioMedia).toHaveBeenCalledWith({ sourceType: "visual", sourceId: id, expectedSourceVersion: version, channel: "linkedin" });
    expect(open).toHaveBeenCalledWith("linkedin-post");
  });
  it("does not open a post when the returned channel differs from the explicit target", async () => {
    vi.mocked(api.transferStudioMedia).mockResolvedValue({ id: "instagram-post", channel: "instagram" } as api.Deliverable);
    const open = vi.fn();
    await useVisualTransfer("account.project", id).send(input, async () => media, open, "linkedin");
    expect(open).not.toHaveBeenCalled();
  });
});

it("rejects a successful save response that silently substitutes other rendered media", async () => {
  vi.mocked(api.savePublication).mockImplementation(async (request) => ({ ...serverRow(request), composition: {
    ...input.composition, media: [...media].reverse(),
  } }));
  const open = vi.fn();
  await useVisualTransfer("account.project", id).send(input, async () => media, open);
  expect(api.transferStudioMedia).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});
