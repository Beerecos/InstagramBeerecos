import { describe, expect, it } from "vitest";
import { formatOf, matchesLocal, primaryAction, resolveSocialView, withoutEditor, withoutTool } from "@/lib/social/social-hub";

const view = (q: string) => resolveSocialView(new URLSearchParams(q));

describe("resolveSocialView — anciens liens de /publication", () => {
  it("liste par défaut, et « À valider » met la liste en avant", () => {
    expect(view("")).toEqual({ kind: "workspace", display: "list", reviewFocus: false, editor: false });
    expect(view("vue=contenus")).toEqual({ kind: "workspace", display: "list", reviewFocus: false, editor: false });
    expect(view("vue=valider")).toEqual({ kind: "workspace", display: "list", reviewFocus: true, editor: false });
  });
  it("calendrier garde ses filtres, campaignId compris", () => {
    expect(view("vue=calendrier&campaignId=c1&channel=linkedin")).toEqual({ kind: "workspace", display: "calendar", reviewFocus: false, editor: false });
    expect(view("vue=calendrier&edit=x")).toEqual({ kind: "workspace", display: "calendar", reviewFocus: false, editor: true });
  });
  it("paramètres d'édition et de préremplissage → éditeur en panneau au-dessus de la liste", () => {
    for (const q of ["edit=x", "campaignId=c1", "campaignId=c1&date=2026-10-04", "vue=contenus&texte=a&lien=https://x", "tab=studio", "tab=parametres", "nouveau=1", "status=review&edit=x"]) {
      expect(view(q)).toMatchObject({ kind: "workspace", display: "list", editor: true });
    }
  });
  it("fermer l'éditeur garde filtres et affichage", () => {
    expect(withoutEditor(new URLSearchParams("status=review&q=club&edit=x&campaignId=c1&postChannel=linkedin")).toString()).toBe("status=review&q=club");
    expect(withoutEditor(new URLSearchParams("vue=calendrier&campaignId=c1&date=2026-10-04")).toString()).toBe("vue=calendrier&campaignId=c1");
  });
  it("chaque ex-onglet reste joignable, et l'outil l'emporte sur les autres paramètres", () => {
    for (const t of ["pilotage", "montage", "reels", "carrousels", "campagnes", "automatisation", "ruche", "validations"]) {
      expect(view(`vue=${t}&edit=x`)).toEqual({ kind: "tool", tool: t });
    }
  });
  it("fermer un outil retire seulement la vue", () => {
    expect(withoutTool(new URLSearchParams("vue=montage&workspaceId=w1&status=review")).toString()).toBe("workspaceId=w1&status=review");
  });
  it("a resume channel alone never opens an editor", () => {
    expect(view("channel=instagram&postChannel=linkedin")).toMatchObject({ kind: "workspace", editor: false });
    expect(withoutEditor(new URLSearchParams("channel=instagram&postChannel=linkedin&edit=x")).toString()).toBe("channel=instagram");
  });
  it("une vue inconnue retombe sur la liste", () => {
    expect(view("vue=nimporte")).toEqual({ kind: "workspace", display: "list", reviewFocus: false, editor: false });
  });
});

describe("format et action", () => {
  it("le format vient des médias attachés", () => {
    expect(formatOf({ media: [] })).toBe("texte");
    expect(formatOf({ media: [{ url: "a", type: "image" }] })).toBe("post");
    expect(formatOf({ media: [{ url: "a", type: "image" }, { url: "b", type: "image" }] })).toBe("carrousel");
    expect(formatOf({ media: [{ url: "a", type: "image" }, { url: "v", type: "video" }] })).toBe("reel");
  });
  it("action principale selon le statut", () => {
    expect(primaryAction({ status: "draft" })).toEqual({ label: "Modifier", kind: "edit" });
    expect(primaryAction({ status: "review" })).toEqual({ label: "Vérifier", kind: "preview" });
    expect(primaryAction({ status: "published" })).toEqual({ label: "Consulter", kind: "preview" });
  });
  it("recherche sans accents ni casse, sur le titre et le texte", () => {
    const d = { title: "Réunion découverte", content: "Viens au club", media: [] };
    expect(matchesLocal(d, "reunion", "")).toBe(true);
    expect(matchesLocal(d, "CLUB", "")).toBe(true);
    expect(matchesLocal(d, "linkedin", "")).toBe(false);
    expect(matchesLocal(d, "", "post")).toBe(false);
  });
});

describe("studio pipeline", () => {
  it("opens the three creation routes of Instagram BeeRecos (old board filters no longer apply)", async () => {
    const { studioHref } = await import("@/lib/social/social-hub");
    const old = new URLSearchParams("q=club&workspaceId=w1&edit=old&postChannel=linkedin");
    expect(studioHref(old, "reel")).toBe("/reels/nouveau/video");
    expect(studioHref(old, "ai")).toBe("/reels/nouveau/ia");
    expect(studioHref(old, "visual")).toBe("/formats");
  });
  it("approval remains in validation, not published or scheduled", async () => {
    const { pipelineStage } = await import("@/lib/social/social-hub");
    expect(pipelineStage({ status: "draft" })).toBe("prepare");
    expect(pipelineStage({ status: "review" })).toBe("validate");
    expect(pipelineStage({ status: "approved" })).toBe("validate");
    expect(pipelineStage({ status: "published" })).toBe("history");
  });
  it("closing a resumed montage clears its identity while keeping scope", () => {
    expect(withoutTool(new URLSearchParams("vue=montage&montage=m1&workspaceId=w1&q=club&postChannel=linkedin")).toString()).toBe("workspaceId=w1&q=club");
  });
});

import { legacyPublicationHref, studioHref } from "@/lib/social/social-hub";

describe("liens hérités /publication → Instagram BeeRecos", () => {
  const href = (q: string) => legacyPublicationHref(new URLSearchParams(q));
  it("conserve l'identifiant du montage", () => {
    expect(href("vue=montage&montage=abc-123")).toBe("/reels/abc-123");
    expect(href("vue=reels&montage=abc-123&postChannel=x")).toBe("/reels/abc-123");
  });
  it("rouvre la source IA avec sa version", () => {
    expect(href("vue=reels&studioAsset=a1&studioRevision=3&studioKind=motion")).toBe("/reels/nouveau/ia?studioAsset=a1&studioRevision=3&studioKind=motion");
  });
  it("oriente les autres vues", () => {
    expect(href("vue=montage")).toBe("/reels/nouveau/video");
    expect(href("vue=carrousels&visual=v9")).toBe("/formats?visual=v9");
    expect(href("vue=pilotage")).toBe("/");
    expect(href("edit=42")).toBe("/");
  });
  it("refuse un identifiant douteux", () => {
    expect(href("montage=../../x")).toBe("/");
  });
  it("studioHref pointe vers les routes de création", () => {
    expect(studioHref(new URLSearchParams(), "ai")).toBe("/reels/nouveau/ia");
    expect(studioHref(new URLSearchParams(), "reel")).toBe("/reels/nouveau/video");
  });
});
