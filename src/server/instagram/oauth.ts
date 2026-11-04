import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STATE_COOKIE = "ibr_ig_oauth";
export const CALLBACK_PATH = "/api/instagram/callback";
export function oauthConfig() {
  return { appId: process.env.IG_APP_ID || "", configId: process.env.IG_CONFIG_ID || "", secret: process.env.IG_APP_SECRET || "", redirectUri: process.env.IG_REDIRECT_URI || "" };
}
export function oauthReady() {
  const c = oauthConfig();
  try { return /^\d+$/.test(c.appId) && /^\d+$/.test(c.configId) && Boolean(c.secret) && new URL(c.redirectUri).protocol === "https:"; } catch { return false; }
}
export function createState(userId: string, secret: string, now = Date.now()) {
  const state = randomBytes(32).toString("hex");
  const payload = Buffer.from(JSON.stringify({ state, userId, expires: now + 600_000 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return { state, cookie: `${payload}.${signature}` };
}
export function validState(cookie: string | undefined, state: string | null, userId: string, secret: string, now = Date.now()) {
  if (!cookie || !state || !secret) return false;
  try {
    const [payload, signature, extra] = cookie.split(".");
    if (extra || !/^[a-f0-9]{64}$/.test(signature)) return false;
    const expected = createHmac("sha256", secret).update(payload).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return false;
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    return d.state === state && d.userId === userId && d.expires > now && d.expires <= now + 600_000;
  } catch { return false; }
}
export function authorizeUrl(state: string) {
  const c = oauthConfig();
  const u = new URL("https://www.facebook.com/dialog/oauth");
  for (const [key, value] of Object.entries({ client_id: c.appId, config_id: c.configId, redirect_uri: c.redirectUri, response_type: "code", prompt: "login", state })) u.searchParams.set(key, value);
  return u.toString();
}
export async function exchangeCode(code: string, fetcher: typeof fetch = fetch) {
  const c = oauthConfig();
  const u = new URL("https://graph.facebook.com/v26.0/oauth/access_token");
  for (const [key, value] of Object.entries({ client_id: c.appId, client_secret: c.secret, redirect_uri: c.redirectUri, code })) u.searchParams.set(key, value);
  // Server-to-server only. Never log this URL, the response or network exceptions.
  const r = await fetcher(u, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const d = await r.json();
  if (!r.ok || typeof d?.access_token !== "string") throw new Error("Échange Meta refusé.");
  return d.access_token as string;
}
