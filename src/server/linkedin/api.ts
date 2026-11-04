/**
 * Client LinkedIn (API officielle) : connexion OAuth (OpenID + w_member_social, et w_organization_social pour la page
 * quand LinkedIn l'a validée), envoi d'images et de vidéos, création d'un post (Posts API, `/rest/posts`).
 * `fetch` est injectable pour les tests ; chaque étape lit la réponse de LinkedIn, rien n'est supposé.
 */
export type LinkedInConfig = { token: string; version?: string; fetch?: typeof fetch };

export class LinkedInError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "LinkedInError";
  }
}

const API = "https://api.linkedin.com";
const VERSION = process.env.LINKEDIN_API_VERSION || "202609";

export const MEMBER_SCOPES = ["openid", "profile", "w_member_social"];
export const PAGE_SCOPES = ["w_organization_social", "r_organization_social"];

export function authorizeUrl(o: { clientId: string; redirectUri: string; state: string; withPage: boolean }): string {
  const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", o.clientId);
  u.searchParams.set("redirect_uri", o.redirectUri);
  u.searchParams.set("state", o.state);
  u.searchParams.set("scope", [...MEMBER_SCOPES, ...(o.withPage ? PAGE_SCOPES : [])].join(" "));
  return u.toString();
}

export async function exchangeCode(o: { code: string; clientId: string; clientSecret: string; redirectUri: string; fetch?: typeof fetch }) {
  const res = await (o.fetch ?? fetch)("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: o.code, redirect_uri: o.redirectUri, client_id: o.clientId, client_secret: o.clientSecret }),
    cache: "no-store",
  });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; scope?: string; error_description?: string };
  if (!res.ok || !d.access_token) throw new LinkedInError(`Connexion LinkedIn refusée : ${d.error_description ?? `HTTP ${res.status}`}`, res.status);
  return { token: d.access_token, expiresAt: d.expires_in ? new Date(Date.now() + d.expires_in * 1000).toISOString() : null, scopes: (d.scope ?? "").split(/[ ,]+/).filter(Boolean) };
}

export async function userinfo(cfg: LinkedInConfig): Promise<{ memberUrn: string; name: string }> {
  const res = await (cfg.fetch ?? fetch)(`${API}/v2/userinfo`, { headers: { Authorization: `Bearer ${cfg.token}` }, cache: "no-store" });
  const d = (await res.json().catch(() => ({}))) as { sub?: string; name?: string };
  if (!res.ok || !d.sub) throw new LinkedInError(`Compte LinkedIn illisible (HTTP ${res.status}).`, res.status);
  return { memberUrn: `urn:li:person:${d.sub}`, name: d.name ?? "Mon profil" };
}

async function rest<T>(cfg: LinkedInConfig, path: string, body: unknown): Promise<{ data: T; headers: Headers }> {
  const res = await (cfg.fetch ?? fetch)(`${API}/rest/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "LinkedIn-Version": cfg.version ?? VERSION, "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as T & { message?: string };
  if (!res.ok) throw new LinkedInError(`LinkedIn : ${(data as { message?: string }).message ?? `HTTP ${res.status}`}`, res.status);
  return { data, headers: res.headers };
}

/** Image : demande d'envoi, puis dépôt des octets. Renvoie l'URN de l'image. */
export async function uploadImage(cfg: LinkedInConfig, owner: string, bytes: ArrayBuffer): Promise<string> {
  const { data } = await rest<{ value: { uploadUrl: string; image: string } }>(cfg, "images?action=initializeUpload", { initializeUploadRequest: { owner } });
  const put = await (cfg.fetch ?? fetch)(data.value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${cfg.token}` }, body: bytes });
  if (!put.ok) throw new LinkedInError(`Envoi de l'image refusé par LinkedIn (HTTP ${put.status}).`, put.status);
  return data.value.image;
}

/** Vidéo : envoi en parties (consignes de LinkedIn), puis finalisation avec les ETag reçus. Renvoie l'URN de la vidéo. */
export async function uploadVideo(cfg: LinkedInConfig, owner: string, bytes: ArrayBuffer): Promise<string> {
  const { data } = await rest<{ value: { video: string; uploadToken?: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] } }>(
    cfg, "videos?action=initializeUpload", { initializeUploadRequest: { owner, fileSizeBytes: bytes.byteLength, uploadCaptions: false, uploadThumbnail: false } });
  const etags: string[] = [];
  for (const part of data.value.uploadInstructions) {
    const res = await (cfg.fetch ?? fetch)(part.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: bytes.slice(part.firstByte, part.lastByte + 1) });
    if (!res.ok) throw new LinkedInError(`Envoi de la vidéo interrompu (HTTP ${res.status}).`, res.status);
    etags.push(res.headers.get("etag") ?? "");
  }
  await rest(cfg, "videos?action=finalizeUpload", { finalizeUploadRequest: { video: data.value.video, uploadToken: data.value.uploadToken ?? "", uploadedPartIds: etags } });
  return data.value.video;
}

/**
 * Texte d'un post au format « little text » de LinkedIn : les caractères réservés sont échappés, et chaque #mot devient
 * un vrai hashtag ({hashtag|\#|mot}).
 */
export function littleText(text: string): string {
  const RESERVED = /[\\|{}@[\]()<>*_~]/g;
  return text.split(/(#[\p{L}\p{N}_]+)/u).map((chunk) => {
    const tag = chunk.match(/^#([\p{L}\p{N}_]+)$/u);
    if (tag) return `{hashtag|\\#|${tag[1]}}`;
    return chunk.replace(RESERVED, (c) => `\\${c}`).replace(/#/g, "\\#");
  }).join("");
}

export type PostMedia = { kind: "none" } | { kind: "image"; urn: string } | { kind: "images"; urns: string[] } | { kind: "video"; urn: string; title?: string };

/** Crée le post public. Renvoie son URN (en-tête x-restli-id). */
export async function createPost(cfg: LinkedInConfig, author: string, text: string, media: PostMedia): Promise<string> {
  const content = media.kind === "image" ? { media: { id: media.urn } }
    : media.kind === "images" ? { multiImage: { images: media.urns.map((id) => ({ id })) } }
    : media.kind === "video" ? { media: { id: media.urn, ...(media.title ? { title: media.title } : {}) } }
    : undefined;
  const { headers } = await rest(cfg, "posts", {
    author, commentary: littleText(text), visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false,
    ...(content ? { content } : {}),
  });
  const urn = headers.get("x-restli-id");
  if (!urn) throw new LinkedInError("LinkedIn n'a pas renvoyé l'identifiant du post.", 502);
  return urn;
}

export const postUrl = (urn: string) => `https://www.linkedin.com/feed/update/${urn}/`;
