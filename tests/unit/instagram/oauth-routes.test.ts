vi.mock("@/server/instagram/diagnostic", () => ({ diagnoseMetaAccess: vi.fn() }));
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ permission: vi.fn(), exchange: vi.fn(), connect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ requirePermission: mocks.permission, ForbiddenError: class extends Error {} }));
vi.mock("@/lib/env/server", () => ({ serverEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "test" }) }));
vi.mock("@/server/instagram/store", () => ({ supabaseStore: () => ({}) }));
vi.mock("@/server/instagram/service", () => ({ connect: mocks.connect }));
vi.mock("@/server/instagram/oauth", async (original) => ({ ...await original<object>(), exchangeCode: mocks.exchange }));
import { GET as start } from "@/app/api/instagram/connect/route";
import { GET as callback } from "@/app/api/instagram/callback/route";
import { createState, STATE_COOKIE } from "@/server/instagram/oauth";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IG_APP_ID", "123"); vi.stubEnv("IG_CONFIG_ID", "456");
  vi.stubEnv("IG_APP_SECRET", "test-secret"); vi.stubEnv("IG_REDIRECT_URI", "https://example.com/api/instagram/callback");
  mocks.permission.mockResolvedValue({id:"admin", demo:false});
  mocks.exchange.mockResolvedValue("private-token"); mocks.connect.mockResolvedValue({connected:true});
});
afterEach(() => vi.unstubAllEnvs());
function request(state: string, cookie: string, suffix = "&code=code") {
  return new NextRequest(`https://example.com/api/instagram/callback?state=${state}${suffix}`, {headers:{cookie:`${STATE_COOKIE}=${cookie}`}});
}
it("ouvre Meta avec un cookie sécurisé sans exposer la clé", async () => {
  const res = await start(new Request("https://example.com/api/instagram/connect"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toContain("https://www.facebook.com/dialog/oauth");
  expect(res.headers.get("location")).not.toContain("test-secret");
  expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/);
  expect(res.headers.get("set-cookie")).toMatch(/Secure/);
  expect(res.headers.get("set-cookie")).toMatch(/SameSite=lax/);
});
it("refuse la preview et la démo", async () => {
  expect((await start(new Request("https://preview.example.com/api/instagram/connect"))).status).toBe(400);
  mocks.permission.mockResolvedValue({id:"admin", demo:true});
  expect((await start(new Request("https://example.com/api/instagram/connect"))).headers.get("location")).toContain("configuration");
});
it("rejette un retour falsifié avant tout échange", async () => {
  const s = createState("admin", "test-secret");
  const res = await callback(request("wrong", s.cookie));
  expect(res.headers.get("location")).toContain("instagram=expire");
  expect(mocks.exchange).not.toHaveBeenCalled();
});
it("gère une annulation sans modifier la connexion", async () => {
  const s = createState("admin", "test-secret");
  const res = await callback(request(s.state, s.cookie, "&error=access_denied"));
  expect(res.headers.get("location")).toContain("instagram=annule");
  expect(mocks.connect).not.toHaveBeenCalled();
});
it("enregistre le compte vérifié et efface le cookie, sans retour de jeton", async () => {
  const s = createState("admin", "test-secret");
  const res = await callback(request(s.state, s.cookie));
  expect(mocks.connect).toHaveBeenCalledWith(expect.any(Object), "admin", "private-token");
  expect(res.headers.get("location")).toBe("https://example.com/settings?instagram=ok#instagram");
  expect(res.cookies.get(STATE_COOKIE)?.value).toBe("");
  expect(JSON.stringify([...res.headers])).not.toContain("private-token");
});
it("ne divulgue jamais le contenu des erreurs du fournisseur", async () => {
  const s = createState("admin", "test-secret");
  mocks.exchange.mockRejectedValue(new Error("private-secret-token"));
  const res = await callback(request(s.state, s.cookie));
  expect(res.headers.get("location")).toContain("instagram=erreur");
  expect(JSON.stringify([...res.headers])).not.toContain("private-secret-token");
  expect(mocks.connect).not.toHaveBeenCalled();
});
