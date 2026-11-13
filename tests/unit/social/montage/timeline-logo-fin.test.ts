import { describe, expect, it } from "vitest";
import { checkTimeline } from "@/domain/social/montage/suggest";

// Le logo de fin devient la vidéo de fin officielle, jouée après la dernière image : il ne compte pas dans « une seule
// animation à l'écran à la fois » (2026-11-13 : il bloquait toute animation posée dans la dernière seconde).
describe("une seule animation à l'écran : le logo de fin n'en fait pas partie", () => {
  it("une animation juste avant le logo de fin est acceptée", () => {
    expect(checkTimeline([{ name: "mot-impact", fromMs: 5000, toMs: 7200, props: {} }, { name: "logo-fin", fromMs: 8300, toMs: 10300, props: {} }])).toEqual([]);
  });
  it("deux animations trop proches restent refusées ; deux logos de fin aussi", () => {
    expect(checkTimeline([{ name: "titre", fromMs: 0, toMs: 2000, props: {} }, { name: "mot-impact", fromMs: 2500, toMs: 4000, props: {} }])).toHaveLength(1);
    expect(checkTimeline([{ name: "logo-fin", fromMs: 8000, toMs: 9000, props: {} }, { name: "logo-fin", fromMs: 9500, toMs: 10000, props: {} }]).join(" ")).toContain("une fois");
  });
});
