import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDatabase, createUser, type Db } from "./harness";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SALES = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let db: Db;
let org: string;
const MONTAGE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const path = () => `${org}/${MONTAGE}/prise.mp4`;

beforeAll(async () => {
  db = await createDatabase();
  for (const [id, n] of [[ADMIN, "Admin"], [SALES, "Commercial"], [OTHER, "Autre"]]) await createUser(db, id, n);
  org = await asUser(db, ADMIN, async () => (await db.query<{ id: string }>("select public.create_organization('BeeRecos', 'beerecos') as id")).rows[0].id);
  await asUser(db, OTHER, () => db.query("select public.create_organization('Autre', 'autre')"));
  await asUser(db, ADMIN, () => db.query("insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'sales')", [org, SALES]));
  await asUser(db, ADMIN, () => db.query("insert into public.montages (id, organization_id, title, video_path) values ($1, $2, 'Ma prise', $3)", [MONTAGE, org, path()]));
}, 30_000);

describe("RLS montages", () => {
  it("isole les montages par organisation", async () => {
    expect(await asUser(db, OTHER, async () => (await db.query("select * from public.montages")).rows)).toHaveLength(0);
    expect(await asUser(db, SALES, async () => (await db.query("select * from public.montages")).rows)).toHaveLength(1);
    expect(await asUser(db, null, async () => db.query("select * from public.montages").then((r) => r.rows).catch(() => "refusé"))).toBe("refusé");
  });

  it("un commercial lit mais ne crée ni ne modifie de montage", async () => {
    await expect(asUser(db, SALES, () => db.query("insert into public.montages (organization_id, title, video_path) values ($1, 'x', $2)", [org, path()]))).rejects.toThrow(/row-level security/);
    expect(await asUser(db, SALES, async () => (await db.query("update public.montages set title = 'pirate' where id = $1 returning 1", [MONTAGE])).rows)).toHaveLength(0);
  });

  it("une autre organisation ne peut pas écrire chez BeeRecos", async () => {
    await expect(asUser(db, OTHER, () => db.query("insert into public.montages (organization_id, title, video_path) values ($1, 'x', $2)", [org, path()]))).rejects.toThrow(/row-level security/);
  });

  it("refuse un chemin de prise qui sortirait du dossier du montage", async () => {
    await expect(asUser(db, ADMIN, () => db.query("insert into public.montages (organization_id, title, video_path) values ($1, 'x', $2)", [org, `${org}/../secret.mp4`]))).rejects.toThrow(/check constraint/);
  });

  it("le bucket des prises est privé", async () => {
    expect((await db.query<{ public: boolean }>("select public from storage.buckets where id = 'montages'")).rows[0].public).toBe(false);
  });
});
