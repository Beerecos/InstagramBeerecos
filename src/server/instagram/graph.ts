/**
 * Client Instagram — parcours unifié (Facebook Login for Business, graph.facebook.com), le seul proposé par l'app
 * BeeRecos Studio : jeton Facebook → Page Beerecos → compte Instagram professionnel relié. Conteneurs de publication
 * (réel, photo, carrousel), état, publication, lien public. Les appels de publication utilisent le jeton de la Page.
 * `fetch` est injectable pour les tests ; aucune donnée n'est supposée : chaque étape lit la réponse de Meta.
 */
export type GraphConfig = { token: string; userId: string; host?: string; version?: string; fetch?: typeof fetch };

export class GraphError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) {
    super(message);
    this.name = "GraphError";
  }
}

const HOST = "graph.facebook.com";
const VERSION = process.env.IG_API_VERSION || "v26.0";

async function call<T>(cfg: GraphConfig, method: "GET" | "POST", path: string, params: Record<string, string> = {}, body?: unknown): Promise<T> {
  const url = new URL(`https://${cfg.host ?? HOST}/${cfg.version ?? VERSION}/${path.replace(/^\//, "")}`);
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

type TokenCfg = Pick<GraphConfig, "token" | "host" | "version" | "fetch">;

/** Échange un jeton utilisateur (1 à 2 h) contre un jeton longue durée (environ 60 jours) : demande la clé secrète de l'app. */
export async function exchangeUserToken(cfg: TokenCfg & { appId: string; appSecret: string }): Promise<string> {
  const d = await call<{ access_token?: string }>({ ...cfg, userId: "me" }, "GET", "oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: cfg.appId, client_secret: cfg.appSecret, fb_exchange_token: cfg.token,
  });
  if (!d.access_token) throw new GraphError("Meta n'a pas renvoyé de jeton longue durée.", 400);
  return d.access_token;
}

export type LinkedAccount = { pageId: string; pageName: string; pageToken: string; igUserId: string; username: string };

/** Pages autorisées par ce jeton qui ont un compte Instagram professionnel relié (avec le jeton de chaque Page). */
export async function linkedAccounts(cfg: TokenCfg): Promise<LinkedAccount[]> {
  type Page = { id: string; name?: string; access_token?: string; instagram_business_account?: { id?: string; username?: string } };
  const d = await call<{ data?: Page[] }>({ ...cfg, userId: "me" }, "GET", "me/accounts", { fields: "name,access_token,instagram_business_account{id,username}", limit: "100" });
  return (d.data ?? []).flatMap((p) => {
    const ig = p.instagram_business_account;
    return ig?.id && ig.username && p.access_token ? [{ pageId: p.id, pageName: p.name ?? "", pageToken: p.access_token, igUserId: ig.id, username: ig.username }] : [];
  });
}

/** Lecture décisive : le compte Instagram tel que Meta le renvoie avec ce jeton (identifiant et nom réels). */
export async function account(cfg: GraphConfig): Promise<{ userId: string; username: string }> {
  const d = await call<{ id?: string; username?: string }>(cfg, "GET", cfg.userId, { fields: "id,username" });
  if (!d.id || !d.username) throw new GraphError("Instagram : compte illisible avec ce jeton.", 400);
  return { userId: d.id, username: d.username };
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

