import { describe, expect, it } from "vitest";
import { checkBrandSpelling, fixBrandSpelling } from "@/lib/brand/brand";

describe("orthographe BeeRecos", () => {
  it("détecte les graphies interdites", () => {
    const text = "Rejoins Beerecos, BEERECOS ou BeeREcos, mais pas Bee Recos.";
    expect(checkBrandSpelling(text).map((i) => i.found)).toEqual(["Beerecos", "BEERECOS", "BeeREcos", "Bee Recos"]);
    expect(fixBrandSpelling(text)).toBe("Rejoins BeeRecos, BeeRecos ou BeeRecos, mais pas BeeRecos.");
  });
  it("accepte la bonne graphie et ignore les identifiants techniques", () => {
    expect(checkBrandSpelling("BeeRecos, InstagramBeerecos, beerecos.com, @beerecos")).toEqual([]);
  });
});
