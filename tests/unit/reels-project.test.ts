import { describe, expect, it } from "vitest";
import { matchesQuery, reelState } from "@/domain/reels/project";

describe("reelState", () => {
  it("suit la préparation d'une prise filmée", () => {
    expect(reelState({ status: "uploaded", renderStatus: null }).next).toBe("Lancer la transcription");
    expect(reelState({ status: "transcribing", renderStatus: null }).tone).toBe("busy");
    expect(reelState({ status: "ready", renderStatus: null, hasEdit: true }).stage).toBe("preparation");
  });
  it("distingue validation, rendu et export", () => {
    expect(reelState({ status: "ready", renderStatus: null, previewApproved: true }).stage).toBe("validation");
    expect(reelState({ status: "ready", renderStatus: "rendering" }).stage).toBe("rendu");
    expect(reelState({ status: "ready", renderStatus: "failed" }).tone).toBe("error");
    const done = reelState({ status: "ready", renderStatus: "done", finalVideoUrl: "https://x" });
    expect(done.stage).toBe("exporte");
    expect(done.label).not.toMatch(/publi/i);
  });
  it("n'annonce pas d'export sans fichier", () => {
    expect(reelState({ status: "ready", renderStatus: "done", finalVideoUrl: null }).stage).toBe("preparation");
  });
  it("une erreur de prise reste visible", () => {
    expect(reelState({ status: "error", renderStatus: null }).tone).toBe("error");
  });
  it("recherche sans accents", () => {
    expect(matchesQuery("Le réseau qui recommande", "reseau")).toBe(true);
    expect(matchesQuery("Formation", "ia")).toBe(false);
  });
});
