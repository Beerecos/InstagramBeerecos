import { describe, expect, it } from "vitest";
import { buildReelComposition, DEMO_REEL, LOGO_WIDTH, escapeHtml, fitFontSize, reelDuration, ReelSpecSchema, type ReelSpec } from "@/domain/video/reel";
import { MISSION_TEMPLATES } from "@/domain/missions/templates";
import type { AIProvider } from "@/providers/ai/types";
import { advanceMission } from "@/server/missions/engine";
import { MemoryMissionStore } from "@/server/missions/memory-store";

const html = (spec: ReelSpec = DEMO_REEL, preview = false) => buildReelComposition(spec, { assetBase: "https://app.test/hyperframes/", preview });

describe("Reel motion design (Hyperframes)", () => {
  it("respecte le contrat Hyperframes : racine 1080×1920, durée totale, une scène par clip, timeline enregistrée", () => {
    const out = html();
    expect(out).toContain('data-composition-id="main"');
    expect(out).toContain('data-width="1080" data-height="1920"');
    expect(out).toContain(`data-duration="${reelDuration(DEMO_REEL)}"`);
    expect(out.match(/class="clip scene/g)).toHaveLength(DEMO_REEL.scenes.length);
    expect(out).toContain('window.__timelines["main"] = tl;');
    expect(out).toContain('gsap.timeline({ paused: true })');
    // Clips consécutifs : chaque scène commence à la fin de la précédente.
    expect(out).toContain('data-start="3" data-duration="4.5"');
    expect(out).toContain('data-start="7.5" data-duration="5"');
  });

  it("n'utilise que des ressources de l'application (aucun CDN) ; le runtime n'est inclus qu'en aperçu", () => {
    expect(html()).not.toMatch(/cdn\.|jsdelivr|unpkg|googleapis/);
    expect(html()).toContain("https://app.test/hyperframes/gsap-3.14.2.min.js");
    expect(html()).not.toContain("hyperframe.runtime");
    expect(html(DEMO_REEL, true)).toContain("https://app.test/hyperframes/hyperframe.runtime-0.8.126.iife.js");
  });

  it("termine sur le logo officiel BeeRecos, à au moins 150 px de large (brandguide)", () => {
    const out = html();
    expect(out).toContain('src="https://app.test/hyperframes/brand/beerecos-logo-white.svg"');
    expect(LOGO_WIDTH).toBeGreaterThanOrEqual(150);
    expect(out).not.toMatch(/beerecos-logo[^"]*"[^>]*style="[^"]*(rotate|skew|scale)/);
  });

  it("échappe tout texte : aucune balise ni script ne peut être injecté", () => {
    const evil: ReelSpec = { ...DEMO_REEL, title: '</title><script>alert(1)</script>', scenes: [{ kind: "hook", text: '<img src=x onerror="alert(1)">', duration: 2 }, { kind: "cta", text: "Commente CLUB", duration: 2 }] };
    const out = html(evil);
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  });

  it("refuse un Reel hors règles : hook d'abord, CTA en dernier, 60 s max, mot-clé valide", () => {
    const base = DEMO_REEL;
    expect(ReelSpecSchema.safeParse({ ...base, scenes: [...base.scenes].reverse() }).success).toBe(false);
    expect(ReelSpecSchema.safeParse({ ...base, scenes: [base.scenes[0], ...Array(8).fill({ kind: "statement", text: "x", duration: 8 }), base.scenes[3]] }).success).toBe(false);
    expect(ReelSpecSchema.safeParse({ ...base, ctaKeyword: "club x" }).success).toBe(false);
    expect(ReelSpecSchema.safeParse({ ...base, scenes: [{ ...base.scenes[0], duration: 0.5 }, base.scenes[3]] }).success).toBe(false);
    expect(ReelSpecSchema.safeParse(base).success).toBe(true);
  });

  it("aucun mot ne déborde des marges de sécurité", () => {
    const size = fitFontSize("Une recommandation, ça vaut combien ?", 112, 0.66);
    expect("recommandation,".length * 0.66 * size).toBeLessThanOrEqual(1080 - 90 - 170);
    expect(fitFontSize("Court", 112, 0.66)).toBe(112);
  });
});

describe("Réalisateur vidéo — tâche motion design", () => {
  it("produit un livrable motion_reel validé, sans écrire de HTML", async () => {
    const store = new MemoryMissionStore();
    const t = MISSION_TEMPLATES.ai_video;
    const { mission } = await store.createMission({ organizationId: "o", title: t.label, request: "Vidéo IA sur le réseau monétisé", template: "ai_video", objective: t.objective, createdBy: null, tasks: t.tasks });
    const ai: AIProvider = {
      id: "fake",
      displayName: "Fake",
      capabilities: async () => ({ generateText: true, generateStructured: true, webSearch: false, analyzeImage: false, generateImage: false, generateVideo: false, transcribeAudio: false, textToSpeech: false }),
      healthCheck: async () => ({ status: "connected" }),
      generateText: async () => ({ text: "", usage: { provider: "f", model: "f", inputTokens: 0, outputTokens: 0 } }),
      generateStructured: async ({ system }) => ({
        data: (system.includes("motion design") && system.includes("« reel »")
          ? { summary: "Reel prêt", decisions: [], limitations: [], reel: DEMO_REEL }
          : { summary: "ok", decisions: [], limitations: [], deliverables: [{ kind: "script", title: "Script", content: "Hook. CTA : commente CLUB." }] }) as never,
        sources: [],
        usage: { provider: "f", model: "f", inputTokens: 1, outputTokens: 1 },
      }),
    };
    await advanceMission(mission.id, { store, ai, capabilities: new Set(["llm", "web_search"]) });
    // Le script attend une validation : on la simule pour laisser avancer l'équipe.
    const script = (await store.getMission(mission.id))!.tasks.find((x) => x.key === "script")!;
    await store.updateTask(script.id, { status: "validated" });
    await advanceMission(mission.id, { store, ai, capabilities: new Set(["llm", "web_search"]) });
    const motion = (await store.getMission(mission.id))!.tasks.find((x) => x.key === "motion")!;
    expect(motion.status).toBe("to_validate");
    const d = motion.output!.deliverables[0];
    expect(d.kind).toBe("motion_reel");
    expect(ReelSpecSchema.parse(JSON.parse(d.content))).toEqual(DEMO_REEL);
  });
});
