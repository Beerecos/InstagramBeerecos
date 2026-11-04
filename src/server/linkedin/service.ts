/**
 * Publication LinkedIn d'une création de l'onglet Post (photo, carrousel ou réel), sur le profil membre, ou sur la page
 * BeeRecos quand LinkedIn a accordé l'accès « page » (w_organization_social) et que LINKEDIN_ORGANIZATION_URN est posé.
 * Les médias sont relus depuis le stockage (photos : bucket privé ; réel : MP4 signé du Studio), puis envoyés à LinkedIn.
 */
import { isStudioVideoUrl, strip, UserError, type Row, type Store } from "@/server/instagram/service";
import { LINKEDIN_MAX, type Publication } from "@/domain/instagram/publication";
import * as li from "./api";

export type LiConnection = { memberUrn: string; name: string; accessToken: string; expiresAt: string | null; scopes: string[] };
export type LiStore = {
  get(): Promise<LiConnection | null>;
  save(c: LiConnection, by: string): Promise<void>;
  remove(): Promise<void>;
};
export type LiDeps = { store: Store; li: LiStore; fetch?: typeof fetch; supabaseUrl: string; organizationUrn?: string };
export type LiView = { connected: boolean; name: string | null; expiresAt: string | null; page: { configured: boolean; allowed: boolean } };

export function view(c: LiConnection | null, organizationUrn?: string): LiView {
  return {
    connected: Boolean(c), name: c?.name ?? null, expiresAt: c?.expiresAt ?? null,
    page: { configured: Boolean(organizationUrn), allowed: Boolean(organizationUrn && c?.scopes.includes("w_organization_social")) },
  };
}

/** Fin de l'autorisation LinkedIn : code échangé contre un jeton, compte lu, enregistrement côté serveur. */
export async function finishConnect(deps: LiDeps, userId: string, o: { code: string; clientId: string; clientSecret: string; redirectUri: string }): Promise<LiView> {
  const t = await li.exchangeCode({ ...o, fetch: deps.fetch });
  const me = await li.userinfo({ token: t.token, fetch: deps.fetch });
  const c: LiConnection = { memberUrn: me.memberUrn, name: me.name, accessToken: t.token, expiresAt: t.expiresAt, scopes: t.scopes };
  await deps.li.save(c, userId);
  return view(c, deps.organizationUrn);
}

async function bytes(f: typeof fetch, url: string): Promise<ArrayBuffer> {
  const res = await f(url, { cache: "no-store" });
  if (!res.ok) throw new UserError(`Média illisible (HTTP ${res.status}) : relance le rendu ou renvoie la photo.`, 502);
  return res.arrayBuffer();
}

/**
 * Publie sur LinkedIn (public, irréversible depuis l'app). Verrou d'état : une seule publication à la fois, jamais deux
 * fois. `text` : texte LinkedIn final (adaptable, pré-rempli avec la légende).
 */
export async function publish(deps: LiDeps, userId: string, id: string, o: { text: string; target: "profil" | "page"; videoUrl?: string }): Promise<Publication> {
  const row = await deps.store.get(userId, id);
  if (!row) throw new UserError("Post introuvable.", 404);
  const conn = await deps.li.get();
  if (!conn) throw new UserError("LinkedIn n'est pas connecté (Paramètres → LinkedIn).", 409);
  const text = o.text.trim();
  if (!text) throw new UserError("Le texte LinkedIn est vide.");
  if (text.length > LINKEDIN_MAX) throw new UserError(`Texte LinkedIn trop long (${text.length} / ${LINKEDIN_MAX}).`);
  const v = view(conn, deps.organizationUrn);
  if (o.target === "page" && !v.page.allowed) throw new UserError("La page BeeRecos n'est pas encore autorisée par LinkedIn : publie sur ton profil.", 409);
  if (row.kind === "post" && !row.media.length) throw new UserError("Ajoute au moins une photo.", 409);
  if (row.kind === "reel" && !(o.videoUrl && isStudioVideoUrl(o.videoUrl, deps.supabaseUrl))) throw new UserError("Le MP4 du réel n'est pas encore rendu.", 409);
  if (row.media.length > 20) throw new UserError("20 photos au plus sur LinkedIn.");

  const claimed = await deps.store.transitionLinkedIn(id, ["none", "error"], { linkedinStatus: "publishing", linkedinError: null });
  if (!claimed) throw new UserError(row.linkedinStatus === "published" ? "Déjà publié sur LinkedIn." : "Publication LinkedIn déjà en cours.", 409);
  const author = o.target === "page" ? deps.organizationUrn! : conn.memberUrn;
  const cfg: li.LinkedInConfig = { token: conn.accessToken, fetch: deps.fetch };
  const f = deps.fetch ?? fetch;
  try {
    let media: li.PostMedia = { kind: "none" };
    if (row.kind === "reel") media = { kind: "video", urn: await li.uploadVideo(cfg, author, await bytes(f, o.videoUrl!)), title: row.title || undefined };
    else {
      const urls = await deps.store.signMedia(row.media);
      const urns: string[] = [];
      for (const url of urls) urns.push(await li.uploadImage(cfg, author, await bytes(f, url)));
      media = urns.length === 1 ? { kind: "image", urn: urns[0] } : { kind: "images", urns };
    }
    const urn = await li.createPost(cfg, author, text, media);
    const done = await deps.store.transitionLinkedIn(id, ["publishing"], { linkedinStatus: "published", linkedinPostUrn: urn, linkedinPublishedAt: new Date().toISOString(), linkedinError: null });
    return strip((done ?? claimed) as Row);
  } catch (e) {
    const message = (e instanceof Error ? e.message : "Erreur inconnue.").slice(0, 480);
    const failed = await deps.store.transitionLinkedIn(id, ["publishing"], { linkedinStatus: "error", linkedinError: message });
    return strip((failed ?? claimed) as Row);
  }
}
