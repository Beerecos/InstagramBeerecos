import { describe, expect, it } from "vitest";
import { canvaKind } from "@/domain/instagram/canva-kind";

describe("modèles Canva rangés par format", () => {
  it("le nom fait foi : « carrousel » → Carrousel, sinon Post", () => {
    expect(canvaKind("Carrousel InspiBEEz'ness")).toBe("carrousel");
    expect(canvaKind("CARROUSEL Linkedin")).toBe("carrousel");
    expect(canvaKind("Carousel clubs")).toBe("carrousel");
    expect(canvaKind("Gazette Beerecos Post Instagram")).toBe("simple");
    expect(canvaKind("Portrait adherents Post Instagram")).toBe("simple");
    expect(canvaKind("Vrai ou faux Post Instagram")).toBe("simple");
  });
});
