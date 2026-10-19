import { describe, expect, it } from "vitest";
import { can, ROLES } from "@/domain/roles";
import { normalizeWeights } from "@/domain/content";
import { isActive, NAV_ITEMS } from "@/lib/navigation";
import { safeNext } from "@/lib/http/safe-redirect";

describe("RBAC", () => {
  it("réserve l'Autopilot et l'audit aux administrateurs", () => {
    for (const role of ROLES) {
      expect(can(role, "autopilot:manage")).toBe(role === "admin");
      expect(can(role, "audit:read")).toBe(role === "admin");
    }
  });
  it("le lecteur ne peut rien modifier", () => {
    expect(can("viewer", "content:edit")).toBe(false);
    expect(can("viewer", "leads:edit")).toBe(false);
  });
});

describe("pondérations", () => {
  it("normalise à 100 en conservant les proportions", () => {
    expect(normalizeWeights({ a: 1, b: 1, c: 1 })).toEqual({ a: 34, b: 33, c: 33 });
    expect(normalizeWeights({ a: 50, b: 30, c: 20 })).toEqual({ a: 50, b: 30, c: 20 });
    expect(normalizeWeights({ a: 3, b: 1 })).toEqual({ a: 75, b: 25 });
  });
  it("gère les valeurs nulles, négatives ou invalides", () => {
    expect(normalizeWeights({ a: 0, b: 0, c: 0 })).toEqual({ a: 34, b: 33, c: 33 });
    expect(normalizeWeights({ a: -5, b: Number.NaN, c: 10 })).toEqual({ a: 0, b: 0, c: 100 });
  });
});

describe("navigation", () => {
  it("suit la navigation de l'équipe marketing IA", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(["Accueil", "Missions", "Validations", "Équipe IA", "Chien de garde", "Studio", "Vidéo", "Calendrier", "Campagnes", "Leads", "Analytics", "Bibliothèque", "Marque", "Paramètres"]);
  });
  it("détecte la page active", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/leads", "/")).toBe(false);
    expect(isActive("/settings/integrations", "/settings")).toBe(true);
  });
});

describe("redirections", () => {
  it("bloque les redirections externes", () => {
    expect(safeNext("/leads")).toBe("/leads");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
