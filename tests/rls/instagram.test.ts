import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDatabase, createUser, type Db } from "./harness";

const CEDRIC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let db: Db;
let draft: string;
let published: string;

beforeAll(async () => {
  db = await createDatabase();
  await createUser(db, CEDRIC, "Cédric");
  await createUser(db, OTHER, "Autre");
  draft = await asUser(db, CEDRIC, async () =>
    (await db.query<{ id: string }>("insert into public.ig_publications (kind, title, caption, keyword, dm_text) values ('post', 'Photo', 'Légende', 'CLUB', 'Voici le lien') returning id")).rows[0].id);
  // Publication réelle : écrite par le serveur (clé secrète), jamais par la session.
  published = (await db.query<{ id: string }>("insert into public.ig_publications (created_by, kind, title, status, ig_media_id, permalink, published_at) values ($1, 'reel', 'Réel', 'published', '178', 'https://www.instagram.com/reel/x', now()) returning id", [CEDRIC])).rows[0].id;
  await db.query("insert into public.ig_connection (ig_user_id, username, access_token) values ('1784', 'beerecos', 'SECRET')");
}, 30_000);

describe("RLS publication Instagram", () => {
  it("chacun ne voit que ses créations", async () => {
    expect(await asUser(db, CEDRIC, async () => (await db.query("select id from public.ig_publications")).rows)).toHaveLength(2);
    expect(await asUser(db, OTHER, async () => (await db.query("select id from public.ig_publications")).rows)).toHaveLength(0);
    expect(await asUser(db, null, async () => (await db.query("select id from public.ig_publications").catch(() => ({ rows: [] }))).rows)).toHaveLength(0);
  });

  it("une session ne peut ni se déclarer publiée ni modifier une publication faite", async () => {
    await expect(asUser(db, CEDRIC, () => db.query("insert into public.ig_publications (kind, status) values ('post', 'published')"))).rejects.toThrow(/row-level security/);
    await expect(asUser(db, CEDRIC, () => db.query("update public.ig_publications set ig_media_id = '1', status = 'published' where id = $1", [draft]))).rejects.toThrow(/row-level security/);
    const touched = await asUser(db, CEDRIC, async () => (await db.query("update public.ig_publications set caption = 'x' where id = $1 returning 1", [published])).rows);
    expect(touched).toHaveLength(0);
    const removed = await asUser(db, CEDRIC, async () => (await db.query("delete from public.ig_publications where id = $1 returning 1", [published])).rows);
    expect(removed).toHaveLength(0);
  });

  it("l'auteur modifie et supprime ses brouillons, pas ceux des autres", async () => {
    expect(await asUser(db, CEDRIC, async () => (await db.query("update public.ig_publications set caption = 'Nouvelle' where id = $1 returning 1", [draft])).rows)).toHaveLength(1);
    expect(await asUser(db, OTHER, async () => (await db.query("update public.ig_publications set caption = 'x' where id = $1 returning 1", [draft])).rows)).toHaveLength(0);
    await expect(asUser(db, OTHER, () => db.query("insert into public.ig_publications (created_by, kind) values ($1, 'post')", [CEDRIC]))).rejects.toThrow(/row-level security/);
  });

  it("refuse les valeurs hors format (mot-clé, lien, nombre de médias)", async () => {
    await expect(asUser(db, CEDRIC, () => db.query("insert into public.ig_publications (kind, keyword) values ('post', 'club club')"))).rejects.toThrow(/check/);
    await expect(asUser(db, CEDRIC, () => db.query("insert into public.ig_publications (kind, button_url) values ('post', 'http://x.fr')"))).rejects.toThrow(/check/);
    const eleven = JSON.stringify(Array.from({ length: 11 }, (_, i) => ({ path: `p${i}.jpg` })));
    await expect(asUser(db, CEDRIC, () => db.query("insert into public.ig_publications (kind, media) values ('post', $1)", [eleven]))).rejects.toThrow(/check/);
  });

  it("le jeton Instagram et le moteur de DM restent inaccessibles aux sessions", async () => {
    for (const table of ["ig_connection", "cta_campaigns", "cta_replies"]) {
      await expect(asUser(db, CEDRIC, () => db.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("le bucket des photos est privé", async () => {
    expect((await db.query<{ public: boolean }>("select public from storage.buckets where id = 'ig-media'")).rows[0].public).toBe(false);
  });
});
