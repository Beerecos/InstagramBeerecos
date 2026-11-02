import { describe, expect, it } from "vitest";
import { KIT_ANIMATIONS } from "@/domain/social/montage/animations";
import type { CaptionWord } from "@/domain/social/montage/edit";
import { catalogue, checkTimeline, extractJsonArray, fieldsOf, keptWords, spokenNumbers, suggestionPrompt, validateSuggestions } from "@/domain/social/montage/suggest";

const w = (text: string, startMs: number, endMs = startMs + 300): CaptionWord => ({ text: ` ${text}`, startMs, endMs });
const WORDS = [
  w("Une", 0), w("recommandation", 300), w("rapporte", 1200), w("30", 1600), w("%", 1900), w("de", 2200), w("chiffre", 2400), w("d'affaires.", 2800),
  w("Commente", 8000), w("CLUB", 8400), w("pour", 8800), w("visiter.", 9100),
];

describe("timeline des animations", () => {
  it("une seule animation à l'écran : au moins 1 s d'écart", () => {
    expect(checkTimeline([{ name: "titre", fromMs: 0, toMs: 2000, props: {} }, { name: "chiffre", fromMs: 3000, toMs: 5000, props: {} }])).toEqual([]);
    expect(checkTimeline([{ name: "titre", fromMs: 0, toMs: 2000, props: {} }, { name: "chiffre", fromMs: 2500, toMs: 5000, props: {} }])[0]).toContain("moins d'1 s");
  });
  it("mot-clé et logo de fin : une fois par vidéo", () => {
    expect(checkTimeline([{ name: "mot-cle", fromMs: 0, toMs: 1000, props: {} }, { name: "mot-cle", fromMs: 5000, toMs: 6000, props: {} }])).toContain("« mot-cle » ne peut apparaître qu'une fois par vidéo.");
  });
});

describe("formulaire des réglages", () => {
  it("déduit texte, nombre, liste et champs facultatifs du schéma", () => {
    expect(fieldsOf(KIT_ANIMATIONS.chiffre)).toEqual([
      { key: "valeur", kind: "number", optional: false },
      { key: "decimales", kind: "number", optional: true },
      { key: "avant", kind: "text", optional: true },
      { key: "apres", kind: "text", optional: true },
      { key: "legende", kind: "text", optional: false },
    ]);
    expect(fieldsOf(KIT_ANIMATIONS.liste).find((f) => f.key === "items")).toEqual({ key: "items", kind: "list", optional: false });
  });
});

describe("propositions de Claude : rien d'inventé", () => {
  const run = (raw: unknown[], existing = []) => validateSuggestions(raw, WORDS, 10_000, existing, KIT_ANIMATIONS);

  it("refuse une animation connue hors choix, même si le modèle ignore le catalogue", () => {
    const raw = [{ name: "titre", fromMs: 0, toMs: 1000, props: { texte: "Une recommandation" } }];
    const denied = validateSuggestions(raw, WORDS, 10_000, [], KIT_ANIMATIONS, { allowedNames: ["chiffre"] });
    expect(denied.accepted).toEqual([]);
    expect(denied.rejected).toEqual([{ name: "titre", why: "animation non sélectionnée" }]);
    expect(validateSuggestions(raw, WORDS, 10_000, [], KIT_ANIMATIONS, { allowedNames: [] }).accepted).toEqual([]);
    expect(validateSuggestions(raw, WORDS, 10_000, [], KIT_ANIMATIONS, { allowedNames: ["titre"] }).accepted).toHaveLength(1);
  });

  it("accepte une proposition ancrée sur un mot dit, recalée sur son début", () => {
    const r = run([{ name: "chiffre", fromMs: 1650, toMs: 4650, props: { valeur: 30, apres: " %", legende: "de chiffre d'affaires" }, reason: "preuve chiffrée" }]);
    expect(r.rejected).toEqual([]);
    expect(r.accepted[0]).toMatchObject({ name: "chiffre", fromMs: 1600, toMs: 4600, reason: "preuve chiffrée" });
  });

  it("refuse un chiffre, un mot-clé ou un nombre de titre qui ne sont pas dits", () => {
    const r = run([
      { name: "chiffre", fromMs: 1600, toMs: 4000, props: { valeur: 45, legende: "x" } },
      { name: "mot-cle", fromMs: 8000, toMs: 9800, props: { mot: "RESEAU" } },
      { name: "titre", fromMs: 0, toMs: 1000, props: { texte: "100 clubs en France" } },
    ]);
    expect(r.accepted).toEqual([]);
    expect(r.rejected.map((x) => x.why)).toEqual(["le chiffre 45 n'est pas dit dans la vidéo", "le mot « RESEAU » n'est pas prononcé", "chiffre non dit : 100"]);
  });

  it("refuse les animations inconnues, mal réglées, hors mot ou en collision", () => {
    const r = run([
      { name: "feu-artifice", fromMs: 0, toMs: 1000, props: {} },
      { name: "liste", fromMs: 0, toMs: 2000, props: { items: ["seul"] } },
      { name: "titre", fromMs: 5000, toMs: 7000, props: { texte: "Silence" } },
      { name: "mot-cle", fromMs: 8000, toMs: 9800, props: { mot: "CLUB" } },
      "pas un objet",
    ], [{ name: "titre", fromMs: 8200, toMs: 9000, props: { texte: "Déjà là" } }] as never);
    expect(r.accepted).toEqual([]);
    expect(r.rejected.map((x) => x.why)).toEqual(["animation inconnue", expect.stringContaining("items"), "pas ancrée sur un mot prononcé", "chevauche une autre animation", "proposition illisible"]);
  });

  it("lit les nombres dits et le tableau JSON d'une réponse", () => {
    expect([...spokenNumbers([w("12 500", 0), w("3,5", 400)])]).toEqual([12, 12500, 3.5]);
    expect([...spokenNumbers([w("12", 0), w("500", 300), w("clubs", 600)])]).toEqual([12, 12500]);
    expect(extractJsonArray('Voici :\n[{"name":"titre"}]\nBonne journée')).toEqual([{ name: "titre" }]);
    expect(extractJsonArray("pas de JSON")).toEqual([]);
  });

  it("n'ancre rien sur une phrase coupée, et donne au modèle les règles et le catalogue", () => {
    expect(keptWords(WORDS, [{ fromMs: 0, toMs: 3200 }]).map((x) => x.text.trim())).toEqual(["Une", "recommandation", "rapporte", "30", "%", "de", "chiffre", "d'affaires."]);
    const p = suggestionPrompt(WORDS, catalogue(KIT_ANIMATIONS), [], [{ slug: "brand", content: "Charte" }]);
    expect(p.system).toContain("n'invente aucun chiffre");
    expect(p.system).toContain("## brand\nCharte");
    expect(p.user).toContain("- chiffre (~3000 ms)");
    expect(p.user).toContain("CLUB\t8400\t8700");
  });
});
