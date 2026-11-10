import { describe, expect, it } from "vitest";
import sample from "../fixtures/editorial-sample.json";
import { beatTicks, snap, snapToBeat, snapToHalfBeat } from "@/domain/social/editorial/beat";
import { bezier, EASE } from "@/domain/social/editorial/easings";
import { StoryboardSchema, type Storyboard } from "@/domain/social/editorial/schema";
import { baseGap, planStoryboard, SFX_PEAK_MS } from "@/domain/social/editorial/schedule";
import { brandCase, fit, renderEditorial, textEm, INNER_W } from "@/domain/social/editorial/render";
import { directFromScript, editorialLines, finalize, parseDirector } from "@/domain/social/editorial/director";
import { qaStoryboard } from "@/domain/social/editorial/qa";

const sb = () => StoryboardSchema.parse(sample);

describe("Editorial Impact — beat grid", () => {
  it("cale sur le temps ou le demi-temps dans la tolérance de ±80 ms", () => {
    expect(snapToBeat(1040)).toBe(1000);
    expect(snapToHalfBeat(1190)).toBe(1250);
    expect(snapToBeat(1200)).toBe(1200); // 200 ms du temps le plus proche : pas de calage
  });
  it("la parole reste prioritaire (pas d'écart de plus de 100 ms au mot)", () => {
    expect(snap(1060, { half: false, speechMs: 1180 })).toBe(1060);
    expect(snap(1060, { half: false, speechMs: 1050 })).toBe(1000);
  });
  it("graduations à 120 BPM toutes les 500 ms", () => {
    expect(beatTicks(0, 2000)).toEqual([0, 500, 1000, 1500, 2000]);
  });
});

describe("Editorial Impact — courbes", () => {
  it("départ 0, arrivée 1, editorialOut rapide au début", () => {
    const f = bezier(...EASE.editorialOut);
    expect(f(0)).toBeCloseTo(0, 5);
    expect(f(1)).toBeCloseTo(1, 5);
    expect(f(0.3)).toBeGreaterThan(0.6);
  });
  it("springCard dépasse légèrement puis se pose", () => {
    const f = bezier(...EASE.springCard);
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => f(i / 100)));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.1);
  });
});

describe("Editorial Impact — moteur d'événements", () => {
  it("intensité 4 : micro-événements toutes les 350 à 650 ms", () => {
    const g = baseGap(4, 120);
    expect(g).toBeGreaterThanOrEqual(350);
    expect(g).toBeLessThanOrEqual(650);
  });
  it("macro-événements : chaque scène dure 3 à 5 s, fin de scène sur un temps", () => {
    const plan = planStoryboard(sb());
    for (const p of plan.scenes) {
      expect(p.endMs - p.startMs).toBeGreaterThanOrEqual(3000);
      expect(p.endMs - p.startMs).toBeLessThanOrEqual(5000);
      expect(p.endMs % 500).toBe(0);
    }
  });
  it("8 à 14 sons, jamais à moins de 120 ms, chaque son a son fichier", () => {
    const plan = planStoryboard(sb());
    expect(plan.audio.length).toBeGreaterThanOrEqual(8);
    expect(plan.audio.length).toBeLessThanOrEqual(14);
    const at = plan.audio.map((a) => a.atMs).sort((a, b) => a - b);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(120);
    for (const a of plan.audio) expect(SFX_PEAK_MS[a.sfx]).toBeTypeOf("number");
  });
  it("sons coupés : aucun son", () => {
    expect(planStoryboard({ ...sb(), sfx: "off" }).audio).toEqual([]);
  });
  it("le CTA complet reste à l'écran au moins 1,5 s", () => {
    const plan = planStoryboard(sb());
    const last = plan.scenes[plan.scenes.length - 1];
    const built = Math.max(...last.events.map((e) => e.atMs + e.durMs));
    expect(last.endMs - built).toBeGreaterThanOrEqual(1500);
  });
  it("transitions : balayage de 11 images (≈ 367 ms) entre les scènes, aucune après la dernière", () => {
    const plan = planStoryboard(sb());
    expect(plan.transitions).toHaveLength(plan.scenes.length - 1);
    for (const t of plan.transitions.filter((x) => x.kind !== "cut")) expect(t.durMs).toBe(367);
  });
  it("même storyboard → même plan (déterministe)", () => {
    expect(planStoryboard(sb())).toEqual(planStoryboard(sb()));
  });
});

describe("Editorial Impact — rendu", () => {
  it("largeur mesurée : une ligne remplit la largeur utile sans la dépasser", () => {
    for (const t of ["LA DIFFÉRENCE ?", "QUI TE RECOMMANDE ?", "CARTES DE VISITE."]) {
      const size = fit(t, 400);
      expect(textEm(t) * size).toBeLessThanOrEqual(INNER_W);
      expect(textEm(t) * size).toBeGreaterThan(INNER_W * 0.9);
    }
  });
  it("finit comme les Reels classiques : vidéo de fin après le CTA (désactivable)", () => {
    const plan = planStoryboard(sb());
    const html = renderEditorial(sb(), { assetBase: "/hyperframes" }, plan);
    expect(html).toContain(`src="/hyperframes/brand/beerecos-video-fin.mp4" data-start="${plan.durationMs / 1000}"`);
    expect(html).toContain(`data-duration="${(plan.durationMs + 7800) / 1000}" data-fps="30"`);
    expect(renderEditorial(sb(), { assetBase: "/hyperframes", outro: false }, plan)).not.toContain("beerecos-video-fin.mp4");
  });
  it("écrit toujours BeeRecos", () => {
    expect(brandCase("CHEZ BEERECOS et beerecos, Bee Recos")).toBe("CHEZ BeeRecos et BeeRecos, BeeRecos");
  });
  it("composition : une section par scène, sons servis par /sfx/, chronologie GSAP en pause", () => {
    const html = renderEditorial(sb(), { assetBase: "/hyperframes" });
    expect(html.match(/<section id="sc-/g)).toHaveLength(5);
    expect(html).toContain('src="/hyperframes/sfx/digitalTick.wav"');
    expect(html).toContain("paused: true");
    expect(html).toContain("BeeRecos");
    expect(html).not.toMatch(/BEERECOS/);
  });
});

describe("Editorial Impact — AI Motion Director", () => {
  const script = "Tu connais 500 personnes qui te recommandent ? Chez BeeRecos, tu ne viens pas chercher des cartes de visite. Chaque semaine : une réunion, des recommandations, des chefs d'entreprise. Commente RÉSEAU pour recevoir ton invitation.";
  it("lignes courtes en capitales, sans mots de remplissage", () => {
    const l = editorialLines("Aujourd'hui on va vraiment parler de recommandation");
    for (const x of l) expect(x.length).toBeLessThanOrEqual(16);
    expect(l.join(" ")).not.toMatch(/AUJOURD|VRAIMENT/);
  });
  it("découpage déterministe : accroche chiffrée, capsules, CTA en dernier, mot-clé repris", () => {
    const d = directFromScript(script);
    expect(d.scenes[0].type).toBe("hook-stat");
    expect(d.scenes.some((s) => s.type === "pills")).toBe(true);
    const last = d.scenes[d.scenes.length - 1];
    expect(last.type).toBe("cta");
    expect(last.transitionOut).toBe("none");
    expect(JSON.stringify(last)).toContain("RÉSEAU");
  });
  it("aucun chiffre inventé : une accroche chiffrée absente du texte est retirée", () => {
    const raw = { ...sb(), scenes: [{ ...sb().scenes[0], stat: { value: 900, prefix: "", suffix: "", decimals: 0 } }, ...sb().scenes.slice(1)] } as Storyboard;
    const out = finalize(raw, "Tu connais des personnes qui te recommandent ?");
    expect(out.scenes.some((s) => s.type === "hook-stat")).toBe(false);
  });
  it("fonds : jamais trois identiques à la suite ; scène humaine claire ; CTA sombre", () => {
    const raw = { ...sb(), scenes: sb().scenes.map((s) => ({ ...s, background: "dark" })) } as Storyboard;
    const out = finalize(raw, script + " 500");
    out.scenes.forEach((s, i) => { if (i >= 2) expect(s.background === out.scenes[i - 1].background && s.background === out.scenes[i - 2].background).toBe(false); });
    expect(out.scenes.find((s) => s.type === "human")?.background).toBe("light");
  });
  it("réponse IA illisible → découpage déterministe", () => {
    const r = parseDirector("désolé, pas de JSON", script);
    expect(r.source).toBe("rules");
    expect(r.storyboard.scenes.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Editorial Impact — QA", () => {
  it("le Reel d'exemple passe sans erreur", () => {
    const s = sb();
    expect(qaStoryboard(s, planStoryboard(s)).filter((i) => i.level === "error")).toEqual([]);
  });
  it("signale une ligne trop longue et un CTA manquant", () => {
    const s = sb();
    const bad = { ...s, scenes: [{ ...s.scenes[1], lines: ["UNE LIGNE BEAUCOUP TROP LONGUE ICI !!"] }, s.scenes[2]] } as Storyboard;
    const codes = qaStoryboard(bad, planStoryboard(bad)).map((i) => i.code);
    expect(codes).toContain("overflow");
    expect(codes).toContain("cta");
  });
  it("signale un texte répété", () => {
    const s = sb();
    const dup = { ...s, scenes: [s.scenes[1], { ...s.scenes[1], id: "s9" }, s.scenes[4]] } as Storyboard;
    expect(qaStoryboard(dup, planStoryboard(dup)).map((i) => i.code)).toContain("duplicate");
  });
});
