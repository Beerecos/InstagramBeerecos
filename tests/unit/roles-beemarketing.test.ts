import { describe, expect, it } from "vitest";
import { roleFromBeeMarketing } from "@/domain/roles";

describe("roleFromBeeMarketing", () => {
  it("donne l'administration à la direction BeeMarketing", () => {
    expect(roleFromBeeMarketing(["SUPER_ADMIN"])).toBe("admin");
    expect(roleFromBeeMarketing(["MEMBER", "DIRECTION"])).toBe("admin");
  });
  it("laisse tout autre rôle, ou aucun rôle, en lecture seule", () => {
    expect(roleFromBeeMarketing([])).toBe("viewer");
    expect(roleFromBeeMarketing(["MARKETING", "SALES", "ANIMATOR"])).toBe("viewer");
    expect(roleFromBeeMarketing(["super_admin"])).toBe("viewer");
  });
});
