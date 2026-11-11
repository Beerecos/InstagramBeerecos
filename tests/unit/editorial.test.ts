import { describe, expect, it } from "vitest";
import sample from "../fixtures/editorial-sample.json";
import { beatTicks, snap, snapToBeat, snapToHalfBeat } from "@/domain/social/editorial/beat";
import { bezier, EASE } from "@/domain/social/editorial/easings";
import { StoryboardSchema, type EditorialScene, type Storyboard } from "@/domain/social/editorial/schema";
import { baseGap, planStoryboard, SFX_PEAK_MS, voiceMs } from "@/domain/social/editorial/schedule";
import { brandCase, editorialAssets, fit, renderEditorial, textEm, INNER_W } from "@/domain/social/editorial/render";
import { directFromScript, directorBrief, editorialLines, finalize, inventedNumbers, parseDirector } from "@/domain/social/editorial/director";
import { qaStoryboard } from "@/domain/social/editorial/qa";
import { END_VIDEO } from "@/domain/social/montage/brand";

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
  it("petits écarts de l'IA réparés au lieu de rejeter toute la structure", () => {
    const ai = {
      preset: "editorial-impact", intensity: 4, bpm: 120, sfx: "normal", mascot: true, title: "3 erreurs",
      scenes: [
        { id: "s1", type: "statement", background: "dark", layout: "left", style: "3d", lines: ["3 ERREURS", "QUI FONT FUIR", "TES CLIENTS"], accentWords: ["FUIR"], voice: "Trois erreurs font fuir tes clients sans que tu le voies.", animation: "deep" },
        { id: "s2", type: "strike", background: "brand", layout: "right", before: "RÉPONDRE DEMAIN", after: "RÉPONDRE TOUT DE SUITE MAINTENANT", micro: "Le délai tue la vente.", voice: "Erreur un : répondre demain. Un prospect qui attend part ailleurs." },
        { id: "s3", type: "impact", background: "dark", word: "LE SUIVI.", sub: "Personne ne relance.", style: "3d", accentWords: ["SUIVI"], voice: "Erreur deux : oublier le suivi après le premier rendez-vous." },
        { id: "s4", type: "statement", background: "light", lines: ["PARLER DE TOI", "PLUTÔT QUE", "DE LUI"], accentWords: ["LUI"], style: "cartouche", voice: "Erreur trois : parler de toi plutôt que de son problème." },
        { id: "s5", type: "video", background: "dark", voice: "scène inconnue" },
        { id: "s6", type: "cta", background: "dark", lines: ["ALORS,", "ON SE VOIT", "AU CLUB ?"], sub: "Chez BeeRecos, des chefs d'entreprise se recommandent chaque semaine des clients qualifiés.", button: "DÉCOUVRIR UN CLUB", brand: true, voice: "Chez BeeRecos, on se recommande des clients chaque semaine. Viens découvrir un club." },
      ],
    };
    const r = parseDirector(JSON.stringify(ai), "3 erreurs qui font perdre des clients", { mascot: true });
    expect(r.source).toBe("ai");
    expect(r.storyboard.scenes.map((s) => s.type)).toEqual(["statement", "strike", "impact", "statement", "cta"]);
    expect(r.storyboard.scenes.map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    const strike = r.storyboard.scenes[1] as Extract<EditorialScene, { type: "strike" }>;
    expect(strike.layout).toBe("left");
    expect(strike.after.length).toBeLessThanOrEqual(40);
    expect(strike.after.endsWith(" ")).toBe(false);
    const cta = r.storyboard.scenes[4] as Extract<EditorialScene, { type: "cta" }>;
    expect(cta.sub!.length).toBeLessThanOrEqual(60);
    expect(r.storyboard.mascot).toBe(true);
  });
  it("réponse sans appel à l'action ou trop courte → structure de secours", () => {
    const short = { preset: "editorial-impact", scenes: [{ id: "a", type: "impact", background: "dark", word: "STOP." }, { id: "b", type: "impact", background: "dark", word: "GO." }] };
    expect(parseDirector(JSON.stringify(short), "idée").source).toBe("rules");
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
  it("Réel IA d'environ 30 s : la consigne le demande, la QA signale un Réel trop long", () => {
    expect(directorBrief("idée", { idea: true })).toContain("environ 30 s de contenu (la vidéo de fin BeeRecos est ajoutée automatiquement après)");
    const s = sb();
    expect(qaStoryboard(s, planStoryboard(s)).map((i) => i.code)).not.toContain("duration");
    const long = { ...s, scenes: s.scenes.map((x) => ({ ...x, voice: Array(40).fill("mot").join(" ") })) } as Storyboard;
    expect(qaStoryboard(long, planStoryboard(long)).find((i) => i.code === "duration")?.message).toMatch(/vise environ 30 s/);
  });
  it("faits du web : donnés à l'IA avec leur source ; leurs chiffres deviennent autorisés", () => {
    const facts = [{ date: "2024", text: "87 % des dirigeants font confiance au bouche-à-oreille.", source: "Ifop" }];
    const b = directorBrief("la recommandation", { idea: true, facts });
    expect(b).toContain("FAITS TROUVÉS SUR LE WEB");
    expect(b).toContain("2024 : 87 % des dirigeants font confiance au bouche-à-oreille. (Ifop)");
    expect(directorBrief("la recommandation", { idea: true })).not.toContain("FAITS TROUVÉS");
    const s = { ...sb(), scenes: sb().scenes.map((x, i) => ({ ...x, voice: i === 0 ? "87 % des dirigeants se fient au bouche-à-oreille." : "Bonjour." })) } as Storyboard;
    expect(inventedNumbers(s, "la recommandation")).toHaveLength(1);
    expect(inventedNumbers(s, ["la recommandation", "2024 87 % des dirigeants font confiance au bouche-à-oreille."].join("\n"))).toEqual([]);
  });
  it("Réel générique : consigne affirmations/tips, BeeRecos seulement dans le CTA (QA le signale sinon)", () => {
    const b = directorBrief("la recommandation", { idea: true });
    expect(b).toContain("GÉNÉRIQUE");
    expect(b).toContain("N'écris JAMAIS « BeeRecos »");
    // L'exemple met « CHEZ BeeRecos » dans la scène 2 : signalé ; dans le CTA : accepté.
    const s = sb();
    expect(qaStoryboard(s, planStoryboard(s)).filter((i) => i.code === "brand-early").map((i) => i.sceneId)).toEqual([s.scenes[1].id]);
    const ok = { ...s, scenes: s.scenes.map((x, i) => (i === 1 && x.type === "statement" ? { ...x, lines: ["TU NE VIENS PAS", "CHERCHER DES", "CARTES DE VISITE."], micro: undefined } : x)) } as Storyboard;
    expect(qaStoryboard(ok, planStoryboard(ok)).map((i) => i.code)).not.toContain("brand-early");
  });
  it("nouvelles animations : mot-impact, barré puis remplacé, titre 3D, cartouches (Réels filmés)", () => {
    const base = sb();
    const v = StoryboardSchema.parse({ ...base, mascot: true, scenes: [
      { id: "a", type: "statement", style: "3d", background: "dark", lines: ["3 ERREURS", "QUI FONT FUIR"], accentWords: ["FUIR"], voice: "Une phrase dite par Audrey qui laisse le temps de voir le saut de la mascotte." },
      { id: "b", type: "strike", background: "brand", lead: "ERREUR N°1", before: "VENDRE", after: "ÉCOUTER", voice: "Une phrase dite par Audrey qui laisse le temps de voir le saut de la mascotte." },
      { id: "c", type: "impact", background: "dark", word: "RELANCE.", voice: "Une phrase dite par Audrey qui laisse le temps de voir le saut de la mascotte." },
      { id: "d", type: "statement", style: "cartouche", background: "light", lines: ["PARLE DE LUI."], accentWords: ["LUI"], voice: "Une phrase dite par Audrey qui laisse le temps de voir le saut de la mascotte." },
      base.scenes[4],
    ] });
    const plan = planStoryboard(v);
    const anims = plan.scenes.flatMap((p) => p.events.map((e) => e.anim));
    for (const a of ["deep", "strike", "dim", "flash", "impact", "cart"]) expect(anims).toContain(a);
    const html = renderEditorial(v, { assetBase: "/hf" }, plan);
    expect(html).toContain('id="b-line" class="strike-line"');
    expect(html).toContain('id="c-flash" class="flash"');
    expect(html).toContain("class=\"in deep\"");
    expect(html).toContain("class=\"in cart\"");
    // Mascotte : réaction sur le mot fort (position mesurée à l'exécution), trampoline sur le mot-impact et sur le bouton,
    // éjection du mot barré, frisson sur l'affirmation choc.
    expect(html).toMatch(/[BP]X\("#a-l1 em"\)/);
    expect(html).toContain('BX("#c-word")');
    expect(html).toContain(`BX("#${base.scenes[4].id}-btn")`);
    expect(html).toContain('x: () => 420 * PD("#b-before")');
    expect(html).toContain('tl.fromTo("#bee-sq", { x: -7 }');
    expect(qaStoryboard(v, plan).filter((i) => i.level === "error")).toEqual([]);
  });
  it("pas de logo sur l'écran de l'appel à l'action : le logo n'apparaît que dans la vidéo de fin officielle", () => {
    const base = sb();
    const html = renderEditorial(base, { assetBase: "/hf" });
    expect(html).not.toMatch(/beerecos-logo|class="logo/);
    expect(html).toContain(END_VIDEO.file);
    expect(editorialAssets(base).some((f) => f.includes("logo"))).toBe(false);
  });
  it("mascotte variée : chaque Réel pioche ses gestes d'après son texte, toujours le même rendu pour le même texte", () => {
    const scene = (id: string, w: string) => ({ id, type: "statement", style: "plain", background: id === "x2" ? "light" : "dark", lines: [`PARLE DE ${w}`, "AVANT TOUT."], accentWords: [w], voice: "Une phrase dite par Audrey qui laisse le temps de voir le geste de la mascotte." });
    const make = (w: string) => StoryboardSchema.parse({ preset: "editorial-impact", mascot: true, scenes: [scene("x1", w), scene("x2", w), scene("x3", w), scene("x4", w), sb().scenes[4]] });
    const gestures = (h: string) => ({ salto: /rotation: -?360/.test(h), sky: h.includes("y: -1"), hide: h.includes('clipPath: "inset(0% 0% 100% 0%)"'), push: h.includes("PX("), trampoline: (h.match(/y: \(\) => BY\([^)]*\) - 150/g) ?? []).length > 2 });
    const all = ["LUI", "ELLE", "EUX", "NOUS", "TOI", "MOI"].map((w) => renderEditorial(make(w), { assetBase: "/hf" }));
    expect(renderEditorial(make("LUI"), { assetBase: "/hf" })).toBe(all[0]);
    const seen = all.map(gestures);
    for (const g of ["salto", "sky", "hide", "push", "trampoline"] as const) expect(seen.some((x) => x[g])).toBe(true);
    // Le geste sur la 1re scène change d'un Réel à l'autre.
    const first = (h: string) => h.includes('PX("#x1-l0 em")') ? "push" : h.includes('tl.set("#bee", { x: () => BX("#x1-l0 em") }') ? "hide" : (h.match(/BY\("#x1-l0 em"\) - 150/g) ?? []).length >= 2 ? "trampoline" : "perch";
    expect(new Set(all.map(first)).size).toBeGreaterThan(1);
  });
  it("signale un texte répété", () => {
    const s = sb();
    const dup = { ...s, scenes: [s.scenes[1], { ...s.scenes[1], id: "s9" }, s.scenes[4]] } as Storyboard;
    expect(qaStoryboard(dup, planStoryboard(dup)).map((i) => i.code)).toContain("duplicate");
  });
});

describe("Studio IA simple — voix d'Audrey et mascotte", () => {
  const withVoice = () => ({ ...sb(), scenes: sb().scenes.map((x, i) => ({ ...x, voice: i === 1 ? "Chez BeeRecos tu ne viens pas chercher des cartes de visite, tu viens construire ton réseau d'apporteurs d'affaires, chaque semaine, avec des chefs d'entreprise." : "Une phrase courte." })) }) as Storyboard;
  it("une scène dure au moins le temps de la phrase d'Audrey (estimée, puis réelle)", () => {
    const s = withVoice();
    const plan = planStoryboard(s);
    const p = plan.scenes[1];
    expect(p.voiceMs).toBe(voiceMs(s, s.scenes[1]));
    expect(p.endMs - p.voiceAtMs!).toBeGreaterThanOrEqual(p.voiceMs! + 250);
    const real = planStoryboard({ ...s, voiceDurations: { [s.scenes[1].id]: 12 } });
    expect(real.scenes[1].endMs - real.scenes[1].voiceAtMs!).toBeGreaterThanOrEqual(12250);
  });
  it("mascotte : présente seulement si cochée, le texte lui laisse la place", () => {
    expect(renderEditorial(sb(), { assetBase: "/hf" })).not.toContain("beerecos-mascotte.webp");
    const html = renderEditorial({ ...sb(), mascot: true }, { assetBase: "/hf" });
    expect(html).toContain('src="/hf/brand/beerecos-mascotte.webp"');
    expect(html).toContain('class="with-bee"');
  });
  it("idée → consigne d'écriture de la voix, structure Hook → CTA", () => {
    const b = directorBrief("Pourquoi visiter un club avant d'adhérer", { idea: true });
    expect(b).toContain("IDÉE :");
    expect(b).toContain("HOOK");
    expect(b).toContain('"voice"');
  });
  it("découpage déterministe : chaque scène porte sa phrase, la mascotte suit la case", () => {
    const d = directFromScript("Tu connais 500 personnes ? Chez BeeRecos on se recommande. Commente RÉSEAU.", { mascot: true });
    expect(d.mascot).toBe(true);
    expect(d.scenes.every((x) => x.voice)).toBe(true);
  });
  it("chiffre de la voix absent de l'idée : signalé", () => {
    const s = { ...sb(), scenes: sb().scenes.map((x, i) => ({ ...x, voice: i === 0 ? "Plus de 300 entrepreneurs nous rejoignent." : "Bonjour." })) } as Storyboard;
    expect(inventedNumbers(s, "Pourquoi rejoindre un club")).toEqual([{ sceneId: s.scenes[0].id, numbers: ["300"] }]);
    expect(inventedNumbers(s, "300 entrepreneurs")).toEqual([]);
  });
});
