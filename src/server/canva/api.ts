/**
 * Client de l'API officielle Canva Connect (vérifiée sur canva.dev le 2026-11-09) : OAuth avec PKCE, capacités du compte,
 * modèles de marque, remplissage automatique (autofill), export JPG. Aucun secret ici : identifiants et jetons sont passés
 * par le serveur. Les travaux Canva sont asynchrones : création, puis lecture jusqu'à « success » ou « failed ».
 */
export const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const API = "https://api.canva.com/rest/v1";
/** Droits demandés : uniquement ce que le Studio utilise (lister et lire les modèles, créer et exporter un design). */
export const SCOPES = ["profile:read", "brandtemplate:meta:read", "brandtemplate:content:read", "design:meta:read", "design:content:read", "design:content:write"] as const;

export class CanvaError extends Error {
  constructor(message: string, readonly status = 502, readonly code?: string) { super(message); this.name = "CanvaError"; }
}

type F = typeof fetch;
const b64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Vérificateur PKCE (43 à 128 caractères autorisés) et son empreinte SHA-256. */
export async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

export function authorizeUrl(o: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", o.clientId);
  u.searchParams.set("redirect_uri", o.redirectUri);
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("code_challenge", o.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", o.state);
  return u.toString();
}

export type Tokens = { accessToken: string; refreshToken: string; expiresAt: string; scopes: string[] };

async function tokenRequest(f: F, o: { clientId: string; clientSecret: string }, params: Record<string, string>): Promise<Tokens> {
  const res = await f(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${o.clientId}:${o.clientSecret}`).toString("base64")}` },
    body: new URLSearchParams(params).toString(), cache: "no-store",
  });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string; message?: string };
  if (!res.ok || !d.access_token || !d.refresh_token) throw new CanvaError(`Connexion Canva refusée : ${d.error_description ?? d.message ?? d.error ?? `HTTP ${res.status}`}`, res.status === 400 || res.status === 401 ? 401 : 502, d.error);
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: new Date(Date.now() + (d.expires_in ?? 14_400) * 1000).toISOString(), scopes: (d.scope ?? "").split(/\s+/).filter(Boolean) };
}

export const exchangeCode = (f: F, o: { clientId: string; clientSecret: string; code: string; verifier: string; redirectUri: string }) =>
  tokenRequest(f, o, { grant_type: "authorization_code", code: o.code, code_verifier: o.verifier, redirect_uri: o.redirectUri });

/** Jeton renouvelé : Canva n'accepte chaque jeton de renouvellement qu'une fois et en renvoie un nouveau. */
export const refreshTokens = (f: F, o: { clientId: string; clientSecret: string; refreshToken: string }) =>
  tokenRequest(f, o, { grant_type: "refresh_token", refresh_token: o.refreshToken });

async function call<T>(f: F, token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await f(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) }, cache: "no-store" });
  const d = (await res.json().catch(() => ({}))) as T & { code?: string; message?: string };
  if (!res.ok) {
    const code = (d as { code?: string }).code;
    const msg = res.status === 401 ? "Connexion Canva expirée : reconnecte Canva dans Paramètres."
      : res.status === 403 ? "Canva refuse l'accès : ce compte n'a pas accès aux modèles de marque ou au remplissage automatique (Canva Pro, Teams ou Enterprise)."
      : res.status === 429 ? "Limite de Canva atteinte : réessaie dans une minute."
      : `Canva : ${(d as { message?: string }).message ?? `HTTP ${res.status}`}`;
    throw new CanvaError(msg, res.status === 401 ? 401 : res.status === 403 ? 403 : res.status === 429 ? 429 : 502, code);
  }
  return d;
}

export async function capabilities(f: F, token: string): Promise<string[]> {
  return (await call<{ capabilities?: string[] }>(f, token, "/users/me/capabilities")).capabilities ?? [];
}

/** editUrl : ouverture du modèle dans Canva (seul endroit où sa mise en page se modifie ; l'API ne le permet pas). */
export type BrandTemplate = { id: string; title: string; thumbnailUrl: string | null; editUrl: string | null };
export async function listBrandTemplates(f: F, token: string, query = ""): Promise<BrandTemplate[]> {
  const q = new URLSearchParams({ dataset: "non_empty", limit: "50", sort_by: "modified_descending" });
  if (query.trim()) q.set("query", query.trim().slice(0, 100));
  const d = await call<{ items?: { id: string; title?: string; view_url?: string; thumbnail?: { url?: string } }[] }>(f, token, `/brand-templates?${q}`);
  return (d.items ?? []).map((t) => ({ id: t.id, title: t.title ?? "Sans titre", thumbnailUrl: t.thumbnail?.url ?? null, editUrl: canvaUrl(t.view_url) }));
}

/** Lien Canva accepté seulement s'il pointe vers canva.com en https (jamais une adresse arbitraire dans l'interface). */
export function canvaUrl(u: string | undefined | null): string | null {
  try { const x = new URL(u ?? ""); return x.protocol === "https:" && (x.hostname === "www.canva.com" || x.hostname === "canva.com") ? x.toString() : null; } catch { return null; }
}

export type DatasetField = { name: string; type: "text" | "image" | "chart" | "sheet" };
export async function templateDataset(f: F, token: string, templateId: string): Promise<DatasetField[]> {
  if (!/^[\w-]{3,64}$/.test(templateId)) throw new CanvaError("Modèle Canva invalide.", 400);
  const d = await call<{ dataset?: Record<string, { type: DatasetField["type"] }> }>(f, token, `/brand-templates/${templateId}/dataset`);
  return Object.entries(d.dataset ?? {}).map(([name, v]) => ({ name, type: v.type }));
}

type Job<R> = { job: { id: string; status: "in_progress" | "success" | "failed"; error?: { code?: string; message?: string } } & R };

/** Lit un travail Canva jusqu'à son issue (délai borné : jamais d'attente infinie). */
async function poll<R>(read: () => Promise<Job<R>>, o: { intervalMs: number; timeoutMs: number; sleep: (ms: number) => Promise<void>; what: string }): Promise<Job<R>["job"]> {
  const until = Date.now() + o.timeoutMs;
  for (;;) {
    const { job } = await read();
    if (job.status === "success") return job;
    if (job.status === "failed") throw new CanvaError(`${o.what} échoué côté Canva : ${job.error?.message ?? job.error?.code ?? "raison non fournie"}.`, 502, job.error?.code);
    if (Date.now() + o.intervalMs > until) throw new CanvaError(`${o.what} trop long côté Canva : réessaie dans un instant.`, 504);
    await o.sleep(o.intervalMs);
  }
}

export type PollOpts = { intervalMs?: number; timeoutMs?: number; sleep?: (ms: number) => Promise<void> };
const defaults = (p: PollOpts) => ({ intervalMs: p.intervalMs ?? 1500, timeoutMs: p.timeoutMs ?? 45_000, sleep: p.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))) });

/** Crée un design à partir d'un modèle de marque, champs texte remplis. Renvoie l'identifiant et le lien d'édition. */
export async function autofill(f: F, token: string, o: { templateId: string; title: string; texts: Record<string, string> } & PollOpts): Promise<{ designId: string; editUrl: string | null }> {
  const data = Object.fromEntries(Object.entries(o.texts).map(([k, text]) => [k, { type: "text", text }]));
  const created = await call<Job<object>>(f, token, "/autofills", { method: "POST", body: JSON.stringify({ brand_template_id: o.templateId, title: o.title.slice(0, 255), data }) });
  const job = await poll<{ result?: { design?: { id: string; urls?: { edit_url?: string } } } }>(
    () => (created.job.status === "in_progress" ? call(f, token, `/autofills/${created.job.id}`) : Promise.resolve(created as never)),
    { ...defaults(o), what: "Remplissage du modèle" },
  );
  const design = job.result?.design;
  if (!design?.id) throw new CanvaError("Canva n'a pas renvoyé de design.", 502);
  return { designId: design.id, editUrl: design.urls?.edit_url ?? null };
}

/** Export JPG du design (une adresse par page, valable 24 h). */
export async function exportJpg(f: F, token: string, o: { designId: string; quality?: number } & PollOpts): Promise<string[]> {
  const created = await call<Job<object>>(f, token, "/exports", { method: "POST", body: JSON.stringify({ design_id: o.designId, format: { type: "jpg", quality: o.quality ?? 90 } }) });
  const job = await poll<{ urls?: string[] }>(
    () => (created.job.status === "in_progress" ? call(f, token, `/exports/${created.job.id}`) : Promise.resolve(created as never)),
    { ...defaults(o), what: "Export du visuel" },
  );
  if (!job.urls?.length) throw new CanvaError("Canva n'a renvoyé aucune image.", 502);
  return job.urls;
}
