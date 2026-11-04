import { afterEach, describe, expect, it, vi } from "vitest";
import { connect, refresh, start, saveDraft, advance } from "@/server/instagram/service";
import { graphHost, me } from "@/server/instagram/graph";
import { memoryStore } from "./fakes";

afterEach(() => vi.unstubAllEnvs());
const token = "EAA" + "x".repeat(700);
const user = "11111111-1111-4111-8111-111111111111";
function setup() {
  vi.stubEnv("IG_USERNAME", ""); vi.stubEnv("IG_LOGIN_MODE", "unified"); vi.stubEnv("IG_USER_ID", "1784");
  const calls: string[] = [];
  const f = vi.fn(async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    expect(url.hostname).toBe("graph.facebook.com");
    expect(url.searchParams.has("access_token")).toBe(false);
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${token}`);
    const d = url.pathname.endsWith("/me/assigned_instagram_accounts") ? { data: [{ id: "1784", username: "beerecos" }] }
      : url.pathname.endsWith("/media") ? { id: "container" }
      : url.pathname.endsWith("/container") ? { status_code: "FINISHED" }
      : url.pathname.endsWith("/media_publish") ? { id: "post" } : { permalink: "https://instagram.com/p/post" };
    return new Response(JSON.stringify(d));
  }) as unknown as typeof fetch;
  const store = memoryStore(null);
  return { store, fetch: f, supabaseUrl: "https://example.supabase.co", calls };
}
describe("Unified Login", () => {
  it("connecte un long jeton système via les comptes assignés sans renouvellement Instagram, puis publie sur le même hôte", async () => {
    const deps = setup();
    const result = await connect(deps, user, token);
    expect(result).toMatchObject({ connected: true, username: "beerecos", renewal: "meta" });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(deps.store.conn?.accessToken).toBe(token);
    const draft = await saveDraft(deps, user, { kind: "post", title: "Test", caption: "Test", media: [{ type: "image", path: `${user}/test.jpg` }] });
    await start(deps, user, draft.id);
    expect((await advance(deps, user, draft.id)).status).toBe("published");
    expect(deps.calls.some(p => /\/me$|refresh_access_token/.test(p))).toBe(false);
    const before = deps.calls.length;
    await expect(refresh(deps, user)).rejects.toThrow(/Meta/);
    expect(deps.calls).toHaveLength(before);
    expect(graphHost()).toBe("graph.facebook.com");
  });
  it("refuse une configuration sans compte explicite avant tout appel", async () => {
    const deps = setup(); vi.stubEnv("IG_USER_ID", "");
    await expect(me({ token, fetch: deps.fetch })).rejects.toThrow(/IG_USER_ID/);
    expect(deps.calls).toHaveLength(0);
  });
  it("ne remplace pas la connexion si Meta refuse le jeton", async () => {
    const deps = setup();
    await connect(deps, user, token);
    const previous = deps.store.conn;
    deps.fetch = (async () => new Response(JSON.stringify({ error: { message: "Invalid token", code: 190 } }), { status: 400 })) as typeof fetch;
    await expect(connect(deps, user, "EAA" + "y".repeat(40))).rejects.toThrow(/Invalid token/);
    expect(deps.store.conn).toBe(previous);
  });
});

it("sélectionne le compte par nom et conserve l’identifiant renvoyé par Meta", async () => {
  const deps = setup(); vi.stubEnv("IG_USERNAME", "beerecos");
  vi.stubEnv("IG_USER_ID", "9999");
  await expect(me({ token, fetch: deps.fetch })).resolves.toEqual({ userId: "1784", username: "beerecos" });
});
it("refuse les comptes non attendus", async () => {
  const deps = setup(); vi.stubEnv("IG_USERNAME", "autre_compte");
  await expect(connect(deps, user, token)).rejects.toThrow(/comptes accessibles/);
  expect(deps.store.conn).toBeNull();
});
it("parcourt les pages sans suivre une URL contenant un jeton", async () => {
  setup();
  const f = vi.fn(async (input: URL | string) => {
    const url = new URL(String(input));
    expect(url.hostname).toBe("graph.facebook.com");
    return new Response(JSON.stringify(url.searchParams.get("after") === "page2"
      ? { data: [{ id: "1784", username: "beerecos" }] }
      : { data: [], paging: { next: "https://untrusted.example/", cursors: { after: "page2" } } }));
  });
  await expect(me({ token, fetch: f as typeof fetch })).resolves.toEqual({ userId: "1784", username: "beerecos" });
  expect(f).toHaveBeenCalledTimes(2);
});
