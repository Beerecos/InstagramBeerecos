import { describe, expect, it } from "vitest";
import { advance, connect, isStudioVideoUrl, saveDraft, start } from "@/server/instagram/service";
import { memoryStore } from "./fakes";

const USER = "11111111-1111-4111-8111-111111111111";
const SB = "https://wekbmkjvieagmghjanjb.supabase.co";
const VIDEO = `${SB}/storage/v1/object/sign/studio/render.mp4?token=abc`;

/** Faux Instagram : enregistre les appels et répond selon le chemin. */
function fakeInstagram(states: string[] = ["FINISHED"]) {
  const calls: { method: string; path: string; params: Record<string, string> }[] = [];
  let c = 0;
  const f = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/v[\d.]+\//, "");
    calls.push({ method: init?.method ?? "GET", path, params: Object.fromEntries(url.searchParams) });
    const ok = (d: unknown) => new Response(JSON.stringify(d), { status: 200 });
    if (path === "me") return ok({ user_id: "1784", username: "beerecos" });
    if (url.pathname === "/refresh_access_token") return ok({ access_token: "LONG", expires_in: 5184000 });
    if (path.endsWith("/media")) return ok({ id: `c${++c}` });
    if (path.endsWith("/media_publish")) return ok({ id: "M1" });
    if (url.searchParams.get("fields") === "status_code,status") return ok({ status_code: states.shift() ?? "FINISHED" });
    if (url.searchParams.get("fields") === "permalink") return ok({ permalink: "https://www.instagram.com/p/M1/" });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  return { f, calls };
}

describe("publication Instagram (service)", () => {
  it("connecte un compte réel et prolonge le jeton, sans jamais renvoyer le jeton", async () => {
    const store = memoryStore(null);
    const ig = fakeInstagram();
    const view = await connect({ store, fetch: ig.f, supabaseUrl: SB }, USER, "IGAAT" + "x".repeat(40));
    expect(view).toMatchObject({ connected: true, username: "beerecos" });
    expect(JSON.stringify(view)).not.toContain("LONG");
    expect(store.conn?.accessToken).toBe("LONG");
    await expect(connect({ store, fetch: ig.f, supabaseUrl: SB }, USER, "court")).rejects.toThrow(/format/);
  });

  it("publie un post photo, puis crée la règle de DM du mot-clé", async () => {
    const store = memoryStore();
    const ig = fakeInstagram(["IN_PROGRESS", "FINISHED"]);
    const deps = { store, fetch: ig.f, supabaseUrl: SB };
    const draft = await saveDraft(deps, USER, { kind: "post", title: "Club", caption: "Commente CLUB", media: [{ path: `${USER}/a.jpg`, type: "image" }], keyword: "club", dmText: "Le lien", buttonTitle: "Voir", buttonUrl: "https://beerecos.com" });
    const started = await start(deps, USER, draft.id);
    expect(started.status).toBe("publishing");
    expect(ig.calls.find((c) => c.path === "1784/media")?.params.image_url).toContain("/ig-media/");
    expect((await advance(deps, USER, draft.id)).status).toBe("publishing"); // Instagram traite encore
    const done = await advance(deps, USER, draft.id);
    expect(done).toMatchObject({ status: "published", permalink: "https://www.instagram.com/p/M1/" });
    expect(store.rules).toEqual([expect.objectContaining({ mediaId: "M1", keyword: "CLUB", dmText: "Le lien", buttonUrl: "https://beerecos.com" })]);
    // Une seule publication, même si l'on consulte encore.
    await advance(deps, USER, draft.id);
    expect(ig.calls.filter((c) => c.path.endsWith("media_publish"))).toHaveLength(1);
  });

  it("un carrousel crée une photo par élément puis le conteneur CAROUSEL", async () => {
    const store = memoryStore();
    const ig = fakeInstagram();
    const deps = { store, fetch: ig.f, supabaseUrl: SB };
    const d = await saveDraft(deps, USER, { kind: "post", caption: "Trois photos", media: [1, 2, 3].map((i) => ({ path: `${USER}/${i}.jpg`, type: "image" as const })) });
    await start(deps, USER, d.id);
    const creates = ig.calls.filter((c) => c.path === "1784/media");
    expect(creates).toHaveLength(4);
    expect(creates[3].params).toMatchObject({ media_type: "CAROUSEL", children: "c1,c2,c3" });
  });

  it("un réel exige le MP4 signé du Studio, jamais une URL arbitraire", async () => {
    const store = memoryStore();
    const ig = fakeInstagram();
    const deps = { store, fetch: ig.f, supabaseUrl: SB };
    const d = await saveDraft(deps, USER, { kind: "reel", montageId: "m1", caption: "Mon réel" });
    await expect(start(deps, USER, d.id, { videoUrl: "https://evil.example/v.mp4" })).rejects.toThrow(/MP4/);
    expect(isStudioVideoUrl(VIDEO, SB)).toBe(true);
    const s = await start(deps, USER, d.id, { videoUrl: VIDEO });
    expect(ig.calls.find((c) => c.path === "1784/media")?.params).toMatchObject({ media_type: "REELS", video_url: VIDEO });
    expect(s.status).toBe("publishing");
  });

  it("refuse de publier sans connexion, deux fois, ou une photo d'un autre", async () => {
    const deps = { store: memoryStore(null), fetch: fakeInstagram().f, supabaseUrl: SB };
    const d = await saveDraft(deps, USER, { kind: "post", caption: "x", media: [{ path: `${USER}/a.jpg`, type: "image" }] });
    await expect(start(deps, USER, d.id)).rejects.toThrow(/pas connecté/);
    await expect(saveDraft(deps, USER, { kind: "post", media: [{ path: "autre/a.jpg", type: "image" }] })).rejects.toThrow(/Photo inconnue/);
    const ok = { store: memoryStore(), fetch: fakeInstagram().f, supabaseUrl: SB };
    const p = await saveDraft(ok, USER, { kind: "post", caption: "x", media: [{ path: `${USER}/a.jpg`, type: "image" }] });
    await start(ok, USER, p.id);
    await expect(start(ok, USER, p.id)).rejects.toThrow(/déjà en cours|relancé/);
  });

  it("un refus d'Instagram passe en échec lisible et peut être relancé", async () => {
    const store = memoryStore();
    const deps = { store, fetch: fakeInstagram(["ERROR"]).f, supabaseUrl: SB };
    const d = await saveDraft(deps, USER, { kind: "post", caption: "x", media: [{ path: `${USER}/a.jpg`, type: "image" }] });
    await start(deps, USER, d.id);
    const failed = await advance(deps, USER, d.id);
    expect(failed.status).toBe("error");
    expect(failed.error).toMatch(/refusé/);
    expect((await start(deps, USER, d.id)).status).toBe("publishing");
  });
});
