/**
 * Canva dans le Studio (demande de Cédric, 2026-11-09 : « automatiser la création de mes posts », Canva Pro) :
 * connexion officielle (OAuth + PKCE), jetons gardés côté serveur, puis « Créer le visuel avec Canva » : un modèle de
 * marque est rempli avec les textes du post, exporté en JPG et déposé dans le stockage des photos du post (ig-media).
 * Rien n'est publié ici : le visuel entre dans le brouillon du post, qui suit la validation habituelle.
 */
import * as canva from "./api";
import { CanvaError } from "./api";

export type CanvaConnection = { displayName: string; accessToken: string; refreshToken: string; expiresAt: string; scopes: string[]; capabilities: string[] };
export type CanvaStore = {
  get(): Promise<CanvaConnection | null>;
  save(c: CanvaConnection, by: string | null): Promise<void>;
  remove(): Promise<void>;
};
export type CanvaDeps = {
  store: CanvaStore;
  app: { clientId?: string; clientSecret?: string };
  fetch: typeof fetch;
  /** Dépose un JPEG dans le stockage des photos du post et renvoie son chemin. */
  upload: (userId: string, bytes: ArrayBuffer) => Promise<string>;
  now?: () => number;
  poll?: canva.PollOpts;
};
export type CanvaView = { appConfigured: boolean; connected: boolean; name: string | null; autofill: boolean | null; brandTemplates: boolean | null };

/** Maximum de pages reprises d'un design (carrousel Instagram). */
export const MAX_PAGES = 10;
/** Champ de texte Canva : longueur raisonnable pour un visuel. */
export const MAX_TEXT = 500;

export function view(deps: Pick<CanvaDeps, "app">, c: CanvaConnection | null): CanvaView {
  return {
    appConfigured: Boolean(deps.app.clientId && deps.app.clientSecret),
    connected: Boolean(c), name: c?.displayName ?? null,
    autofill: c ? c.capabilities.includes("autofill") : null,
    brandTemplates: c ? c.capabilities.includes("brand_template") : null,
  };
}

function app(deps: CanvaDeps) {
  if (!deps.app.clientId || !deps.app.clientSecret) throw new CanvaError("Canva non configuré sur le serveur (CANVA_CLIENT_ID, CANVA_CLIENT_SECRET).", 503);
  return { clientId: deps.app.clientId, clientSecret: deps.app.clientSecret };
}

export async function finishConnect(deps: CanvaDeps, userId: string, o: { code: string; verifier: string; redirectUri: string }): Promise<CanvaView> {
  const t = await canva.exchangeCode(deps.fetch, { ...app(deps), ...o });
  const caps = await canva.capabilities(deps.fetch, t.accessToken).catch(() => [] as string[]);
  const c: CanvaConnection = { displayName: "Compte Canva", ...t, capabilities: caps };
  await deps.store.save(c, userId);
  return view(deps, c);
}

// Un seul renouvellement à la fois par instance : le jeton de renouvellement Canva ne sert qu'une fois.
let refreshing: Promise<CanvaConnection> | null = null;

/** Jeton d'accès valable (renouvelé 5 min avant expiration). Sans connexion : erreur lisible, jamais d'appel anonyme. */
export async function accessToken(deps: CanvaDeps): Promise<string> {
  const c = await deps.store.get();
  if (!c) throw new CanvaError("Canva n'est pas connecté : connecte-le dans Paramètres.", 409);
  const now = (deps.now ?? Date.now)();
  if (Date.parse(c.expiresAt) - now > 5 * 60_000) return c.accessToken;
  refreshing ??= (async () => {
    try {
      const t = await canva.refreshTokens(deps.fetch, { ...app(deps), refreshToken: c.refreshToken });
      const next = { ...c, ...t };
      await deps.store.save(next, null);
      return next;
    } catch (e) {
      // Une autre instance a peut-être déjà renouvelé : relire avant d'abandonner.
      const again = await deps.store.get();
      if (again && again.refreshToken !== c.refreshToken && Date.parse(again.expiresAt) > now) return again;
      throw e instanceof CanvaError && e.status === 401 ? new CanvaError("Connexion Canva expirée : reconnecte Canva dans Paramètres.", 401) : e;
    } finally { refreshing = null; }
  })();
  return (await refreshing).accessToken;
}

export async function templates(deps: CanvaDeps, query = "") {
  return canva.listBrandTemplates(deps.fetch, await accessToken(deps), query);
}

export async function dataset(deps: CanvaDeps, templateId: string) {
  return canva.templateDataset(deps.fetch, await accessToken(deps), templateId);
}

export type VisualInput = { templateId: string; title: string; texts: Record<string, string> };

/** Contrôle des textes envoyés : seulement les champs texte du modèle, non vides, longueur bornée. */
export function cleanTexts(fields: canva.DatasetField[], texts: Record<string, unknown>): { texts: Record<string, string>; missing: string[] } {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const f of fields.filter((x) => x.type === "text")) {
    const v = typeof texts[f.name] === "string" ? (texts[f.name] as string).trim() : "";
    if (v) out[f.name] = v.slice(0, MAX_TEXT); else missing.push(f.name);
  }
  return { texts: out, missing };
}

/** Crée le visuel : remplissage du modèle, export JPG, dépôt de chaque page dans les photos du post. */
export async function createVisual(deps: CanvaDeps, userId: string, input: VisualInput): Promise<{ paths: string[]; editUrl: string | null; designId: string; pages: number; missing: string[] }> {
  const token = await accessToken(deps);
  const fields = await canva.templateDataset(deps.fetch, token, input.templateId);
  if (!fields.some((f) => f.type === "text")) throw new CanvaError("Ce modèle Canva n'a aucune zone de texte remplissable.", 400);
  const { texts, missing } = cleanTexts(fields, input.texts);
  if (!Object.keys(texts).length) throw new CanvaError("Remplis au moins une zone de texte du modèle.", 400);
  const design = await canva.autofill(deps.fetch, token, { templateId: input.templateId, title: input.title || "Post BeeRecos", texts, ...deps.poll });
  const urls = await canva.exportJpg(deps.fetch, token, { designId: design.designId, ...deps.poll });
  const paths: string[] = [];
  for (const url of urls.slice(0, MAX_PAGES)) {
    const res = await deps.fetch(url, { cache: "no-store" });
    if (!res.ok) throw new CanvaError(`Image Canva illisible (HTTP ${res.status}) : réessaie.`, 502);
    paths.push(await deps.upload(userId, await res.arrayBuffer()));
  }
  return { paths, editUrl: design.editUrl, designId: design.designId, pages: urls.length, missing };
}
