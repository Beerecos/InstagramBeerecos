import { describe, it, expect } from "vitest";
import {
  canTransition, assertTransition, ALLOWED_TRANSITIONS, PUBLICATION_STATUS_LABELS,
  assemblePublication, isReadyForValidation, type PublicationStatus,
} from "@/domain/social/social-publication";
import type { MediaAsset } from "@/domain/social/media-resolver";

describe("machine à états (§11 : jamais d'auto-publication)", () => {
  it("le chemin nominal brouillon→généré→à valider→validé→programmé→publié est autorisé", () => {
    const path: PublicationStatus[] = ["brouillon", "genere", "a_valider", "valide", "programme", "publie"];
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("interdit de sauter directement à « publié » sans validation", () => {
    expect(canTransition("brouillon", "publie")).toBe(false);
    expect(canTransition("genere", "publie")).toBe(false);
    expect(canTransition("a_valider", "publie")).toBe(false);
  });
  it("« validé » peut publier ou programmer, mais un « publié » ne revient qu'en « archivé »", () => {
    expect(canTransition("valide", "publie")).toBe(true);
    expect(canTransition("valide", "programme")).toBe(true);
    expect(ALLOWED_TRANSITIONS.publie).toEqual(["archive"]);
  });
  it("assertTransition lève sur une transition interdite", () => {
    expect(() => assertTransition("brouillon", "publie")).toThrow();
    expect(() => assertTransition("brouillon", "genere")).not.toThrow();
  });
  it("chaque état a un libellé", () => {
    for (const s of Object.keys(ALLOWED_TRANSITIONS) as PublicationStatus[]) expect(PUBLICATION_STATUS_LABELS[s]).toBeTruthy();
  });
});

describe("assemblage de la composition (LAYOUT + médiathèque)", () => {
  const refs = { eventId: "ev1", workspaceId: "ws1", contactId: "ct1" };

  it("carrousel : fond IA par défaut quand aucun média (slides ai_ok)", () => {
    const c = assemblePublication({ type: "why_join", data: { club: { name: "X", link: "https://x" } } });
    expect(c.format).toBe("carousel");
    expect(c.slides).toHaveLength(5);
    expect(c.slides[0].background.kind).toBe("ai");
    expect(c.slides.every((s) => s.logos.some((l) => l.slot === "logo_beerecos"))).toBe(true);
  });

  it("utilise un média réel prioritaire sur l'IA quand il existe", () => {
    const pool: MediaAsset[] = [{ id: "e1", kind: "photo", source: "event", eventId: "ev1", url: "http://x/e1.jpg" }];
    const c = assemblePublication({ type: "club_event", data: { club: { name: "X", city: "Y" }, event: { date: "1", time: "2", location: "L", url: "u" } }, mediaPool: pool, refs });
    const s1 = c.slides[0].background;
    expect(s1.kind).toBe("media");
    if (s1.kind === "media") { expect(s1.assetId).toBe("e1"); expect(s1.source).toBe("event"); }
  });

  it("respecte le média choisi par l'utilisateur pour un slide donné", () => {
    const pool: MediaAsset[] = [
      { id: "e1", kind: "photo", source: "event", eventId: "ev1" },
      { id: "u9", kind: "photo", source: "user" },
    ];
    const c = assemblePublication({ type: "club_event", data: { club: { name: "X", city: "Y" }, event: { date: "1", time: "2", location: "L", url: "u" } }, mediaPool: pool, refs, chosenMedia: { 1: "u9" } });
    const bg = c.slides[0].background;
    if (bg.kind === "media") expect(bg.assetId).toBe("u9");
    else throw new Error("attendu média");
  });

  it("membre à l'honneur sans portrait → slide BLOQUÉ (jamais de visage inventé)", () => {
    const c = assemblePublication({ type: "member_spotlight", data: { member: { first_name: "A", last_name: "B", company: "C", profession: "D", club: "E" } }, refs });
    expect(c.slides[0].background.kind).toBe("blocked");
    expect(c.blockedSlides).toContain(1);
    expect(isReadyForValidation(c)).toBe(false); // bloqué → pas prêt
  });

  it("membre à l'honneur AVEC portrait réel → prêt à valider", () => {
    const pool: MediaAsset[] = [{ id: "p1", kind: "photo", source: "member", contactId: "ct1", url: "http://x/p.jpg" }];
    const c = assemblePublication({ type: "member_spotlight", data: { member: { first_name: "A", last_name: "B", company: "C", profession: "D", club: "E" } }, mediaPool: pool, refs });
    expect(c.slides[0].background.kind).toBe("media");
    expect(c.blockedSlides).toHaveLength(0);
    expect(isReadyForValidation(c)).toBe(true);
  });

  it("données texte manquantes → listées dans missing, pas prêt à valider", () => {
    const c = assemblePublication({ type: "club_event", data: {} });
    expect(c.missing.length).toBeGreaterThan(0);
    expect(isReadyForValidation(c)).toBe(false);
  });

  it("logos : slot présent dans la médiathèque = disponible, sinon non injecté (0..N)", () => {
    const pool: MediaAsset[] = [{ id: "lc", kind: "logo", source: "club", logoSlot: "logo_club", workspaceId: "ws1" }];
    const c = assemblePublication({ type: "why_join", data: { club: { name: "X", link: "u" } }, mediaPool: pool, refs });
    const last = c.slides[c.slides.length - 1];
    const club = last.logos.find((l) => l.slot === "logo_club");
    expect(club?.available).toBe(true);
    const beerecos = last.logos.find((l) => l.slot === "logo_beerecos");
    expect(beerecos?.available).toBe(false); // pas de logo_beerecos dans le pool → non injecté, pas d'erreur
  });
});
