import { describe, expect, it } from "vitest";
import { keepMotion, listMotions, motionUsage, searchMotions } from "@/domain/social/montage/beemotion";
import type { CaptionWord } from "@/domain/social/montage/edit";
import { ATTENTION_RISK_MS, analyzeScenes, attentionRisks, intensityWarnings, sceneCandidates, sceneCardCandidate } from "@/domain/social/montage/scenes";

/** Transcript mot à mot : chaque mot dure 300 ms, 100 ms d'écart ; « | » marque une pause de 900 ms. */
function words(script: string, startMs = 0): CaptionWord[] {
  const out: CaptionWord[] = [];
  let t = startMs;
  for (const tok of script.split(" ")) {
    if (tok === "|") { t += 900; continue; }
    out.push({ text: tok, startMs: t, endMs: t + 300 });
    t += 400;
  }
  return out;
}

// Exemple de Reel du script maître (§37).
const REEL = words("Si ton réseau ne te rapporte rien, ce n'est peut-être pas ton réseau le problème. Le problème, c'est que personne ne mesure réellement qui recommande qui. Chez BeeRecos, chaque recommandation peut être suivie. Ton réseau devient enfin un véritable canal d'acquisition. Tu veux voir comment ça fonctionne ? Commente RÉSEAU.");

describe("scènes par intention", () => {
  const scenes = analyzeScenes(REEL, { keyword: "RÉSEAU" });

  it("découpe aux fins de phrase, première scène = accroche, dernière avec « commente » = CTA", () => {
    expect(scenes.length).toBeGreaterThanOrEqual(4);
    expect(scenes[0].intent).toBe("HOOK");
    expect(scenes[scenes.length - 1].intent).toBe("CTA");
    expect(scenes.find((s) => s.text.startsWith("Le problème"))?.intent).toBe("PROBLEM");
    // Le texte de chaque scène est exactement celui du transcript (rien de reformulé).
    expect(scenes.map((s) => s.text).join(" ")).toBe(REEL.map((w) => w.text).join(" "));
  });

  it("intensité visée par fonction : forte à l'accroche et au CTA, moyenne pour expliquer", () => {
    expect(scenes[0].intensity).toBe("high");
    expect(scenes[scenes.length - 1].intensity).toBe("high");
    expect(scenes.find((s) => s.intent === "EXPLAIN")?.intensity).toBe("medium");
  });

  it("mots pivots BeeRecos, deux au plus par scène, calés sur le temps du mot", () => {
    expect(scenes[0].pivotWords[0]).toEqual({ word: "réseau", startMs: REEL[2].startMs });
    expect(scenes.every((s) => s.pivotWords.length <= 2)).toBe(true);
    expect(scenes.flatMap((s) => s.pivotWords.map((p) => p.word.toLowerCase()))).toContain("recommandation");
  });

  it("une pause longue coupe aussi une scène ; une scène trop courte est regroupée", () => {
    const s = analyzeScenes(words("Bonjour à tous ici | ton réseau compte vraiment beaucoup pour toi aujourd'hui"));
    expect(s).toHaveLength(2);
    expect(analyzeScenes(words("Oui. Ton réseau compte vraiment beaucoup pour toi."))).toHaveLength(1);
  });

  it("chiffre dit avec % ou € = STAT ; chiffre seul = PROOF", () => {
    const s = analyzeScenes(words("Ceci est une accroche assez longue. On gagne 30 % de temps chaque semaine. Nous avons 12 clubs en France aujourd'hui."));
    expect(s.map((x) => x.intent)).toEqual(["HOOK", "STAT", "PROOF"]);
  });
});

describe("relances d'attention et rythme", () => {
  it("une scène longue sans animation est signalée ; avec une animation, plus rien", () => {
    const long = analyzeScenes(words(`Accroche courte ici. ${"mot ".repeat(25).trim()}.`));
    const risky = long.find((s) => s.endMs - s.startMs >= ATTENTION_RISK_MS)!;
    expect(attentionRisks(long, [])).toEqual([risky.index]);
    expect(attentionRisks(long, [{ fromMs: risky.startMs + 100, toMs: risky.startMs + 2000 }])).toEqual([]);
  });

  it("trois animations fortes d'affilée = alerte ; alterner suffit", () => {
    const hi = (name: string, fromMs: number) => ({ name, fromMs });
    expect(intensityWarnings([hi("chiffre", 0), hi("titre-derriere", 3000), hi("mot-cle", 6000)])).toHaveLength(1);
    expect(intensityWarnings([hi("chiffre", 0), hi("onglet", 3000), hi("mot-cle", 6000)])).toEqual([]);
  });
});

describe("motions proposés par scène (BeeMotion)", () => {
  const scenes = analyzeScenes(REEL, { keyword: "RÉSEAU" });

  it("accroche : titre derrière le sujet seulement si la prise est détourée, texte = mot pivot", () => {
    const withMatte = sceneCandidates(scenes[0], { canBehind: true, keyword: "RÉSEAU" });
    expect(withMatte[0].motion.id).toBe("titre-derriere");
    expect(withMatte[0].values.texte).toBe("RÉSEAU");
    expect(withMatte[0].anchorMs).toBe(REEL[2].startMs);
    expect(sceneCandidates(scenes[0], { canBehind: false }).map((c) => c.motion.id)).not.toContain("titre-derriere");
  });

  it("CTA : mot-clé du Reel lié ; sans Reel lié, jamais inventé (champ vide à saisir)", () => {
    const cta = scenes[scenes.length - 1];
    expect(sceneCandidates(cta, { canBehind: false, keyword: "RÉSEAU" })[0]).toMatchObject({ motion: { id: "mot-cle" }, values: { mot: "RÉSEAU" } });
    const free = sceneCandidates(cta, { canBehind: false, keyword: null })[0];
    expect(free.values.mot).toBe("");
    expect(free.note).toContain("moteur de DM");
  });

  it("chiffre proposé seulement si un nombre est dit, avec sa valeur réelle", () => {
    const s = analyzeScenes(words("Ceci est une accroche assez longue. On gagne 30 % de temps chaque semaine."));
    expect(sceneCandidates(s[1], { canBehind: false })[0]).toMatchObject({ motion: { id: "chiffre" }, values: { valeur: "30", apres: "%" } });
    expect(sceneCandidates(s[0], { canBehind: false }).map((c) => c.motion.id)).not.toContain("chiffre");
  });

  it("ne propose que les cartes choisies et prépare un dépôt éditable sur la scène", () => {
    expect(sceneCandidates(scenes[0], { canBehind: true, allowedNames: [] })).toEqual([]);
    expect(sceneCandidates(scenes[0], { canBehind: true, allowedNames: ["titre"] }).map((c) => c.motion.id)).toEqual(["titre"]);
    expect(sceneCardCandidate("titre", scenes[0], { canBehind: false })).toMatchObject({ motion: { id: "titre" }, values: { texte: "Si ton réseau ne te rapporte rien ce" } });
    expect(sceneCardCandidate("titre-derriere", scenes[0], { canBehind: false })).toBeNull();
    expect(sceneCardCandidate("image", scenes[0], { canBehind: true })).toBeNull();
    expect(sceneCardCandidate("inconnue", scenes[0], { canBehind: true })).toBeNull();
    expect(sceneCardCandidate("chiffre", scenes[0], { canBehind: false })?.values.valeur).toBe("");
  });

  it("validés d'abord, 3 propositions au plus, jamais un motion qui se pose depuis Médias", () => {
    for (const s of scenes) {
      const c = sceneCandidates(s, { canBehind: true, keyword: "RÉSEAU" });
      expect(c.length).toBeLessThanOrEqual(3);
      expect(c.map((x) => x.motion.id)).not.toContain("image");
      const firstReview = c.findIndex((x) => x.motion.status !== "approved");
      if (firstReview >= 0) expect(c.slice(firstReview).every((x) => x.motion.status !== "approved")).toBe(true);
    }
  });
});

describe("« ON GARDE » et mémoire BeeMotion", () => {
  it("confirmation explicite obligatoire ; le motion gardé devient « approved » et sélectionnable automatiquement", () => {
    expect(keepMotion([], { id: "barre", confirm: "super" }, "cedric", "2026-10-25T10:00:00Z").error).toContain("ON GARDE");
    expect(searchMotions({ category: "highlights" })).toEqual([]);
    const { kept } = keepMotion([], { id: "barre", confirm: "ON GARDE" }, "cedric@beerecos.com", "2026-10-25T10:00:00Z");
    expect(kept).toEqual([{ id: "barre", version: 1, at: "2026-10-25T10:00:00Z", by: "cedric@beerecos.com" }]);
    const found = searchMotions({ category: "highlights", kept });
    expect(found.map((m) => m.id)).toEqual(["barre"]);
    expect(found[0].approval).toBe("On garde — 2026-10-25 (cedric@beerecos.com)");
  });

  it("un « ON GARDE » vaut pour une version : il ne s'applique pas à une autre version du motion", () => {
    const kept = [{ id: "barre", version: 2, at: "2026-10-25", by: "cedric" }];
    expect(listMotions(undefined, kept).find((m) => m.id === "barre")?.status).toBe("review");
  });

  it("refuse un motion inconnu ; idempotent", () => {
    expect(keepMotion([], { id: "inconnu", confirm: "ON GARDE" }, "c", "t").error).toContain("inconnu");
    const once = keepMotion([], { id: "barre", confirm: "ON GARDE" }, "c", "t").kept;
    expect(keepMotion(once, { id: "barre", confirm: "ON GARDE" }, "c", "t2").kept).toBe(once);
  });

  it("usage réel compté dans les montages", () => {
    expect(motionUsage([{ custom: [{ name: "titre", fromMs: 0, toMs: 1, props: {} }, { name: "titre", fromMs: 2, toMs: 3, props: {} }] }, { custom: [] }])).toEqual({ titre: 2 });
  });
});
