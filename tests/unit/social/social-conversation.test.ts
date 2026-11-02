import { describe, it, expect } from "vitest";
import {
  normalizeKeyword, matchCommentKeyword, parseLocation,
  nextSocialState, botMayAutoAdvanceTo, leadStatusForSocialState,
  pickReplyVariant, firstDm, fillVars, SOCIAL_STATES,
} from "@/domain/social/social-conversation";

describe("matchCommentKeyword", () => {
  it("insensible à la casse et aux accents", () => {
    expect(matchCommentKeyword("Je veux une INVITATION svp", "keyword", ["invitation"])).toBe("invitation");
    expect(matchCommentKeyword("Rénnes ça m'intéresse", "keyword", ["rennes"])).toBe("rennes");
  });
  it("mode all → toujours déclenché", () => {
    expect(matchCommentKeyword("n'importe quoi", "all", [])).toBe("*");
  });
  it("aucun mot-clé → null", () => {
    expect(matchCommentKeyword("bonjour", "keyword", ["club", "invitation"])).toBeNull();
  });
  it("normalizeKeyword", () => {
    expect(normalizeKeyword("  CLUB  ")).toBe("club");
    expect(normalizeKeyword("Événement")).toBe("evenement");
  });
});

describe("parseLocation", () => {
  it("ville seule", () => {
    expect(parseLocation("Bayonne")).toEqual({ city: "Bayonne", postalCode: null });
    expect(parseLocation("Anglet")).toEqual({ city: "Anglet", postalCode: null });
  });
  it("préposition + ville", () => {
    expect(parseLocation("Je suis à Bayonne").city).toBe("Bayonne");
    expect(parseLocation("vers Biarritz").city).toBe("Biarritz");
    expect(parseLocation("je travaille à Bidart").city).toBe("Bidart");
  });
  it("code postal", () => {
    expect(parseLocation("64100")).toEqual({ city: null, postalCode: "64100" });
    expect(parseLocation("je suis sur le 64100").postalCode).toBe("64100");
  });
  it("ville composée", () => {
    expect(parseLocation("Saint-Jean-de-Luz").city).toContain("Saint-Jean");
  });
  it("texte sans localisation exploitable", () => {
    expect(parseLocation("oui je veux bien merci beaucoup").city).toBeNull();
  });
});

describe("machine à états", () => {
  it("progression nominale", () => {
    expect(nextSocialState("comment_received", "public_reply")).toBe("public_reply_sent");
    expect(nextSocialState("public_reply_sent", "dm_sent")).toBe("dm_initial_sent");
    expect(nextSocialState("dm_initial_sent", "user_reply")).toBe("dm_user_engaged");
    expect(nextSocialState("event_proposed", "registration_click")).toBe("registration_clicked");
    expect(nextSocialState("event_proposed", "no_registration_48h")).toBe("phone_followup");
  });
  it("transition invalide → no-op", () => {
    expect(nextSocialState("comment_received", "registered")).toBe("comment_received");
  });
  it("le bot n'avance pas seul au-delà d'event_proposed (closing/human)", () => {
    expect(botMayAutoAdvanceTo("event_proposed")).toBe(true);
    expect(botMayAutoAdvanceTo("registered")).toBe(false);
    expect(botMayAutoAdvanceTo("member")).toBe(false);
  });
});

describe("mapping état social → statut lead", () => {
  it("échanges initiaux : pas de changement de statut", () => {
    expect(leadStatusForSocialState("comment_received")).toBeNull();
    expect(leadStatusForSocialState("dm_initial_sent")).toBeNull();
  });
  it("jalons mappés sur le pipeline CRM", () => {
    expect(leadStatusForSocialState("qualified")).toBe("INTERESTED");
    expect(leadStatusForSocialState("event_proposed")).toBe("INVITED");
    expect(leadStatusForSocialState("registered")).toBe("CONFIRMED");
    expect(leadStatusForSocialState("present")).toBe("ATTENDED");
    expect(leadStatusForSocialState("member")).toBe("MEMBER");
  });
  it("tous les états ont une correspondance définie (jamais undefined)", () => {
    for (const s of SOCIAL_STATES) {
      expect(leadStatusForSocialState(s) === null || typeof leadStatusForSocialState(s) === "string").toBe(true);
    }
  });
});

describe("messages", () => {
  it("variantes tournantes et remplies", () => {
    const a = pickReplyVariant(0, { first_name: "Thomas" });
    const b = pickReplyVariant(1, { first_name: "Thomas" });
    expect(a).toContain("Thomas");
    expect(a).not.toEqual(b); // rotation anti-répétition
  });
  it("premier DM", () => {
    expect(firstDm({ first_name: "Thomas" })).toContain("Thomas");
  });
  it("variable manquante laissée en placeholder (jamais inventée)", () => {
    expect(fillVars("Bonjour {{first_name}}", {})).toBe("Bonjour {{first_name}}");
  });
});
