import { describe, expect, it } from "vitest";
import { authorizeUrl, littleText } from "@/server/linkedin/api";
import { publish, view, type LiConnection, type LiStore } from "@/server/linkedin/service";
import { saveDraft } from "@/server/instagram/service";
import { memoryStore } from "./fakes";

const USER = "11111111-1111-4111-8111-111111111111";
const SB = "https://wekbmkjvieagmghjanjb.supabase.co";
const VIDEO = `${SB}/storage/v1/object/sign/studio/render.mp4?token=abc`;
const ORG = "urn:li:organization:123";

function liStore(c: LiConnection | null = { memberUrn: "urn:li:person:abc", name: "Cédric", accessToken: "TOKEN", expiresAt: null, scopes: ["openid", "profile", "w_member_social"] }): LiStore & { c: LiConnection | null } {
  const s = { c, async get() { return s.c; }, async save(n: LiConnection) { s.c = n; }, async remove() { s.c = null; } };
  return s;
}

/** Faux LinkedIn : enregistre les appels (chemin + corps JSON) et répond selon le chemin. */
function fakeLinkedIn() {
  const calls: { url: string; body: unknown }[] = [];
  let n = 0;
  const f = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    let body: unknown = null;
    try { body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body ? "bytes" : null; } catch { body = "bytes"; }
    calls.push({ url, body });
    const json = (d: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(d), { status: 200, headers });
    if (url.startsWith(`${SB}/storage`)) return new Response(new Uint8Array([1, 2, 3, 4, 5, 6]), { status: 200 });
    if (url.includes("images?action=initializeUpload")) return json({ value: { uploadUrl: `https://upload.test/img${++n}`, image: `urn:li:image:${n}` } });
    if (url.includes("videos?action=initializeUpload")) return json({ value: { video: "urn:li:video:9", uploadToken: "t", uploadInstructions: [{ uploadUrl: "https://upload.test/v1", firstByte: 0, lastByte: 2 }, { uploadUrl: "https://upload.test/v2", firstByte: 3, lastByte: 5 }] } });
    if (url.includes("videos?action=finalizeUpload")) return json({});
    if (url.startsWith("https://upload.test/v")) return new Response(null, { status: 200, headers: { etag: `e-${url.slice(-1)}` } });
    if (url.startsWith("https://upload.test/img")) return new Response(null, { status: 201 });
    if (url.endsWith("/rest/posts")) return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:77" } });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  return { f, calls };
}

describe("LinkedIn", () => {
  it("demande l'accès page seulement si la page BeeRecos est configurée", () => {
    expect(new URL(authorizeUrl({ clientId: "c", redirectUri: "https://x/cb", state: "s", withPage: false })).searchParams.get("scope")).toBe("openid profile w_member_social");
    expect(new URL(authorizeUrl({ clientId: "c", redirectUri: "https://x/cb", state: "s", withPage: true })).searchParams.get("scope")).toContain("w_organization_social");
    expect(view(null, ORG).page).toEqual({ configured: true, allowed: false });
  });

  it("écrit le texte au format LinkedIn : vrais hashtags, caractères réservés échappés", () => {
    expect(littleText("Commente « INSPI » (vite) !\n#BeeRecos #InspiBEEzness")).toBe("Commente « INSPI » \\(vite\\) !\n{hashtag|\\#|BeeRecos} {hashtag|\\#|InspiBEEzness}");
    expect(littleText("STABILO_BOSS @ 50 ans")).toBe("STABILO\\_BOSS \\@ 50 ans");
  });

  it("publie un carrousel sur le profil : une image envoyée par photo, puis un post multi-images", async () => {
    const store = memoryStore();
    const ln = fakeLinkedIn();
    const d = await saveDraft({ store, supabaseUrl: SB }, USER, { kind: "post", caption: "Légende", media: [1, 2, 3].map((i) => ({ path: `${USER}/${i}.jpg`, type: "image" as const })) });
    const out = await publish({ store, li: liStore(), fetch: ln.f, supabaseUrl: SB }, USER, d.id, { text: "Texte LinkedIn #BeeRecos", target: "profil" });
    expect(out).toMatchObject({ linkedinStatus: "published", linkedinUrl: "https://www.linkedin.com/feed/update/urn:li:share:77/" });
    const post = ln.calls.find((c) => c.url.endsWith("/rest/posts"))!.body as Record<string, unknown>;
    expect(post).toMatchObject({ author: "urn:li:person:abc", visibility: "PUBLIC", lifecycleState: "PUBLISHED", content: { multiImage: { images: [{ id: "urn:li:image:1" }, { id: "urn:li:image:2" }, { id: "urn:li:image:3" }] } } });
    expect(post.commentary).toBe("Texte LinkedIn {hashtag|\\#|BeeRecos}");
    await expect(publish({ store, li: liStore(), fetch: ln.f, supabaseUrl: SB }, USER, d.id, { text: "x", target: "profil" })).rejects.toThrow(/Déjà publié/);
  });

  it("publie un réel : vidéo envoyée en parties puis finalisée avec les ETag", async () => {
    const store = memoryStore();
    const ln = fakeLinkedIn();
    const d = await saveDraft({ store, supabaseUrl: SB }, USER, { kind: "reel", montageId: "m1", title: "Le réseau", caption: "Légende" });
    const out = await publish({ store, li: liStore(), fetch: ln.f, supabaseUrl: SB }, USER, d.id, { text: "Mon réel", target: "profil", videoUrl: VIDEO });
    expect(out.linkedinStatus).toBe("published");
    expect(ln.calls.find((c) => c.url.includes("finalizeUpload"))!.body).toEqual({ finalizeUploadRequest: { video: "urn:li:video:9", uploadToken: "t", uploadedPartIds: ["e-1", "e-2"] } });
    expect((ln.calls.find((c) => c.url.endsWith("/rest/posts"))!.body as { content: unknown }).content).toEqual({ media: { id: "urn:li:video:9", title: "Le réseau" } });
  });

  it("refuse sans connexion, sans MP4, ou sur la page tant que LinkedIn ne l'a pas autorisée", async () => {
    const store = memoryStore();
    const d = await saveDraft({ store, supabaseUrl: SB }, USER, { kind: "post", caption: "x", media: [{ path: `${USER}/a.jpg`, type: "image" }] });
    await expect(publish({ store, li: liStore(null), supabaseUrl: SB }, USER, d.id, { text: "x", target: "profil" })).rejects.toThrow(/pas connecté/);
    await expect(publish({ store, li: liStore(), supabaseUrl: SB, organizationUrn: ORG }, USER, d.id, { text: "x", target: "page" })).rejects.toThrow(/pas encore autorisée/);
    const r = await saveDraft({ store, supabaseUrl: SB }, USER, { kind: "reel", montageId: "m2", caption: "x" });
    await expect(publish({ store, li: liStore(), supabaseUrl: SB }, USER, r.id, { text: "x", target: "profil", videoUrl: "https://evil.example/v.mp4" })).rejects.toThrow(/MP4/);
  });

  it("un refus de LinkedIn passe en échec lisible, et la page s'utilise une fois autorisée", async () => {
    const store = memoryStore();
    const failing = (async () => new Response(JSON.stringify({ message: "Token expired" }), { status: 401 })) as unknown as typeof fetch;
    const d = await saveDraft({ store, supabaseUrl: SB }, USER, { kind: "post", caption: "x", media: [{ path: `${USER}/a.jpg`, type: "image" }] });
    const failed = await publish({ store, li: liStore(), fetch: failing, supabaseUrl: SB }, USER, d.id, { text: "x", target: "profil" });
    expect(failed).toMatchObject({ linkedinStatus: "error" });
    expect(failed.linkedinError).toMatch(/HTTP 401|Média illisible|Token expired/);
    const ln = fakeLinkedIn();
    const pageConn = { memberUrn: "urn:li:person:abc", name: "Cédric", accessToken: "T", expiresAt: null, scopes: ["w_member_social", "w_organization_social"] };
    const ok = await publish({ store, li: liStore(pageConn), fetch: ln.f, supabaseUrl: SB, organizationUrn: ORG }, USER, d.id, { text: "Relance", target: "page" });
    expect(ok.linkedinStatus).toBe("published");
    expect((ln.calls.find((c) => c.url.endsWith("/rest/posts"))!.body as { author: string }).author).toBe(ORG);
  });
});
