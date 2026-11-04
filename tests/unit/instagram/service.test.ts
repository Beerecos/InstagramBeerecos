import { describe, expect, it } from "vitest";
import { advance, connect, isStudioVideoUrl, refresh, saveDraft, start } from "@/server/instagram/service";
import { memoryStore } from "./fakes";

const USER = "11111111-1111-4111-8111-111111111111";
const SB = "https://wekbmkjvieagmghjanjb.supabase.co";
const VIDEO = `${SB}/storage/v1/object/sign/studio/render.mp4?token=abc`;

const META = { appId: "1144958471333447", appSecret: "secret-app" };
type Page = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } };
const BEERECOS_PAGE: Page = { id: "642079575645383", name: "Beerecos", access_token: "PAGE_TOKEN", instagram_business_account: { id: "17841472645384195", username: "beerecos" } };

/** Faux Meta (graph.facebook.com) : enregistre les appels et répond selon le chemin. */
function fakeInstagram(states: string[] = ["FINISHED"], pages: Page[] = [BEERECOS_PAGE]) {
  const calls: { method: string; path: string; params: Record<string, string> }[] = [];
  let c = 0;
  const f = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/v[\d.]+\//, "");
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    calls.push({ method: init?.method ?? "GET", path, params: { ...Object.fromEntries(url.searchParams), auth } });
    const ok = (d: unknown) => new Response(JSON.stringify(d), { status: 200 });
    if (url.host !== "graph.facebook.com") return new Response("{}", { status: 404 });
    if (path === "oauth/access_token") return ok({ access_token: "LONG_USER", token_type: "bearer" });
    if (path === "me/accounts") return auth.startsWith("Bearer LONG_USER") ? ok({ data: pages }) : new Response(JSON.stringify({ error: { message: "jeton non échangé" } }), { status: 400 });
    if (url.searchParams.get("fields") === "id,username") {
      const page = pages.find((p) => p.instagram_business_account?.id === path);
      return page && auth === `Bearer ${page.access_token}` ? ok(page.instagram_business_account) : new Response(JSON.stringify({ error: { message: "Object does not exist", code: 100 } }), { status: 400 });
    }
    if (path.endsWith("/media")) return ok({ id: `c${++c}` });
    if (path.endsWith("/media_publish")) return ok({ id: "M1" });
    if (url.searchParams.get("fields") === "status_code,status") return ok({ status_code: states.shift() ?? "FINISHED" });
    if (url.searchParams.get("fields") === "permalink") return ok({ permalink: "https://www.instagram.com/p/M1/" });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  return { f, calls };
}

describe("publication Instagram (service)", () => {
  it("parcours unifié : jeton échangé, jeton de la Page gardé, seul le compte renvoyé par Meta est enregistré", async () => {
    const store = memoryStore(null);
    const ig = fakeInstagram();
    const view = await connect({ store, fetch: ig.f, supabaseUrl: SB, meta: META }, USER, "EAAQ" + "x".repeat(40));
    expect(view).toMatchObject({ connected: true, username: "beerecos", expiresAt: null, needsRefresh: false });
    expect(JSON.stringify(view)).not.toMatch(/TOKEN|LONG/);
    expect(store.conn).toMatchObject({ igUserId: "17841472645384195", username: "beerecos", accessToken: "PAGE_TOKEN" });
    expect(ig.calls.find((c) => c.path === "oauth/access_token")?.params).toMatchObject({ grant_type: "fb_exchange_token", client_id: META.appId, client_secret: META.appSecret });
    // Vérification quotidienne : relit le compte avec le jeton de Page.
    await expect(refresh({ store, fetch: ig.f, supabaseUrl: SB })).resolves.toMatchObject({ connected: true, username: "beerecos" });
    await expect(connect({ store, fetch: ig.f, supabaseUrl: SB, meta: META }, USER, "court")).rejects.toThrow(/format/);
  });

  it("refuse de se dire connecté sans compte renvoyé par Meta", async () => {
    const token = "EAAQ" + "x".repeat(40);
    const none = memoryStore(null);
    await expect(connect({ store: none, fetch: fakeInstagram(["FINISHED"], []).f, supabaseUrl: SB, meta: META }, USER, token)).rejects.toThrow(/aucune Page/);
    const other: Page = { id: "9", name: "Autre", access_token: "P2", instagram_business_account: { id: "1784999", username: "autre" } };
    await expect(connect({ store: none, fetch: fakeInstagram(["FINISHED"], [BEERECOS_PAGE, other]).f, supabaseUrl: SB, meta: META }, USER, token)).rejects.toThrow(/Plusieurs comptes.*beerecos, autre/);
    expect(none.conn).toBeNull();
  });

  it("sans clé secrète sur le serveur : utilise le jeton déjà prolongé tel quel, sans échange", async () => {
    const store = memoryStore(null);
    const ig = fakeInstagram();
    const view = await connect({ store, fetch: ig.f, supabaseUrl: SB }, USER, "LONG_USER" + "x".repeat(30));
    expect(view).toMatchObject({ connected: true, username: "beerecos" });
    expect(ig.calls.some((c) => c.path === "oauth/access_token")).toBe(false);
    expect(store.conn?.accessToken).toBe("PAGE_TOKEN");
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
