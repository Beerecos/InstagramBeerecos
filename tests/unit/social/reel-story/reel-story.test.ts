import { AUDREY_VOICE_ID, DEFAULT_VOICE_SPEED, PRONUNCIATION_VERSION } from "@/domain/social/reel-story/audrey";
import { describe, expect, it } from "vitest";
import { specFingerprint } from "@/domain/social/spec-fingerprint";
import {
  brandCase, buildSoundtrack, buildStoryComposition, DEMO_STORY, encodeWav, layoutLines, parseStorySpec, SAMPLE_RATE, SAFE_WIDTH,
  spokenText, storyBeats, tokenize, totalDuration, voiceWindow, type StorySpec,
} from "@/domain/social/reel-story/index";
import { textWidth } from "@/domain/social/reel-story/metrics";
import { GUIDE_MOTION, guideGsap, guideKeyframes, REFERENCE_DEMO, type GuidePose } from "@/domain/social/reel-story/guide";

const html = (spec: StorySpec = DEMO_STORY, extra = {}) => buildStoryComposition(spec, { assetBase: "https://app.test/hyperframes/", ...extra });

describe("template Reel « Recommandation »", () => {
  it("le contenu de démonstration est valide et dure 20 s", () => {
    expect(parseStorySpec(DEMO_STORY).ok).toBe(true);
    expect(totalDuration(DEMO_STORY)).toBe(20);
  });

  it("la composition respecte le contrat Hyperframes et la charte", () => {
    const out = html();
    expect(out).toContain('data-composition-id="main"');
    // 20 s de film + 7,8 s de vidéo de fin officielle (la même que les Reels).
    expect(out).toContain('data-duration="27.8"');
    expect(out).toContain('src="https://app.test/hyperframes/brand/beerecos-video-fin.mp4" data-start="20"');
    expect(out).toContain('data-width="1080" data-height="1920"');
    expect(out).toContain('data-fps="30"');
    expect(out).toContain('window.__timelines["main"] = tl');
    // Police : Poppins seule, fichiers chargés avant la construction de la chronologie.
    expect(out).toContain("poppins-latin-700-normal.woff2");
    expect(out).toContain("document.fonts.load");
    expect(out).not.toMatch(/Inter|Caveat|Avenir/);
    // Logo de fin officiel (même fichier que les vidéos montées), jamais retapé : aucune ombre, aucun filtre sur lui.
    expect(out).toContain('src="https://app.test/hyperframes/brand/beerecos-logo-horizontal.webp" alt="BeeRecos"');
    expect(out).toContain('src="https://app.test/hyperframes/brand/beerecos-baseline.webp" alt="#MonReseauCestTonReseau"');
    expect(out).not.toMatch(/#logo[^}]*(shadow|filter|rotate)/);
    expect(out).not.toMatch(/text-transform/);
    // Couleurs de la charte uniquement.
    const hex = new Set(out.match(/#[0-9A-Fa-f]{6}\b/g)?.map((c) => c.toUpperCase()));
    for (const c of hex) expect(["#2851FF", "#000000", "#FFFFFF", "#693BFC", "#3BCAC2"]).toContain(c);
  });

  it("aucune ligne ne dépasse la zone utile et le CTA reste stable au moins 3 s", () => {
    for (const text of [DEMO_STORY.hook.text, DEMO_STORY.value.text, "UNE RECOMMANDATION BIEN SUIVIE RAPPORTE"]) {
      for (const l of layoutLines(text, 700, 250, 96)) {
        expect(textWidth(l.tokens.map((k) => (k.space ? " " : "") + k.t).join(""), 700, l.size)).toBeLessThanOrEqual(SAFE_WIDTH);
      }
    }
    const b = storyBeats(DEMO_STORY);
    expect(b.total - b.cta.stable).toBeGreaterThanOrEqual(3);
    expect(b.start.rupture).toBe(4);
    expect(b.start.cta).toBe(15.5);
  });

  it("un texte trop long est coupé en lignes plutôt que réduit", () => {
    const lines = layoutLines("TA RECO EST SUIVIE DE BOUT EN BOUT", 700, 150, 96);
    expect(lines.length).toBeGreaterThan(1);
    expect(Math.min(...lines.map((l) => l.size))).toBeGreaterThanOrEqual(96);
  });

  it("*mot* met en valeur sans casser la ponctuation collée", () => {
    expect(tokenize("A DE LA *VALEUR*.")).toEqual([
      { t: "A", em: false, space: false }, { t: "DE", em: false, space: true }, { t: "LA", em: false, space: true },
      { t: "VALEUR", em: true, space: true }, { t: ".", em: false, space: false },
    ]);
  });

  it("le nom de marque garde sa casse, même écrit en capitales", () => {
    expect(brandCase("DÉCOUVRE BEERECOS")).toBe("DÉCOUVRE BeeRecos");
    const r = parseStorySpec({ ...DEMO_STORY, signature: { tagline: "beerecos, le réseau" } });
    expect(r.ok && r.spec.signature.tagline).toBe("BeeRecos, le réseau");
    expect(spokenText("Avec BeeRecos, commente CLUB.")).toBe("Avec Bi-reu-co, commente Cleub.");
    expect(spokenText("Reçois les informations et développe ton activité.")).toBe("Reçois les zinformations et développe ton nactivité.");
  });

  it("refuse un montant ou une rémunération sans « selon les accords prévus »", () => {
    const amount = parseStorySpec({ ...DEMO_STORY, value: { text: "JUSQU'À 500 € PAR RECO" } });
    expect(amount.ok).toBe(false);
    const noMention = parseStorySpec({
      ...DEMO_STORY, steps: { ...DEMO_STORY.steps, footnote: "" },
      voice: { ...DEMO_STORY.voice, lines: { ...DEMO_STORY.voice.lines, steps: "Tes recommandations sont rémunérées." } },
    });
    expect(noMention.ok).toBe(false);
    expect(parseStorySpec({ ...DEMO_STORY, cta: { ...DEMO_STORY.cta, keyword: "club ici" } }).ok).toBe(false);
    expect(parseStorySpec({ ...DEMO_STORY, durations: { ...DEMO_STORY.durations, rupture: 0.3 } }).ok).toBe(false);
  });

  it("échappe tout texte saisi", () => {
    const evil = { ...DEMO_STORY, title: "</title><script>alert(1)</script>", card: { ...DEMO_STORY.card, label: "<img src=x>" } };
    const out = html(evil);
    expect(out).not.toContain("<script>alert(1)");
    expect(out).not.toContain("<img src=x");
  });

  it("n'insère une voix que si elle correspond au texte actuel", () => {
    const voice = { hook: { src: "/v/hook.wav", duration: 1.3, text: DEMO_STORY.voice.lines.hook, voiceId: AUDREY_VOICE_ID, speed: DEFAULT_VOICE_SPEED, pronunciationVersion: PRONUNCIATION_VERSION } };
    expect(html({ ...DEMO_STORY, voice: {...DEMO_STORY.voice,voiceId:AUDREY_VOICE_ID}, assets: { voice } })).toContain('<audio id="vo-hook" src="/v/hook.wav" data-start="0.15"');
    const stale = { ...DEMO_STORY, voice: { ...DEMO_STORY.voice, lines: { ...DEMO_STORY.voice.lines, hook: "Autre phrase." } }, assets: { voice } };
    expect(html(stale)).not.toContain('id="vo-hook"');
    expect(html(DEMO_STORY, { soundtrackSrc: "bande-son.wav" })).toContain('<audio id="soundtrack" src="bande-son.wav"');
    expect(voiceWindow(DEMO_STORY, "rupture")).toBeGreaterThan(1);
  });

  it("l'empreinte ignore les fichiers produits mais suit le texte", () => {
    const a = specFingerprint(DEMO_STORY);
    expect(specFingerprint({ ...DEMO_STORY, assets: { voice: {} } })).toBe(a);
    expect(specFingerprint({ ...DEMO_STORY, hook: { ...DEMO_STORY.hook, text: "AUTRE" } })).not.toBe(a);
    const parsed = parseStorySpec(DEMO_STORY);
    expect(parsed.ok && specFingerprint(parsed.spec)).toBe(a);
  });
});

describe("bande son originale", () => {
  const s = buildSoundtrack(DEMO_STORY, [{ start: 0.15, end: 1.5 }]);
  const at = (t: number, len = 0.1) => {
    let m = 0;
    for (let i = Math.floor(t * SAMPLE_RATE); i < (t + len) * SAMPLE_RATE; i++) m = Math.max(m, Math.abs(s.left[i]), Math.abs(s.right[i]));
    return m;
  };
  it("dure exactement la vidéo, sans saturation", () => {
    expect(s.left.length).toBe(20 * SAMPLE_RATE);
    expect(Math.max(...[0, 5, 10, 15, 19].map((t) => at(t, 1)))).toBeLessThanOrEqual(0.9);
  });
  it("se suspend sur la rupture et repart sur la valeur", () => {
    expect(at(4.9, 0.5)).toBeLessThan(0.01);
    expect(at(5.5, 0.2)).toBeGreaterThan(0.1);
  });
  it("est déterministe et s'encode en WAV", () => {
    expect(buildSoundtrack(DEMO_STORY, [{ start: 0.15, end: 1.5 }]).left[123456]).toBe(s.left[123456]);
    const wav = encodeWav(s);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(wav.length).toBe(44 + s.left.length * 4);
  });
});

describe("guide (pictogramme officiel)", () => {
  it("utilise le fichier officiel dans un seul conteneur, jamais redessiné", () => {
    const out = html();
    expect(out).toContain('<div id="guide" aria-hidden="true"><div id="guide-in">');
    expect(out).toContain('src="https://app.test/hyperframes/brand/beerecos-pictogramme-bleu.svg"');
    expect(out).toContain('src="https://app.test/hyperframes/brand/beerecos-pictogramme-blanc.svg"');
    expect(out.match(/id="guide"/g)).toHaveLength(1);
  });

  it("n'anime que l'opacité, la translation et l'échelle uniforme", () => {
    for (const mode of ["discret", "dynamique"] as const) {
      const code = Object.values(guideGsap(mode)).map((f) => (f as (a: number, p: GuidePose) => string)(1, { cx: 500, cy: 500, h: 200 })).join("\n");
      expect(code).not.toMatch(/rotat|skew|scaleX|scaleY|filter|shadow|width|height/);
      const states = (["entrer", "attendre", "reagir", "accompagner", "sortir"] as const).map((s) => guideKeyframes(s, mode));
      for (const st of states) {
        expect(st.duration).toBeGreaterThanOrEqual(300);
        expect(st.duration).toBeLessThanOrEqual(800);
        expect(JSON.stringify(st.keyframes)).not.toMatch(/rotate|skew|filter/);
      }
    }
    expect(GUIDE_MOTION.dynamique.react.scale).toBeLessThanOrEqual(1.03);
    expect(GUIDE_MOTION.discret.react.scale).toBeLessThan(GUIDE_MOTION.dynamique.react.scale);
  });

  it("démonstration de référence de 7 s conforme à la gestuelle demandée", () => {
    const k = REFERENCE_DEMO.keyframes;
    expect(REFERENCE_DEMO.duration).toBe(7);
    expect(k.find((f) => f.t === 0.6)).toMatchObject({ opacity: 1, y: 0 });
    expect(Math.max(...k.map((f) => f.scale))).toBe(1.03);
    expect(k.filter((f) => f.t >= 3.8 && f.t <= 6.4).every((f) => f.scale === 1 && f.y === 0)).toBe(true);
    expect(k[k.length - 1]).toMatchObject({ t: 7, opacity: 0 });
  });

  it("le réglage de mouvement fait partie de l'export", () => {
    expect(html({ ...DEMO_STORY, motion: "discret" })).toContain("scale: 1.02");
    expect(html(DEMO_STORY)).toContain("scale: 1.03");
    expect(parseStorySpec({ ...DEMO_STORY, motion: "frénétique" }).ok && (parseStorySpec({ ...DEMO_STORY, motion: "frénétique" }) as { spec: StorySpec }).spec.motion).toBe("dynamique");
  });

  it("aucune rémunération n'est promise par le contenu de démonstration", () => {
    const text = JSON.stringify(DEMO_STORY);
    expect(text).not.toMatch(/rémunér|commission|€/i);
  });
});

describe("production automatique et calendrier", () => {
  it("calendrier Europe/Paris : 18 h reste 18 h avant et après le changement d'heure", async () => {
    const { upcomingSlots } = await import("@/domain/social/reel-story/schedule");
    const slots = upcomingSlots({ days: [1, 3, 5], time: "18:00", tz: "Europe/Paris" }, new Date("2026-10-20T10:00:00Z"), 9).map((d) => d.toISOString());
    expect(slots).toEqual(["2026-10-21T16:00:00.000Z", "2026-10-23T16:00:00.000Z", "2026-10-26T17:00:00.000Z", "2026-10-28T17:00:00.000Z"]);
  });
  it("les trois exemples respectent le modèle, sans chiffre ni rémunération", async () => {
    const { REEL_EXAMPLES, FORBIDDEN_PATTERNS } = await import("@/domain/social/reel-story/index");
    for (const ex of REEL_EXAMPLES) {
      const p = parseStorySpec(ex.spec);
      expect(p.ok, ex.key).toBe(true);
      expect(ex.caption).toContain("Commente CLUB pour recevoir le lien de visite");
      for (const f of FORBIDDEN_PATTERNS) expect(f.re.test(ex.caption.replace(/#\w+/g, "")), `${ex.key} ${f.reason}`).toBe(false);
      expect(totalDuration(ex.spec)).toBeGreaterThanOrEqual(15);
      expect(totalDuration(ex.spec)).toBeLessThanOrEqual(25);
    }
  });
  it("la rotation équilibre les piliers et évite le plus récent", async () => {
    const { nextPillar } = await import("@/domain/social/reel-story/generation");
    expect(nextPillar([])).toBe("reseau_monetise");
    expect(nextPillar(["reseau_monetise"])).toBe("formation");
    expect(nextPillar(["formation", "reseau_monetise", "digitalisation_ia"])).toBe("digitalisation_ia");
  });
  it("zip lisible : signatures et nombre d'entrées", async () => {
    const { buildZip } = await import("@/domain/social/reel-story/zip");
    const z = buildZip([{ path: "index.html", data: new TextEncoder().encode("<html>") }, { path: "fonts/a.woff2", data: new Uint8Array([1, 2]) }]);
    expect([...z.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new DataView(z.buffer).getUint16(z.length - 12, true)).toBe(2);
    expect(() => buildZip([{ path: "../x", data: new Uint8Array() }])).toThrow();
  });
});

describe("statuts de la carte", () => {
  it("sigles et marques gardent leur casse, le reste passe en minuscules", async () => {
    const { sentence } = await import("@/domain/social/reel-story/composition");
    expect(sentence("CRM INTÉGRÉ.")).toBe("CRM intégré");
    expect(sentence("TA BEECARD.")).toBe("Ta BeeCard");
    expect(sentence("OUTILS IA.")).toBe("Outils IA");
    expect(sentence("UN PRO.")).toBe("Un pro");
  });
});
