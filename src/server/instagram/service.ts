/**
 * Onglet Post → Instagram : connexion du compte, brouillons, publication en deux temps (lancer, puis avancer à chaque
 * consultation : Instagram traite la vidéo plusieurs minutes, aucune fonction serveur n'attend), et règle de DM
 * « commente MOT » créée seulement APRÈS une publication confirmée par Instagram.
 * Le stockage et le réseau sont injectés (tests sans base ni réseau).
 */
import {
  DraftSchema, canStartPublishing, containerKind, publishBlockers, tokenNeedsRefresh,
  type DraftInput, type Publication, type PublicationMedia,
} from "@/domain/instagram/publication";
import * as graph from "./graph";

export type Connection = { igUserId: string; username: string; accessToken: string; expiresAt: string | null };
export type PublicConnection = { connected: boolean; username: string | null; expiresAt: string | null; needsRefresh: boolean };

export type Row = Publication & { createdBy: string; containerId: string | null; igMediaId: string | null };
export type LinkedInPatch = Partial<Pick<Row, "linkedinStatus" | "linkedinUrl" | "linkedinPublishedAt" | "linkedinError">> & { linkedinPostUrn?: string | null };

export type Store = {
  getConnection(): Promise<Connection | null>;
  saveConnection(c: Connection, by: string | null): Promise<void>;
  deleteConnection(): Promise<void>;
  list(userId: string): Promise<Row[]>;
  get(userId: string, id: string): Promise<Row | null>;
  insert(userId: string, draft: ReturnType<typeof DraftSchema.parse>): Promise<Row>;
  update(userId: string, id: string, draft: ReturnType<typeof DraftSchema.parse>): Promise<Row | null>;
  remove(userId: string, id: string): Promise<boolean>;
  /** Changement d'état conditionnel : n'écrit que si l'état actuel est l'un de `from` (et le conteneur `whenContainer` si donné). */
  transition(id: string, from: Row["status"][], patch: Partial<Pick<Row, "status" | "containerId" | "igMediaId" | "permalink" | "publishedAt" | "error">>, whenContainer?: string): Promise<Row | null>;
  addDmRule(rule: { publicationId: string; mediaId: string; keyword: string; dmText: string; buttonTitle: string | null; buttonUrl: string | null; label: string }): Promise<void>;
  signMedia(media: PublicationMedia[]): Promise<string[]>;
  /** État LinkedIn conditionnel (n'écrit que si l'état actuel est l'un de `from`). */
  transitionLinkedIn(id: string, from: Row["linkedinStatus"][], patch: LinkedInPatch): Promise<Row | null>;
};

/** `meta` : identifiant et clé secrète de l'app BeeRecos Studio (échange du jeton contre un jeton longue durée). */
export type Deps = { store: Store; fetch?: typeof fetch; supabaseUrl: string; meta?: { appId: string; appSecret?: string } };

export class UserError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "UserError";
  }
}

const publicView = (c: Connection | null): PublicConnection => ({
  connected: Boolean(c), username: c?.username ?? null, expiresAt: c?.expiresAt ?? null, needsRefresh: tokenNeedsRefresh(c?.expiresAt ?? null),
});
export function strip(row: Row): Publication {
  const { createdBy, containerId, igMediaId, ...p } = row;
  void createdBy; void containerId; void igMediaId;
  return p;
}

// --- Connexion ---

export async function connectionStatus(deps: Deps): Promise<PublicConnection> {
  return publicView(await deps.store.getConnection());
}

const metaError = (e: unknown, fallback: string) => new UserError(e instanceof Error ? e.message : fallback);

/**
 * Connexion par le parcours unifié : le jeton Facebook (Explorateur de l'API Graph) est échangé contre un jeton longue
 * durée, puis le serveur garde le jeton de la Page reliée au compte Instagram (il n'expire pas tant que les droits
 * restent accordés). N'est enregistré que le compte que Meta renvoie réellement avec ce jeton de Page.
 */
export async function connect(deps: Deps, userId: string, rawToken: string): Promise<PublicConnection> {
  const token = rawToken.trim();
  if (!/^[A-Za-z0-9_\-.|]{20,600}$/.test(token)) throw new UserError("Ce jeton n'a pas le format attendu : copie-le en entier depuis Meta.");
  if (!deps.meta?.appSecret) throw new UserError("Connexion impossible : ajoute META_APP_SECRET (clé secrète de l'app BeeRecos Studio) sur Vercel, puis redéploie.", 503);
  const long = await graph.exchangeUserToken({ token, appId: deps.meta.appId, appSecret: deps.meta.appSecret, fetch: deps.fetch })
    .catch((e) => { throw metaError(e, "Jeton refusé par Meta."); });
  const linked = await graph.linkedAccounts({ token: long, fetch: deps.fetch }).catch((e) => { throw metaError(e, "Pages illisibles avec ce jeton."); });
  if (!linked.length) throw new UserError("Meta ne renvoie aucune Page reliée à un compte Instagram : régénère le jeton en cochant la Page Beerecos et le compte beerecos (autorisation pages_show_list comprise).");
  if (linked.length > 1) throw new UserError(`Plusieurs comptes Instagram autorisés (${linked.map((l) => l.username).join(", ")}) : régénère le jeton en ne cochant que la Page du compte à connecter.`);
  const [page] = linked;
  const verified = await graph.account({ token: page.pageToken, userId: page.igUserId, fetch: deps.fetch }).catch((e) => { throw metaError(e, "Compte Instagram illisible."); });
  const c: Connection = { igUserId: verified.userId, username: verified.username, accessToken: page.pageToken, expiresAt: null };
  await deps.store.saveConnection(c, userId);
  return publicView(c);
}

/** Vérifie que Meta renvoie toujours le compte avec le jeton enregistré (droits retirés, mot de passe changé…). */
export async function refresh(deps: Deps): Promise<PublicConnection> {
  const c = await deps.store.getConnection();
  if (!c) throw new UserError("Instagram n'est pas connecté.");
  const a = await graph.account({ token: c.accessToken, userId: c.igUserId, fetch: deps.fetch })
    .catch((e) => { throw metaError(e, "Meta ne renvoie plus le compte : reconnecte-le."); });
  if (a.userId !== c.igUserId) throw new UserError("Meta renvoie un autre compte : reconnecte-le.");
  return publicView(c);
}

// --- Brouillons ---

export async function saveDraft(deps: Deps, userId: string, input: DraftInput & { id?: string }): Promise<Publication> {
  const { id, ...rest } = input;
  const parsed = DraftSchema.safeParse(rest);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Contenu invalide.");
  if (parsed.data.media.some((m) => !m.path.startsWith(`${userId}/`))) throw new UserError("Photo inconnue : renvoie-la depuis ce formulaire.");
  const row = id ? await deps.store.update(userId, id, parsed.data) : await deps.store.insert(userId, parsed.data);
  if (!row) throw new UserError("Ce post n'est plus modifiable (publié ou en cours de publication).", 409);
  return strip(row);
}

// --- Publication ---

/** URL d'un MP4 rendu par le Studio : seulement un lien signé du stockage Supabase du projet (pas d'URL arbitraire). */
export function isStudioVideoUrl(url: string, supabaseUrl: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(supabaseUrl);
    return u.protocol === "https:" && u.host === base.host && u.pathname.startsWith("/storage/v1/object/sign/");
  } catch {
    return false;
  }
}

/** Lance la publication : crée le conteneur Instagram. Rien n'est public tant qu'`advance` n'a pas publié. */
export async function start(deps: Deps, userId: string, id: string, opts: { videoUrl?: string } = {}): Promise<Publication> {
  const row = await deps.store.get(userId, id);
  if (!row) throw new UserError("Post introuvable.", 404);
  const conn = await deps.store.getConnection();
  const videoOk = row.kind === "reel" && Boolean(opts.videoUrl) && isStudioVideoUrl(opts.videoUrl!, deps.supabaseUrl);
  const blockers = publishBlockers(row, { connected: Boolean(conn), hasVideo: videoOk });
  if (blockers.length) throw new UserError(blockers[0], 409);
  if (!canStartPublishing(row.status)) throw new UserError("Ce post ne peut pas être relancé.", 409);

  const claimed = await deps.store.transition(id, ["draft", "error"], { status: "publishing", containerId: null, error: null });
  if (!claimed) throw new UserError("Publication déjà lancée.", 409);
  const cfg: graph.GraphConfig = { token: conn!.accessToken, userId: conn!.igUserId, fetch: deps.fetch };
  try {
    const kind = containerKind(row);
    const containerId = kind === "REELS"
      ? await graph.createContainer(cfg, { kind, videoUrl: opts.videoUrl!, caption: row.caption })
      : kind === "IMAGE"
        ? await graph.createContainer(cfg, { kind, imageUrl: (await deps.store.signMedia(row.media))[0], caption: row.caption })
        : await graph.createContainer(cfg, { kind, imageUrls: await deps.store.signMedia(row.media), caption: row.caption });
    const saved = await deps.store.transition(id, ["publishing"], { containerId });
    return strip(saved ?? claimed);
  } catch (e) {
    const failed = await deps.store.transition(id, ["publishing"], { status: "error", error: message(e) });
    return strip(failed ?? claimed);
  }
}

/**
 * Fait avancer une publication en cours (appelé à chaque consultation) : si Instagram a fini de traiter le média,
 * le publie (une seule fois, verrou sur le conteneur), enregistre le lien public, puis crée la règle de DM.
 */
export async function advance(deps: Deps, userId: string, id: string): Promise<Publication> {
  const row = await deps.store.get(userId, id);
  if (!row) throw new UserError("Post introuvable.", 404);
  if (row.status !== "publishing" || !row.containerId || row.containerId.startsWith("lock:")) return strip(row);
  const conn = await deps.store.getConnection();
  if (!conn) return strip(row);
  const cfg: graph.GraphConfig = { token: conn.accessToken, userId: conn.igUserId, fetch: deps.fetch };
  const container = row.containerId;
  try {
    const { state, detail } = await graph.containerStatus(cfg, container);
    if (state === "IN_PROGRESS") return strip(row);
    if (state === "ERROR" || state === "EXPIRED") {
      return strip((await deps.store.transition(id, ["publishing"], { status: "error", error: `Instagram a refusé le média (${state}${detail ? ` : ${detail}` : ""}).` })) ?? row);
    }
    const locked = await deps.store.transition(id, ["publishing"], { containerId: `lock:${container}` }, container);
    if (!locked) return strip((await deps.store.get(userId, id)) ?? row);
    let published: { mediaId: string; permalink: string | null };
    try {
      published = await graph.publishContainer(cfg, container);
    } catch (e) {
      // La réponse a pu se perdre après une publication réussie : on ne relance pas à l'aveugle.
      return strip((await deps.store.transition(id, ["publishing"], { status: "error", containerId: container, error: `${message(e)} Vérifie sur Instagram si le post est en ligne avant de relancer.`.slice(0, 480) })) ?? row);
    }
    const { mediaId, permalink } = published;
    let done = await deps.store.transition(id, ["publishing"], { status: "published", igMediaId: mediaId, permalink, publishedAt: new Date().toISOString(), containerId: container, error: null });
    if (row.keyword && row.dmText) {
      try {
        await deps.store.addDmRule({ publicationId: id, mediaId, keyword: row.keyword, dmText: row.dmText, buttonTitle: row.buttonTitle, buttonUrl: row.buttonUrl, label: row.title || row.keyword });
      } catch (e) {
        done = (await deps.store.transition(id, ["published"], { error: `Publié, mais la règle de DM ${row.keyword} n'a pas été créée : ${message(e)}`.slice(0, 480) })) ?? done;
      }
    }
    return strip(done ?? row);
  } catch (e) {
    return strip((await deps.store.transition(id, ["publishing"], { status: "error", error: message(e), containerId: container })) ?? row);
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Erreur inconnue.").slice(0, 480);
