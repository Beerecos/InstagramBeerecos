/**
 * Client Instagram (API Instagram avec connexion Instagram, graph.instagram.com) : compte, conteneurs de publication
 * (réel, photo, carrousel), état, publication, lien public, renouvellement du jeton, DM de réponse à un commentaire.
 * `fetch` est injectable pour les tests ; aucune donnée n'est supposée : chaque étape lit la réponse d'Instagram.
 */
export type GraphConfig = { token: string; userId: string; host?: string; version?: string; fetch?: typeof fetch };

export class GraphError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) {
    super(message);
    this.name = "GraphError";
  }
}

export function unifiedLogin(): boolean {
  const mode = process.env.IG_LOGIN_MODE || "instagram";
  if (!["instagram", "unified"].includes(mode)) throw new GraphError("Configuration Instagram invalide : IG_LOGIN_MODE.", 503);
  return mode === "unified";
}
export const graphHost = () => unifiedLogin() ? "graph.facebook.com" : "graph.instagram.com";
const VERSION = process.env.IG_API_VERSION || "v26.0";

async function call<T>(cfg: GraphConfig, method: "GET" | "POST", path: string, params: Record<string, string> = {}, body?: unknown): Promise<T> {
  const url = new URL(`https://${cfg.host ?? graphHost()}/${cfg.version ?? VERSION}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await (cfg.fetch ?? fetch)(url, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || data.error) throw new GraphError(`Instagram : ${data.error?.message ?? `HTTP ${res.status}`}`, res.status, data.error?.code);
  return data;
}

export async function me(cfg: Omit<GraphConfig, "userId">): Promise<{ userId: string; username: string }> {
  if (unifiedLogin()) {
    const id = process.env.IG_USER_ID;
    if (!id || !/^\d+$/.test(id)) throw new GraphError("Renseigner IG_USER_ID avec l’identifiant du compte Instagram dans la configuration serveur.", 503);
    const account = await call<{ id?: string; username?: string }>({ ...cfg, userId: id }, "GET", id, { fields: "id,username" });
    if (String(account.id) !== id || !account.username) throw new GraphError("Compte Instagram inaccessible avec ce jeton.", 400);
    return { userId: id, username: account.username };
  }
  const d = await call<{ user_id?: string | number; id?: string; username?: string }>({ ...cfg, userId: "me" }, "GET", "me", { fields: "user_id,username" });
  const userId = String(d.user_id ?? d.id ?? "");
  if (!userId || !d.username) throw new GraphError("Instagram : compte illisible avec ce jeton.", 400);
  return { userId, username: d.username };
}

export type ContainerInput =
  | { kind: "REELS"; videoUrl: string; caption: string }
  | { kind: "IMAGE"; imageUrl: string; caption: string }
  | { kind: "CAROUSEL"; imageUrls: string[]; caption: string };

/** Crée le conteneur à publier ; pour un carrousel, crée d'abord un conteneur par photo. Renvoie l'id du conteneur final. */
export async function createContainer(cfg: GraphConfig, input: ContainerInput): Promise<string> {
  const media = `${cfg.userId}/media`;
  if (input.kind === "REELS") return (await call<{ id: string }>(cfg, "POST", media, { media_type: "REELS", video_url: input.videoUrl, caption: input.caption, share_to_feed: "true" })).id;
  if (input.kind === "IMAGE") return (await call<{ id: string }>(cfg, "POST", media, { image_url: input.imageUrl, caption: input.caption })).id;
  const children: string[] = [];
  for (const imageUrl of input.imageUrls) children.push((await call<{ id: string }>(cfg, "POST", media, { image_url: imageUrl, is_carousel_item: "true" })).id);
  return (await call<{ id: string }>(cfg, "POST", media, { media_type: "CAROUSEL", children: children.join(","), caption: input.caption })).id;
}

export type ContainerState = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";
export async function containerStatus(cfg: GraphConfig, containerId: string): Promise<{ state: ContainerState; detail: string }> {
  const d = await call<{ status_code?: ContainerState; status?: string }>(cfg, "GET", containerId, { fields: "status_code,status" });
  return { state: d.status_code ?? "IN_PROGRESS", detail: d.status ?? "" };
}

export async function publishContainer(cfg: GraphConfig, containerId: string): Promise<{ mediaId: string; permalink: string | null }> {
  const { id } = await call<{ id: string }>(cfg, "POST", `${cfg.userId}/media_publish`, { creation_id: containerId });
  const link = await call<{ permalink?: string }>(cfg, "GET", id, { fields: "permalink" }).catch(() => ({ permalink: undefined }));
  return { mediaId: id, permalink: link.permalink ?? null };
}

/** Jeton longue durée : renouvelé pour 60 jours (refusé par Instagram s'il a moins de 24 h). */
export async function refreshToken(cfg: Pick<GraphConfig, "token" | "host" | "fetch">): Promise<{ token: string; expiresAt: string }> {
  if (unifiedLogin() || cfg.host === "graph.facebook.com") throw new GraphError("Ce jeton Unified Login doit être remplacé depuis Meta avant son expiration.", 400);
  const url = new URL(`https://${cfg.host ?? graphHost()}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", cfg.token);
  const res = await (cfg.fetch ?? fetch)(url, { cache: "no-store" });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!res.ok || d.error || !d.access_token || !d.expires_in) throw new GraphError(`Renouvellement refusé : ${d.error?.message ?? `HTTP ${res.status}`}`, res.status);
  return { token: d.access_token, expiresAt: new Date(Date.now() + d.expires_in * 1000).toISOString() };
}
