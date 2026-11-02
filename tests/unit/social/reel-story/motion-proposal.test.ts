import { describe, expect, it } from "vitest";
import { DEMO_MOTION } from "@/domain/social/reel-story/motion-spec";
import { parseMotionProposal } from "@/domain/social/reel-story/motion-proposal";

describe("proposition IA sur les cartes choisies", () => {
  it("adapte les textes et garde l'ordre, les animations, la voix et le CTA choisis", () => {
    const answer = structuredClone(DEMO_MOTION);
    answer.scenes[0].title = "Une rencontre utile";
    answer.voice.speed = 1.25;
    const result = parseMotionProposal(answer, DEMO_MOTION);
    expect(result.scenes[0].title).toBe("Une rencontre utile");
    expect(result.voice.speed).toBe(0.92);
    expect(result.scenes.map(s => [s.id, s.visual])).toEqual(DEMO_MOTION.scenes.map(s => [s.id, s.visual]));
    expect(result.assets).toBeUndefined();
  });
  it.each(["change", "unknown", "order", "missing", "extra"])("refuse une modification des cartes : %s", kind => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repris tel quel de BeeMarketing
    const answer: any = structuredClone(DEMO_MOTION);
    if (kind === "change") answer.scenes[0].visual = "personnes";
    if (kind === "unknown") answer.scenes[0].visual = "invente";
    if (kind === "order") [answer.scenes[0], answer.scenes[1]] = [answer.scenes[1], answer.scenes[0]];
    if (kind === "missing") answer.scenes.pop();
    if (kind === "extra") answer.scenes.push(answer.scenes[0]);
    expect(() => parseMotionProposal(answer, DEMO_MOTION)).toThrow(/cartes/);
  });
  it("refuse un contenu non valide avant toute application", () => {
    expect(() => parseMotionProposal(null, DEMO_MOTION)).toThrow();
    const answer = structuredClone(DEMO_MOTION);
    answer.scenes[0].voice = "";
    expect(() => parseMotionProposal(answer, DEMO_MOTION)).toThrow(/voix manquant/);
  });
});
