import { describe, expect, it } from "vitest";
import { countByStage, stageOf } from "@/domain/instagram/dashboard";
import type { Publication } from "@/domain/instagram/publication";

const pub = (patch: Partial<Publication>): Publication => ({ id: "p", kind: "post", montageId: null, title: "", caption: "Légende", media: [{ path: "u/a.jpg", type: "image" }], keyword: null, dmText: null, buttonTitle: null, buttonUrl: null, status: "draft", permalink: null, publishedAt: null, error: null, updatedAt: "t", ...patch });

describe("tableau de bord Post", () => {
  it("un réel n'est prêt qu'avec son MP4 rendu", () => {
    expect(stageOf({ kind: "reel", reel: { renderStatus: "rendering", finalVideoUrl: null } })).toBe("preparation");
    expect(stageOf({ kind: "reel", reel: { renderStatus: "done", finalVideoUrl: "https://x/v.mp4" } })).toBe("pret");
    expect(stageOf({ kind: "reel", reel: { renderStatus: "done", finalVideoUrl: "https://x/v.mp4" }, pub: pub({ kind: "reel", status: "published" }) })).toBe("publie");
  });
  it("un post est prêt avec une photo et une légende ; un échec revient en préparation", () => {
    expect(stageOf({ kind: "post", pub: pub({}) })).toBe("pret");
    expect(stageOf({ kind: "post", pub: pub({ media: [] }) })).toBe("preparation");
    expect(stageOf({ kind: "post", pub: pub({ caption: " " }) })).toBe("preparation");
    expect(stageOf({ kind: "post", pub: pub({ status: "error" }) })).toBe("preparation");
    expect(stageOf({ kind: "post", pub: pub({ status: "publishing" }) })).toBe("publication");
  });
  it("compte chaque étape", () => {
    expect(countByStage(["pret", "pret", "publie"])).toEqual({ preparation: 0, pret: 2, publication: 0, publie: 1 });
  });
});
