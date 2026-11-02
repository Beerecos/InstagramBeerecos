import { describe, expect, it } from "vitest";
import { createOnlineRenderer, ONLINE_DEFAULT_VOICE, type OnlineDeps } from "@/lib/social/reel-render-online";
import { renderMode } from "@/lib/social/reel-render-client";
import { DEMO_MOTION, DEMO_STORY, SEQUENCES } from "@/domain/social/reel-story";

function harness(over: Partial<OnlineDeps> = {}) {
  const calls: Record<string, unknown>[] = [];
  const zips: Uint8Array[] = [];
  let clock = 0;
  let polls = 0;
  const deps: OnlineDeps = {
    api: async (body) => {
      calls.push(body);
      if (body.action === "tts") return { duration: await (over.audioDuration??(async()=>1.2))(new Uint8Array()), receiptId: "a".repeat(64), audioBase64: btoa("mp3"), words: String(body.text).split(/\s+/).map((w, i) => ({ text: w, start: i * 0.3, end: i * 0.3 + 0.25 })) };
      if (body.action === "upload-url") return { jobId: "job-1", uploadUrl: "https://stockage.test/up" };
      if (body.action === "submit") return { renderId: "render-1" };
      if (body.action === "status") return ++polls < 2 ? { state: "running" } : { state: "done", narrationVerified: true, url: "https://stockage.test/video.mp4", size: 42 };
      throw new Error("action inattendue");
    },
    loadAsset: async (path) => new TextEncoder().encode(`asset:${path}`),
    upload: async (_url, zip) => { zips.push(zip); },
    audioDuration: async () => 1.2,
    objectUrl: () => "blob:local",
    now: () => (clock += 6000),
    ...over,
  };
  return { deps, calls, zips };
}

const until = async (get: () => Promise<{ state: string }>, n = 20) => {
  for (let i = 0; i < n; i++) { const j = await get(); if (j.state === "done" || j.state === "error") return j; await new Promise((r) => setTimeout(r, 5)); }
  throw new Error("rendu jamais terminé");
};

describe("rendu en ligne (sans poste de rendu)", () => {
  it("style Motion : une voix HeyGen par scène, prononciation appliquée, ZIP complet, MP4 revenu par URL signée", async () => {
    const { deps, calls, zips } = harness();
    const r = createOnlineRenderer(deps);
    const { id } = r.start(DEMO_MOTION);
    const job = await until(() => r.get(id)) as Awaited<ReturnType<typeof r.get>>;
    expect(job.state).toBe("done");
    expect(job.url).toBe("https://stockage.test/video.mp4");
    expect(job.extras?.srtUrl).toBe("blob:local");
    const tts = calls.filter((c) => c.action === "tts");
    expect(tts).toHaveLength(DEMO_MOTION.scenes.length);
    expect(tts.every((c) => c.speed === 0.92)).toBe(true);
    expect(tts.some((c) => String(c.text).includes("peu-têtre"))).toBe(true);
    expect(tts.some((c) => String(c.text).includes("Bi-reu-co"))).toBe(true);
    expect(Object.keys(job.motionVoice ?? {})).toEqual(DEMO_MOTION.scenes.map((s) => s.id));
    // Les mots reviennent à leur graphie écrite pour les sous-titres.
    expect(job.motionVoice?.s3.words.map((w) => w.text).join(" ")).toContain("BeeRecos");
    const zip = new TextDecoder("latin1").decode(zips[0]);
    for (const f of ["index.html", "bande-son.wav", "voix/s1.mp3", "brand/beerecos-mascotte.webp"]) expect(zip).toContain(f);
    expect(job.warnings.join(" ")).toContain("-14 LUFS");
  });

  it("style Recommandation : une phrase trop longue ne déclenche ni accélération ni rendu tronqué", async () => {
    const { deps, calls } = harness({ audioDuration: async () => 60 });
    const r = createOnlineRenderer(deps);
    const { id } = r.start(DEMO_STORY);
    const job = await until(() => r.get(id));
    expect(job).toMatchObject({ state: "error", error: expect.stringContaining("allonge la séquence") });
    const tts = calls.filter((c) => c.action === "tts");
    expect(new Set(tts.map((c) => c.voiceId))).toEqual(new Set([ONLINE_DEFAULT_VOICE]));
    expect(tts).toHaveLength(1);
    expect(tts[0].speed).toBe(0.92);
    expect(calls.some((c) => ["upload-url", "submit"].includes(String(c.action)))).toBe(false);
  });

  it("style Recommandation : Audrey garde le débit posé pour les phrases qui tiennent dans leur séquence", async () => {
    const { deps, calls } = harness({ audioDuration: async () => 0.8 });
    const r = createOnlineRenderer(deps);
    const { id } = r.start(DEMO_STORY);
    expect((await until(() => r.get(id))).state).toBe("done");
    const tts = calls.filter((c) => c.action === "tts");
    expect(tts).toHaveLength(SEQUENCES.filter((k) => DEMO_STORY.voice.lines[k]?.trim()).length);
    expect(tts.every((c) => c.speed === 0.92)).toBe(true);
  });

  it("une spec invalide est refusée avant tout appel ; une erreur du serveur s'affiche", async () => {
    const { deps, calls } = harness();
    expect(() => createOnlineRenderer(deps).start({ kind: "motion", scenes: [] })).toThrow("La vidéo ne peut pas être générée.");
    expect(calls).toHaveLength(0);
    const failing = createOnlineRenderer({ ...deps, api: async () => { throw new Error("Voix en ligne indisponible : ajoutez le secret HEYGEN_API_KEY aux fonctions Supabase."); } });
    const { id } = failing.start(DEMO_MOTION);
    const job = await until(() => failing.get(id));
    expect(job).toMatchObject({ state: "error", error: expect.stringContaining("HEYGEN_API_KEY") });
  });
});

describe("Audrey enforcement in online AI rendering", () => {
  it("normalizes legacy voices and reports the actual generated identity", async () => {
    const { deps, calls } = harness(); const legacy = structuredClone(DEMO_MOTION);
    legacy.voice.provider = "kokoro"; legacy.voice.voiceId = "ff_siwis";
    const renderer = createOnlineRenderer(deps); const { id } = renderer.start(legacy);
    const job = await until(() => renderer.get(id)) as Awaited<ReturnType<typeof renderer.get>>;
    expect(calls.filter(c => c.action === "tts").every(c => c.voiceId === ONLINE_DEFAULT_VOICE)).toBe(true);
    expect(Object.values(job.motionVoice ?? {}).every(a => a.voiceId === ONLINE_DEFAULT_VOICE && a.speed === .92 && !!a.pronunciationVersion)).toBe(true);
  });
  it("refuses a silent Story and unverified server completion", async () => {
    const { deps, calls } = harness(); const story = structuredClone(DEMO_STORY);
    SEQUENCES.forEach(k => { story.voice.lines[k] = ""; });
    expect(() => createOnlineRenderer(deps).start(story)).toThrow(/narration/i); expect(calls).toHaveLength(0);
    const api = deps.api; deps.api = async body => body.action === "status" ? {state:"done",url:"music-only.mp4"} : api(body);
    const renderer = createOnlineRenderer(deps); const {id} = renderer.start(DEMO_MOTION);
    expect(await until(() => renderer.get(id))).toMatchObject({state:"error",error:expect.stringMatching(/non vérifiée/)});
  });
});

describe("choix du mode de rendu", () => {
  it("local en développement ou avec un serveur de rendu, en ligne sinon ; forçable", () => {
    expect(renderMode({ DEV: true })).toBe("local");
    expect(renderMode({ DEV: false, NEXT_PUBLIC_REEL_RENDER_URL: "https://rendu.test" })).toBe("local");
    expect(renderMode({ DEV: false })).toBe("online");
    expect(renderMode({ DEV: true, NEXT_PUBLIC_REEL_RENDER_MODE: "online" })).toBe("online");
    expect(renderMode({ DEV: false, NEXT_PUBLIC_REEL_RENDER_MODE: "local" })).toBe("local");
  });
});
