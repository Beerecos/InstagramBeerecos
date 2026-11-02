import { describe, it, expect } from "vitest";
import { resolvePhoto, resolveLogos, PHOTO_PRIORITY, type MediaAsset, type MediaContext } from "@/domain/social/media-resolver";

const ctx: MediaContext = { eventId: "ev1", workspaceId: "ws1", contactId: "ct1" };

function photo(id: string, source: MediaAsset["source"], extra: Partial<MediaAsset> = {}): MediaAsset {
  return { id, kind: "photo", source, url: `http://x/${id}.jpg`, ...extra };
}

describe("ordre de priorité média (§médiathèque)", () => {
  it("l'ordre canonique est user → event → club → member → library", () => {
    expect(PHOTO_PRIORITY).toEqual(["user", "event", "club", "member", "library"]);
  });

  it("le média choisi par l'utilisateur gagne toujours", () => {
    const pool = [
      photo("u1", "user"),
      photo("e1", "event", { eventId: "ev1" }),
      photo("c1", "club", { workspaceId: "ws1" }),
    ];
    const r = resolvePhoto("ai_ok", ctx, pool, "u1");
    expect(r.tier).toBe("user");
    expect(r.asset?.id).toBe("u1");
    expect(r.useAi).toBe(false);
  });

  it("sans choix : événement prioritaire sur club/membre/bibliothèque", () => {
    const pool = [
      photo("lib1", "library"),
      photo("m1", "member", { contactId: "ct1" }),
      photo("c1", "club", { workspaceId: "ws1" }),
      photo("e1", "event", { eventId: "ev1" }),
    ];
    const r = resolvePhoto("ai_ok", ctx, pool);
    expect(r.tier).toBe("event");
    expect(r.asset?.id).toBe("e1");
  });

  it("descend club → membre → bibliothèque quand les niveaux supérieurs sont absents", () => {
    expect(resolvePhoto("ai_ok", ctx, [photo("c1", "club", { workspaceId: "ws1" }), photo("m1", "member", { contactId: "ct1" }), photo("lib1", "library")]).tier).toBe("club");
    expect(resolvePhoto("ai_ok", ctx, [photo("m1", "member", { contactId: "ct1" }), photo("lib1", "library")]).tier).toBe("member");
    expect(resolvePhoto("ai_ok", ctx, [photo("lib1", "library")]).tier).toBe("library");
  });

  it("un média d'un AUTRE club/événement n'est pas retenu", () => {
    const pool = [photo("cX", "club", { workspaceId: "autre" }), photo("eX", "event", { eventId: "autre" })];
    const r = resolvePhoto("ai_ok", ctx, pool);
    expect(r.tier).toBe("ai"); // rien de valable dans le contexte → fallback
  });
});

describe("fallback IA (6ᵉ niveau) et garde-fous §3/§11", () => {
  it("ai_ok : aucun média → fond IA généré", () => {
    const r = resolvePhoto("ai_ok", ctx, []);
    expect(r.useAi).toBe(true);
    expect(r.tier).toBe("ai");
    expect(r.blocked).toBe(false);
  });

  it("real_preferred : aucun média → fond IA abstrait accepté", () => {
    const r = resolvePhoto("real_preferred", ctx, []);
    expect(r.useAi).toBe(true);
    expect(r.blocked).toBe(false);
  });

  it("real_required : aucune photo réelle → BLOQUÉ (rien d'inventé), pas d'IA", () => {
    const r = resolvePhoto("real_required", ctx, []);
    expect(r.blocked).toBe(true);
    expect(r.useAi).toBe(false);
    expect(r.reason).toContain("DONNÉE MANQUANTE");
  });

  it("portrait_required : aucun portrait → BLOQUÉ (aucun visage inventé)", () => {
    const r = resolvePhoto("portrait_required", ctx, []);
    expect(r.blocked).toBe(true);
    expect(r.useAi).toBe(false);
    expect(r.reason.toLowerCase()).toContain("portrait");
  });

  it("real_required avec une vraie photo dispo → utilisée, pas bloqué", () => {
    const r = resolvePhoto("real_required", ctx, [photo("c1", "club", { workspaceId: "ws1" })]);
    expect(r.blocked).toBe(false);
    expect(r.asset?.id).toBe("c1");
  });
});

describe("logos dynamiques (logoSlots, 0..N)", () => {
  const pool: MediaAsset[] = [
    { id: "lb", kind: "logo", source: "library", logoSlot: "logo_beerecos" },
    { id: "lc", kind: "logo", source: "club", logoSlot: "logo_club", workspaceId: "ws1" },
    { id: "lcX", kind: "logo", source: "club", logoSlot: "logo_club", workspaceId: "autre" },
  ];

  it("résout les slots présents et signale les absents (sans erreur)", () => {
    const res = resolveLogos(["logo_beerecos", "logo_club", "logo_partenaire"], ctx, pool);
    expect(res.find((r) => r.slot === "logo_beerecos")?.available).toBe(true);
    expect(res.find((r) => r.slot === "logo_club")?.asset?.id).toBe("lc");
    expect(res.find((r) => r.slot === "logo_partenaire")?.available).toBe(false);
  });

  it("un logo de club scopé ne fuite pas sur un autre club", () => {
    const res = resolveLogos(["logo_club"], { workspaceId: "autre" }, pool);
    expect(res[0].asset?.id).toBe("lcX");
  });

  it("liste vide de slots → résultat vide (0 logo est valide)", () => {
    expect(resolveLogos([], ctx, pool)).toHaveLength(0);
  });
});
