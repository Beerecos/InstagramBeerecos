import { afterEach, expect, it, vi } from "vitest";
import { authorizeUrl, createState, exchangeCode, oauthReady, validState } from "@/server/instagram/oauth";
afterEach(() => vi.unstubAllEnvs());
function config() {
  vi.stubEnv("IG_APP_ID", "123"); vi.stubEnv("IG_CONFIG_ID", "456");
  vi.stubEnv("IG_APP_SECRET", "test-secret");
  vi.stubEnv("IG_REDIRECT_URI", "https://example.com/api/instagram/callback");
}
it("lie la connexion à la session, à son état signé et à dix minutes", () => {
  const { state, cookie } = createState("admin", "test-secret", 1000);
  expect(validState(cookie, state, "admin", "test-secret", 1001)).toBe(true);
  expect(validState(cookie, state, "other-admin", "test-secret", 1001)).toBe(false);
  expect(validState(cookie, "attacker", "admin", "test-secret", 1001)).toBe(false);
  expect(validState(cookie + "tampered", state, "admin", "test-secret", 1001)).toBe(false);
  expect(validState(cookie, state, "admin", "different-secret", 1001)).toBe(false);
  expect(validState(cookie, state, "admin", "test-secret", 601000)).toBe(false);
  expect(validState(undefined, state, "admin", "test-secret", 1001)).toBe(false);
});
it("envoie uniquement la configuration publique à Meta et impose la configuration serveur", () => {
  config(); expect(oauthReady()).toBe(true);
  const url = new URL(authorizeUrl("state"));
  expect(url.origin).toBe("https://www.facebook.com");
  expect(url.searchParams.get("config_id")).toBe("456");
  expect(url.searchParams.get("redirect_uri")).toBe("https://example.com/api/instagram/callback");
  expect(url.searchParams.get("prompt")).toBe("login");
  expect(url.toString()).not.toContain("test-secret");
  vi.stubEnv("IG_APP_SECRET", ""); expect(oauthReady()).toBe(false);
});
it("échange le code côté serveur et ne répercute pas les erreurs sensibles de Meta", async () => {
  config();
  const mock = vi.fn(async (input: URL | RequestInfo) => {
    const u = new URL(String(input));
    expect(u.origin).toBe("https://graph.facebook.com");
    expect(u.searchParams.get("redirect_uri")).toBe("https://example.com/api/instagram/callback");
    return new Response(JSON.stringify({access_token: "private-test-token"}));
  });
  await expect(exchangeCode("one-time-code", mock as typeof fetch)).resolves.toBe("private-test-token");
  await expect(exchangeCode("code", (async () => new Response(JSON.stringify({ error: { message: "private-test-token" } }), { status: 400 })) as typeof fetch)).rejects.toThrow("Échange Meta refusé.");
});
