import { describe, expect, it } from "vitest";
import { DraftSchema, canStartPublishing, photoCrop, containerKind, mentionsKeyword, normalizeKeyword, publishBlockers, tokenNeedsRefresh } from "@/domain/instagram/publication";

const base = { kind: "post" as const, caption: "Commente CLUB pour recevoir le lien", media: [{ path: "u/a.jpg", type: "image" as const }], keyword: "CLUB", dmText: "Voici le lien", buttonTitle: null, buttonUrl: null, status: "draft" as const };

describe("onglet Post : règles de publication", () => {
  it("normalise le mot-clé et refuse plusieurs mots ou un lien non https", () => {
    expect(normalizeKeyword(" club ")).toBe("CLUB");
    expect(DraftSchema.parse({ kind: "post", keyword: "réseau" }).keyword).toBe("RÉSEAU");
    expect(DraftSchema.parse({ kind: "post", keyword: "" }).keyword).toBeNull();
    expect(DraftSchema.safeParse({ kind: "post", keyword: "C" }).success).toBe(false);
    expect(DraftSchema.safeParse({ kind: "post", buttonUrl: "http://beerecos.com" }).success).toBe(false);
    expect(DraftSchema.safeParse({ kind: "post", media: Array.from({ length: 11 }, (_, i) => ({ path: `u/${i}.jpg`, type: "image" })) }).success).toBe(false);
  });

  it("prêt à publier quand tout est là", () => {
    expect(publishBlockers(base, { connected: true })).toEqual([]);
  });

  it("dit précisément ce qui manque", () => {
    expect(publishBlockers({ ...base, media: [] }, { connected: true })).toContain("Ajoute au moins une photo.");
    expect(publishBlockers(base, { connected: false })[0]).toMatch(/pas connecté/);
    expect(publishBlockers({ ...base, dmText: "" }, { connected: true })[0]).toMatch(/DM/);
    expect(publishBlockers({ ...base, caption: "Lien en bio" }, { connected: true })[0]).toMatch(/commenter CLUB/);
    expect(publishBlockers({ ...base, buttonTitle: "Voir" }, { connected: true })[0]).toMatch(/bouton/);
    expect(publishBlockers({ ...base, kind: "reel", media: [] }, { connected: true, hasVideo: false })[0]).toMatch(/MP4/);
    expect(publishBlockers({ ...base, caption: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ") + " CLUB" }, { connected: true })).toContain("30 hashtags au plus.");
    expect(publishBlockers({ ...base, status: "published" }, { connected: true })).toContain("Déjà publié.");
  });

  it("le mot-clé est cherché comme un mot entier, sans accent ni casse", () => {
    expect(mentionsKeyword("Commente « club » !", "CLUB")).toBe(true);
    expect(mentionsKeyword("Commente CLUBS", "CLUB")).toBe(false);
    expect(mentionsKeyword("écris RESEAU", "RÉSEAU")).toBe(true);
  });

  it("choisit le bon format Instagram et n'autorise la relance que depuis brouillon ou échec", () => {
    expect(containerKind({ kind: "reel", media: [] })).toBe("REELS");
    expect(containerKind(base)).toBe("IMAGE");
    expect(containerKind({ kind: "post", media: [base.media[0], base.media[0]] })).toBe("CAROUSEL");
    expect(["draft", "publishing", "published", "error"].map((s) => canStartPublishing(s as never))).toEqual([true, false, false, true]);
  });

  it("renouvelle le jeton à moins de 10 jours de l'expiration", () => {
    const now = Date.parse("2026-11-03T00:00:00Z");
    expect(tokenNeedsRefresh("2026-11-10T00:00:00Z", now)).toBe(true);
    expect(tokenNeedsRefresh("2026-12-30T00:00:00Z", now)).toBe(false);
    expect(tokenNeedsRefresh(null, now)).toBe(false);
  });
});

describe("photos de post", () => {
  it("recadre au centre hors de 4:5 – 1,91:1 et réduit à 1440 px", () => {
    expect(photoCrop(1080, 1920)).toMatchObject({ sx: 0, sy: 285, sw: 1080, sh: 1350, cropped: true });
    expect(photoCrop(4000, 1000)).toMatchObject({ sw: 1910, sh: 1000, sx: 1045, w: 1440, cropped: true });
    expect(photoCrop(1080, 1080)).toMatchObject({ w: 1080, h: 1080, cropped: false });
  });
});
