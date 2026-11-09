import { describe, expect, it } from "vitest";
import { initialEdit } from "@/domain/social/montage/montage";
import { deleteCard, keepCard, modifyInstruction, regenerateCard, restoreCard, storyboardCards } from "@/domain/social/montage/storyboard-cards";
import { EditSchema } from "@/domain/social/montage/edit";

/** Un mot toutes les 300 ms ; phrases séparées par un point. */
function words(text: string) {
  return text.split(" ").map((w, i) => ({ text: w, startMs: i * 300, endMs: i * 300 + 250 }));
}
const SPEECH = "Ton réseau vaut de l'or si tu sais quoi dire. Imagine un photographe qui travaille avec les restaurants du quartier. Nous avons accueilli 120 entrepreneurs cette année dans nos clubs. Retiens bien ceci, la recommandation se prépare. Commente RÉSEAU pour visiter un club.";
const W = words(SPEECH);
const DURATION = W[W.length - 1].endMs + 500;
const base = () => initialEdit("prise.mp4", DURATION);

describe("storyboard en cartes", () => {
  it("une carte par séquence, dans l'ordre, avec rôle, phrase dite et position dans la vidéo montée", () => {
    const cards = storyboardCards(base(), W, DURATION, "RÉSEAU");
    expect(cards.length).toBeGreaterThan(2);
    expect(cards[0]).toMatchObject({ role: "Accroche", status: "suggested", outStartMs: 0 });
    expect(cards.at(-1)?.role).toBe("Appel à l'action");
    cards.slice(1).forEach((c, i) => expect(c.scene.startMs).toBeGreaterThan(cards[i].scene.startMs));
    expect(cards.map((c) => c.scene.text).join(" ")).toContain("120 entrepreneurs");
  });

  it("Garder : statut Validé, enregistré dans le montage (schéma valide)", () => {
    const cards = storyboardCards(base(), W, DURATION);
    const edit = keepCard(base(), cards[1]);
    expect(storyboardCards(edit, W, DURATION)[1].status).toBe("validated");
    expect(EditSchema.safeParse(edit).success).toBe(true);
  });

  it("Supprimer puis Restaurer : la séquence reste visible « Supprimé », puis revient", () => {
    const cards = storyboardCards(base(), W, DURATION);
    const cut = deleteCard(keepCard(base(), cards[1]), cards[1]);
    const after = storyboardCards(cut, W, DURATION);
    expect(after[1]).toMatchObject({ status: "deleted", outStartMs: null });
    expect(after.length).toBe(cards.length);
    expect(after[2].outStartMs!).toBeLessThan(cards[2].outStartMs!);
    const back = storyboardCards(restoreCard(cut, after[1], DURATION), W, DURATION);
    expect(back[1].status).toBe("suggested");
    expect(back[2].outStartMs).toBe(cards[2].outStartMs);
  });

  it("Régénérer : seule la séquence visée change, statut Modifié, timeline valide", () => {
    const cards = storyboardCards(base(), W, DURATION, "RÉSEAU");
    const other = { name: "onglet", fromMs: cards[0].scene.startMs, toMs: cards[0].scene.startMs + 2000, props: { texte: "RÉSEAU", variante: "blanc" } };
    const edit = { ...base(), custom: [other] };
    const target = cards.find((c) => c.role === "Chiffre" || c.role === "Preuve") ?? cards[2];
    const r = regenerateCard(edit, target, { canBehind: false, keyword: "RÉSEAU" });
    expect(r).not.toBeNull();
    expect(r!.edit.custom).toContainEqual(other);
    const card = storyboardCards(r!.edit, W, DURATION, "RÉSEAU").find((c) => c.key === target.key)!;
    expect(card.status).toBe("modified");
    expect(card.effects.length).toBe(1);
    // Régénérer encore : une autre proposition (jamais la même deux fois de suite).
    const again = regenerateCard(r!.edit, card, { canBehind: false, keyword: "RÉSEAU" });
    if (again) expect(again.name).not.toBe(r!.name);
  });

  it("Modifier : consigne limitée à la séquence, avec ses temps et la phrase dite", () => {
    const card = storyboardCards(base(), W, DURATION)[0];
    const msg = modifyInstruction(card, "zoom moins fort");
    expect(msg).toMatch(/^Seulement pour la séquence de 0,0 s à /);
    expect(msg).toContain("Ton réseau vaut de l'or");
    expect(msg.endsWith(": zoom moins fort")).toBe(true);
  });
});
