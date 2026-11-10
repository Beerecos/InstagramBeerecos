import { describe, expect, it } from "vitest";
import {
  DEMO_MOTION, MOTION_ASSETS, buildMotionComposition, buildMotionSoundtrack, estimateMotionSeconds, parseMotionSpec,
  restoreWord, sceneDurations, spokenFrench, type MotionSpec,
} from "@/domain/social/reel-story/index";

const clone = (patch: (s: MotionSpec) => void = () => {}) => { const s = structuredClone(DEMO_MOTION); patch(s); return s; };
const errors = (s: MotionSpec) => { const p = parseMotionSpec(s); return p.ok ? [] : p.errors; };
const html = (s: MotionSpec) => buildMotionComposition(s, { assetBase: "." });

describe("style Motion BeeRecos - Dynamique : contrôles mesurés", () => {
  it("démarre avec une voix posée, tout en conservant un débit choisi explicitement", () => {
    expect(DEMO_MOTION.voice.speed).toBe(0.92);
    expect(parseMotionSpec({ ...DEMO_MOTION, voice: {} }).spec.voice.speed).toBe(0.92);
    expect(parseMotionSpec(clone((s) => { s.voice.speed = 0.85; })).spec.voice.speed).toBe(0.85);
  });
  it("le film de présentation validé passe tous les contrôles", () => expect(errors(DEMO_MOTION)).toEqual([]));
  it("refuse l'intervenant filmé en Vidéo IA (renvoi vers Vidéo Reel)", () => {
    expect(errors(clone((s) => { s.settings.presence = "intervenant"; })).join(" ")).toMatch(/Vidéo Reel/);
  });
  it("exige l'appel à l'action juste avant la signature, et un seul", () => {
    expect(errors(clone((s) => { s.scenes.pop(); })).join(" ")).toMatch(/signature/);
    expect(errors(clone((s) => { s.scenes.splice(2, 0, { ...s.scenes[8], id: "x" }); })).join(" ")).toMatch(/Une seule scène d'appel/);
  });
  it("la voix du CTA prononce le mot-clé", () => {
    expect(errors(clone((s) => { s.scenes[8].voice = "Écris-nous pour préparer ta visite."; })).join(" ")).toMatch(/prononcer le mot-clé CLUB/);
  });
  it("lisibilité : 7 mots à l'écran au plus, pas de phrase recopiée, aucun montant ni rémunération", () => {
    expect(errors(clone((s) => { s.scenes[0].title = "un deux trois quatre cinq six sept huit"; })).join(" ")).toMatch(/7 mots/);
    expect(errors(clone((s) => { s.scenes[1].title = s.scenes[1].voice; })).join(" ")).toMatch(/recopie/);
    expect(errors(clone((s) => { s.scenes[3].voice = "Gagne 500 € par recommandation."; })).join(" ")).toMatch(/montant/);
    expect(errors(clone((s) => { s.scenes[3].voice = "Touche une commission sur chaque affaire."; })).join(" ")).toMatch(/rémunération/);
  });
  it("le rythme change la durée : posé > dynamique > très dynamique, dans la fenêtre 15-60 s", () => {
    const t = (r: MotionSpec["settings"]["rythme"]) => estimateMotionSeconds(clone((s) => { s.settings.rythme = r; }));
    expect(t("pose")).toBeGreaterThan(t("dynamique"));
    expect(t("dynamique")).toBeGreaterThan(t("tres_dynamique"));
    expect(t("tres_dynamique")).toBeGreaterThanOrEqual(15);
    expect(t("pose")).toBeLessThanOrEqual(60);
    const d = sceneDurations(DEMO_MOTION);
    expect(d[8]).toBeGreaterThanOrEqual(4); // CTA tenu
  });
});

describe("style Motion BeeRecos - Dynamique : composition", () => {
  it("mascotte seulement en présence « mascotte », et jamais sur la signature", () => {
    expect(html(DEMO_MOTION)).toContain("beerecos-mascotte.webp");
    expect(html(clone((s) => { s.settings.presence = "graphique"; }))).not.toContain("beerecos-mascotte.webp");
  });
  it("quantité de texte : minimal n'affiche que le mot pivot, riche ajoute la précision", () => {
    const min = html(clone((s) => { s.settings.texte = "minimal"; }));
    expect(min).not.toContain(`class="wt">prochain<`);
    expect(min).toContain(`class="wt">client<`);
    expect(html(clone((s) => { s.settings.texte = "riche"; }))).toContain("Dans son réseau.");
    expect(html(DEMO_MOTION)).not.toContain("Dans son réseau.");
  });
  it("la prononciation ne s'affiche jamais : l'écran et les sous-titres gardent BeeRecos et CLUB", () => {
    const h = html(DEMO_MOTION);
    expect(h).not.toMatch(/Bi-reu-co|Cleub|zinformations/);
    expect(h).toContain(">CLUB<");
    expect(h).toMatch(/class="cw"[^>]*>BeeRecos/);
  });
  it("seuls les fichiers officiels de marque sont utilisés (logo, baseline, mascotte)", () => {
    const imgs = [...html(DEMO_MOTION).matchAll(/<img[^>]+src="\.\/([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(imgs)).toEqual(new Set(MOTION_ASSETS.filter((a) => a.startsWith("brand/") && !a.endsWith(".mp4"))));
    // Fin : la vidéo de fin officielle des Reels, après la dernière scène.
    expect(html(DEMO_MOTION)).toContain('src="./brand/beerecos-video-fin.mp4"');
  });
  it("tout texte saisi est échappé", () => {
    expect(html(clone((s) => { s.scenes[0].title = "Ton <b>prochain</b>\nclient"; }))).not.toContain("<b>prochain");
  });
  it("bande son : durée de la vidéo, version sans musique plus calme", () => {
    const a = buildMotionSoundtrack(DEMO_MOTION), b = buildMotionSoundtrack(DEMO_MOTION, { withMusic: false });
    expect(a.left.length).toBe(Math.ceil(estimateMotionSeconds(DEMO_MOTION) * a.sampleRate));
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((n, v) => n + v * v, 0) / x.length);
    expect(rms(b.left)).toBeLessThan(rms(a.left) / 2);
  });
});

describe("prononciation des voix", () => {
  it("prépare le t de peut-être sans changer le texte des sous-titres", () => {
    expect(spokenFrench("Ton prochain client est peut-être déjà là.")).toBe("Ton prochain client est peu-têtre déjà là.");
    expect(spokenFrench("Il peut être là. Peut etre demain. Peut‑être.")).toBe("Il peu-têtre là. peu-têtre demain. peu-têtre.");
    expect(restoreWord("peu-têtre", ["est", "peut-être", "déjà"])).toBe("peut-être");
    expect(restoreWord("peu-têtre.", ["peut", "être."])).toBe("peut être.");
    expect(spokenFrench("Ça peut, être clair.")).toBe("Ça peut, être clair.");
    expect(html(DEMO_MOTION)).not.toContain("peu-têtre");
  });
  it("marque, mot-clé et liaisons obligatoires écrits pour la voix", () => {
    expect(spokenFrench("Envie de découvrir BeeRecos ? Commente CLUB pour recevoir les informations.")).toBe("Envie de découvrir Bi-reu-co ? Commente Cleub pour recevoir les zinformations.");
    expect(spokenFrench("Des outils pour développer ton activité, l’humain au cœur.")).toBe("Des zoutils pour développer ton nactivité, l’humain au cœur.");
    expect(spokenFrench("les héros de la Digitalisation IA")).toBe("les héros de la Digitalisation IA");
  });
  it("les sous-titres retrouvent le mot écrit", () => {
    expect(restoreWord("zinformations", ["les", "informations"])).toBe("informations");
    expect(restoreWord("Cleub", ["CLUB"])).toBe("CLUB");
    expect(restoreWord("Bi-reu-co.", ["BeeRecos."])).toBe("BeeRecos.");
  });
});
