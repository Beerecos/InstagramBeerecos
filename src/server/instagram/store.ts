import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Store, Row } from "./service";

/**
 * Stockage Supabase (clé secrète, serveur uniquement). Toutes les lectures de publications sont filtrées sur l'auteur
 * dont la session vient d'être vérifiée : la clé secrète ne sert jamais à lire les créations d'un autre.
 */
type DbRow = {
  id: string; created_by: string; kind: Row["kind"]; montage_id: string | null; title: string; caption: string; media: Row["media"];
  keyword: string | null; dm_text: string | null; button_title: string | null; button_url: string | null; status: Row["status"];
  container_id: string | null; ig_media_id: string | null; permalink: string | null; published_at: string | null; error: string | null; updated_at: string;
};

const toRow = (r: DbRow): Row => ({
  id: r.id, createdBy: r.created_by, kind: r.kind, montageId: r.montage_id, title: r.title, caption: r.caption, media: r.media ?? [],
  keyword: r.keyword, dmText: r.dm_text, buttonTitle: r.button_title, buttonUrl: r.button_url, status: r.status,
  containerId: r.container_id, igMediaId: r.ig_media_id, permalink: r.permalink, publishedAt: r.published_at, error: r.error, updatedAt: r.updated_at,
});

const SIGNED_SECONDS = 3600;
const BUCKET = "ig-media";

export function supabaseStore(): Store {
  const sb = createSupabaseAdminClient();
  const fail = (what: string, e: { message: string } | null) => { if (e) throw new Error(`${what} : ${e.message}`); };
  const fields = (d: Parameters<Store["insert"]>[1]) => ({
    kind: d.kind, montage_id: d.montageId ?? null, title: d.title, caption: d.caption, media: d.media,
    keyword: d.keyword ?? null, dm_text: d.dmText ?? null, button_title: d.buttonTitle ?? null, button_url: d.buttonUrl ?? null,
  });

  return {
    async getConnection() {
      const { data, error } = await sb.from("ig_connection").select("ig_user_id, username, access_token, expires_at").eq("id", 1).maybeSingle();
      fail("Lecture de la connexion Instagram", error);
      return data ? { igUserId: data.ig_user_id, username: data.username, accessToken: data.access_token, expiresAt: data.expires_at } : null;
    },
    async saveConnection(c, by) {
      const { error } = await sb.from("ig_connection").upsert({ id: 1, ig_user_id: c.igUserId, username: c.username, access_token: c.accessToken, expires_at: c.expiresAt, ...(by ? { connected_by: by } : {}), updated_at: new Date().toISOString() });
      fail("Enregistrement de la connexion Instagram", error);
    },
    async deleteConnection() {
      const { error } = await sb.from("ig_connection").delete().eq("id", 1);
      fail("Déconnexion d'Instagram", error);
    },
    async list(userId) {
      const { data, error } = await sb.from("ig_publications").select("*").eq("created_by", userId).order("updated_at", { ascending: false }).limit(200);
      fail("Lecture des posts", error);
      return (data as DbRow[]).map(toRow);
    },
    async get(userId, id) {
      const { data, error } = await sb.from("ig_publications").select("*").eq("id", id).eq("created_by", userId).maybeSingle();
      fail("Lecture du post", error);
      return data ? toRow(data as DbRow) : null;
    },
    async insert(userId, d) {
      // Un réel du Studio n'a qu'une fiche : on reprend celle qui existe (index unique sur montage_id).
      if (d.montageId) {
        const { data: existing } = await sb.from("ig_publications").select("id").eq("montage_id", d.montageId).eq("created_by", userId).maybeSingle();
        if (existing) return (await this.update(userId, existing.id, d)) as Row;
      }
      const { data, error } = await sb.from("ig_publications").insert({ ...fields(d), created_by: userId }).select("*").single();
      fail("Création du post", error);
      return toRow(data as DbRow);
    },
    async update(userId, id, d) {
      const { data, error } = await sb.from("ig_publications").update({ ...fields(d), updated_at: new Date().toISOString() })
        .eq("id", id).eq("created_by", userId).in("status", ["draft", "error"]).select("*").maybeSingle();
      fail("Enregistrement du post", error);
      return data ? toRow(data as DbRow) : null;
    },
    async remove(userId, id) {
      const { data, error } = await sb.from("ig_publications").delete().eq("id", id).eq("created_by", userId).in("status", ["draft", "error"]).select("id");
      fail("Suppression du post", error);
      return (data ?? []).length > 0;
    },
    async transition(id, from, patch, whenContainer) {
      const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("status" in patch) set.status = patch.status;
      if ("containerId" in patch) set.container_id = patch.containerId;
      if ("igMediaId" in patch) set.ig_media_id = patch.igMediaId;
      if ("permalink" in patch) set.permalink = patch.permalink;
      if ("publishedAt" in patch) set.published_at = patch.publishedAt;
      if ("error" in patch) set.error = patch.error;
      let q = sb.from("ig_publications").update(set).eq("id", id).in("status", from);
      if (whenContainer) q = q.eq("container_id", whenContainer);
      const { data, error } = await q.select("*").maybeSingle();
      fail("Mise à jour de la publication", error);
      return data ? toRow(data as DbRow) : null;
    },
    async addDmRule(rule) {
      const { error } = await sb.from("cta_campaigns").upsert({
        publication_id: rule.publicationId, media_id: rule.mediaId, keyword: rule.keyword, dm_text: rule.dmText,
        button_title: rule.buttonTitle, button_url: rule.buttonUrl, label: rule.label, active: true,
      }, { onConflict: "publication_id" });
      fail("Création de la règle de DM", error);
    },
    async signMedia(media) {
      const urls: string[] = [];
      for (const m of media) {
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(m.path, SIGNED_SECONDS);
        fail("Lien de la photo", error);
        urls.push(data!.signedUrl);
      }
      return urls;
    },
  };
}

/** Lien d'envoi direct d'une photo (JPEG) dans le bucket privé, rangé sous l'utilisateur. */
export async function signedUpload(userId: string): Promise<{ path: string; token: string }> {
  const sb = createSupabaseAdminClient();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Envoi de photo impossible : ${error?.message ?? "lien refusé"}`);
  return { path, token: data.token };
}

/** Aperçus des photos d'un post (liens signés courts, lecture seule). */
export async function previewUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const sb = createSupabaseAdminClient();
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]));
}
