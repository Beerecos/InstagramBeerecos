import { describe, expect, it } from "vitest";
import { authorizeUrl, CanvaError, pkce, SCOPES } from "@/server/canva/api";
import { accessToken, cleanTexts, createVisual, view, type CanvaConnection, type CanvaDeps } from "@/server/canva/service";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const conn = (extra: Partial<CanvaConnection> = {}): CanvaConnection => ({ displayName: "Compte Canva", accessToken: "AT", refreshToken: "RT", expiresAt: new Date(NOW + 3_600_000).toISOString(), scopes: [...SCOPES], capabilities: ["autofill", "brand_template"], ...extra });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Canva simulé : jamais d'appel réseau réel. */
function fakeCanva(over: Partial<Record<string, (init?: RequestInit) => Response>> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const key = Object.keys(over).find((k) => url.includes(k));
    if (key) return over[key]!(init);
    if (url.endsWith("/oauth/token")) return json({ access_token: "AT2", refresh_token: "RT2", expires_in: 14400, scope: SCOPES.join(" ") });
    if (url.includes("/dataset")) return json({ dataset: { Thematique: { type: "text" }, "Texte 1": { type: "text" }, Photo: { type: "image" } } });
    if (url.endsWith("/autofills")) return json({ job: { id: "af1", status: "in_progress" } });
    if (url.includes("/autofills/af1")) return json({ job: { id: "af1", status: "success", result: { type: "create_design", design: { id: "D1", urls: { edit_url: "https://www.canva.com/design/D1/edit" } } } } });
    if (url.endsWith("/exports")) return json({ job: { id: "ex1", status: "in_progress" } });
    if (url.includes("/exports/ex1")) return json({ job: { id: "ex1", status: "success", urls: ["https://export.canva.test/p1.jpg", "https://export.canva.test/p2.jpg"] } });
    if (url.startsWith("https://export.canva.test/")) return new Response(new Uint8Array([0xff, 0xd8, 0xff]));
    return json({ message: "inconnu" }, 404);
  }) as typeof fetch;
  return { f, calls };
}

function deps(c: CanvaConnection | null, f: typeof fetch) {
  let stored = c;
  const uploads: string[] = [];
  const d: CanvaDeps = {
    store: { get: async () => stored, save: async (n) => { stored = n; }, remove: async () => { stored = null; } },
    app: { clientId: "cid", clientSecret: "secret" }, fetch: f, now: () => NOW,
    upload: async (userId) => { const p = `${userId}/img${uploads.length}.jpg`; uploads.push(p); return p; },
    poll: { intervalMs: 1, timeoutMs: 1000, sleep: async () => {} },
  };
  return { d, uploads, stored: () => stored };
}

describe("Canva : connexion officielle (OAuth + PKCE)", () => {
  it("adresse d'autorisation : PKCE S256, état, droits limités à l'usage du Studio", async () => {
    const { verifier, challenge } = await pkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    const u = new URL(authorizeUrl({ clientId: "cid", redirectUri: "https://studio.test/api/canva/callback", state: "s1", challenge }));
    expect(u.origin + u.pathname).toBe("https://www.canva.com/api/oauth/authorize");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ response_type: "code", code_challenge_method: "S256", state: "s1", code_challenge: challenge });
    expect(u.searchParams.get("scope")!.split(" ")).not.toContain("asset:write");
  });

  it("l'état public ne contient jamais de jeton et dit si le remplissage automatique est permis", () => {
    const v = view({ app: { clientId: "cid", clientSecret: "s" } }, conn());
    expect(v).toEqual({ appConfigured: true, connected: true, name: "Compte Canva", autofill: true, brandTemplates: true });
    expect(JSON.stringify(v)).not.toMatch(/AT|RT/);
    expect(view({ app: {} }, null)).toMatchObject({ appConfigured: false, connected: false, autofill: null });
  });

  it("jeton proche de l'expiration : renouvelé une fois, le nouveau jeton de renouvellement est enregistré", async () => {
    const { f, calls } = fakeCanva();
    const { d, stored } = deps(conn({ expiresAt: new Date(NOW + 60_000).toISOString() }), f);
    expect(await accessToken(d)).toBe("AT2");
    expect(stored()?.refreshToken).toBe("RT2");
    expect(calls.filter((c) => c.url.endsWith("/oauth/token"))).toHaveLength(1);
    expect(String(calls[0].init?.body)).toContain("grant_type=refresh_token");
  });

  it("sans connexion : erreur lisible, aucun appel à Canva", async () => {
    const { f, calls } = fakeCanva();
    await expect(accessToken(deps(null, f).d)).rejects.toMatchObject({ status: 409 });
    expect(calls).toHaveLength(0);
  });
});

describe("Canva : créer le visuel d'un post", () => {
  it("remplit le modèle, exporte en JPG, dépose chaque page dans les photos du post", async () => {
    const { f, calls } = fakeCanva();
    const { d, uploads } = deps(conn(), f);
    const r = await createVisual(d, "u1", { templateId: "EAGgsOdRFIY", title: "Post réseau", texts: { Thematique: "Le réseau", "Texte 1": "Un club près de chez toi", Inconnu: "ignoré" } });
    expect(r).toMatchObject({ designId: "D1", editUrl: "https://www.canva.com/design/D1/edit", pages: 2, missing: [] });
    expect(r.paths).toEqual(uploads);
    const body = JSON.parse(String(calls.find((c) => c.url.endsWith("/autofills"))!.init!.body));
    expect(body).toEqual({ brand_template_id: "EAGgsOdRFIY", title: "Post réseau", data: { Thematique: { type: "text", text: "Le réseau" }, "Texte 1": { type: "text", text: "Un club près de chez toi" } } });
    expect(JSON.parse(String(calls.find((c) => c.url.endsWith("/exports"))!.init!.body))).toEqual({ design_id: "D1", format: { type: "jpg", quality: 90 } });
  });

  it("aucun texte rempli : refusé avant tout remplissage", async () => {
    const { f, calls } = fakeCanva();
    await expect(createVisual(deps(conn(), f).d, "u1", { templateId: "EAGgsOdRFIY", title: "x", texts: { Thematique: "  " } })).rejects.toBeInstanceOf(CanvaError);
    expect(calls.some((c) => c.url.endsWith("/autofills"))).toBe(false);
  });

  it("compte sans droit Canva (403) : message honnête, rien n'est déposé", async () => {
    const { f } = fakeCanva({ "/autofills": () => json({ code: "permission_denied", message: "denied" }, 403) });
    const { d, uploads } = deps(conn(), f);
    await expect(createVisual(d, "u1", { templateId: "EAGgsOdRFIY", title: "x", texts: { Thematique: "A" } })).rejects.toMatchObject({ status: 403 });
    expect(uploads).toEqual([]);
  });

  it("export en échec côté Canva : erreur, aucune image déposée", async () => {
    const { f } = fakeCanva({ "/exports/ex1": () => json({ job: { id: "ex1", status: "failed", error: { code: "internal_failure", message: "panne" } } }) });
    const { d, uploads } = deps(conn(), f);
    await expect(createVisual(d, "u1", { templateId: "EAGgsOdRFIY", title: "x", texts: { Thematique: "A" } })).rejects.toThrow(/Export du visuel échoué/);
    expect(uploads).toEqual([]);
  });

  it("textes : seulement les zones texte du modèle, bornées, zones vides signalées", () => {
    const fields = [{ name: "A", type: "text" as const }, { name: "B", type: "text" as const }, { name: "P", type: "image" as const }];
    expect(cleanTexts(fields, { A: "x".repeat(900), P: "pas du texte", Z: "?" })).toEqual({ texts: { A: "x".repeat(500) }, missing: ["B"] });
  });
});
