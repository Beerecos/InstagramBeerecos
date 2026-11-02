import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Deliverable } from "@/lib/social/editorial-api";
import PostPreview from "@/components/social/PostPreview";

vi.mock("@/lib/social/api", () => ({ listCampaigns: vi.fn(), updateDeliverable: vi.fn() }));
vi.mock("@/lib/social/haptics", () => ({ haptic: vi.fn() }));
vi.mock("@/components/social/router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));

const item: Deliverable = {
  id: "post", agentId: null, title: "Mon post", channel: "instagram", status: "review", content: "Ma légende",
  createdAt: null, updatedAt: null, workspaceId: null, campaignId: null, objective: null,
  cta: "Commente CLUB", keyword: "CLUB", accountIds: ["account"], destinationUrl: null,
  attributionCode: null, scheduledAt: null, contentVersion: 3, approvedVersion: null,
  media: [{ type: "video", url: "https://example.org/final.mp4" }],
  studioSource: { sourceType: "montage", sourceId: "montage", sourceVersion: "2026-10-23", renderReady: true },
};
function render(overrides: Partial<Deliverable> = {}, busy = false) {
  return renderToStaticMarkup(<PostPreview item={{ ...item, ...overrides }} busy={busy} onValidate={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />);
}

describe("PostPreview approval boundary", () => {
  it("shows the actual video, CTA and keyword with approval distinct from publication", () => {
    const html = render();
    expect(html).toContain('<video src="https://example.org/final.mp4" controls=""');
    expect(html).toContain("Commente CLUB");
    expect(html).toContain("Mot-clé : CLUB");
    expect(html).toContain("Valider le post</button>");
    expect(html).toContain("Valider le contenu ne le publie pas.");
    expect(html).not.toMatch(/>Publier(?: le post)?<\/button>/);
  });
  it("blocks approval of pending studio renders", () => {
    const html = render({ studioSource: { ...item.studioSource!, renderReady: false } });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Rendu en attente<\/button>/);
    expect(html).not.toContain("Valider le post</button>");
  });
  it("requires complete studio captions, CTA and accounts before approval", () => {
    for (const changes of [{ content: "" }, { cta: "" }, { accountIds: [] }]) {
      expect(render(changes)).toMatch(/<button[^>]*disabled=""[^>]*>Post à compléter<\/button>/);
    }
  });
  it.each(["approved", "published", "archived"] as const)("cannot approve a %s version again", (status) => {
    const html = render({ status });
    expect(html).not.toContain("Valider le post</button>");
  });
  it("retains approval for a legacy draft without studio metadata", () => {
    expect(render({ status: "draft", studioSource: null, accountIds: [] })).toContain("Valider le post</button>");
  });
  it("renders all ordered carousel images", () => {
    const html = render({ media: [{ type: "image", url: "https://example.org/first.png" }, { type: "image", url: "https://example.org/second.png", alt: "Suite" }] });
    expect(html.indexOf("first.png")).toBeLessThan(html.indexOf("second.png"));
    expect(html).toContain('alt="Suite"');
  });
});
