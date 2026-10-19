import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDatabase, createUser, type Db } from "./harness";

const ALICE = "11111111-1111-4111-8111-111111111111"; // admin org A
const BOB = "22222222-2222-4222-8222-222222222222"; // viewer org A
const CAROL = "33333333-3333-4333-8333-333333333333"; // admin org B

let db: Db;
let orgA: string;
let orgB: string;

beforeAll(async () => {
  db = await createDatabase();
  await createUser(db, ALICE, "Alice Martin");
  await createUser(db, BOB, "Bob Durand");
  await createUser(db, CAROL, "Carol Petit");
  orgA = await asUser(db, ALICE, async () => (await db.query<{ id: string }>("select public.create_organization('BeeRecos Lyon', 'beerecos-lyon') as id")).rows[0].id);
  orgB = await asUser(db, CAROL, async () => (await db.query<{ id: string }>("select public.create_organization('Autre réseau', 'autre') as id")).rows[0].id);
  await asUser(db, ALICE, () => db.query("insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [orgA, BOB]));
}, 30_000);

describe("RLS fondation", () => {
  it("crée le profil à l'inscription", async () => {
    const { rows } = await db.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [ALICE]);
    expect(rows[0].full_name).toBe("Alice Martin");
  });

  it("isole les organisations entre elles", async () => {
    const seenByAlice = await asUser(db, ALICE, async () => (await db.query<{ id: string }>("select id from public.organizations")).rows.map((r) => r.id));
    expect(seenByAlice).toEqual([orgA]);
    const settingsByCarol = await asUser(db, CAROL, async () => (await db.query("select * from public.organization_settings where organization_id = $1", [orgA])).rows);
    expect(settingsByCarol).toHaveLength(0);
  });

  it("refuse tout à un visiteur anonyme", async () => {
    await expect(asUser(db, null, () => db.query("select * from public.organizations"))).rejects.toThrow(/permission denied/);
  });

  it("un lecteur ne peut ni modifier les réglages ni s'ajouter des droits", async () => {
    const updated = await asUser(db, BOB, async () => (await db.query("update public.organization_settings set posts_per_week = 10 where organization_id = $1 returning 1", [orgA])).rows);
    expect(updated).toHaveLength(0);
    await expect(
      asUser(db, BOB, () => db.query("update public.memberships set role = 'admin' where user_id = $1 returning 1", [BOB]).then((r) => {
        if (r.rows.length === 0) throw new Error("row-level security: no row updated");
      })),
    ).rejects.toThrow(/row-level security/);
  });

  it("seul un admin active l'Autopilot, et c'est audité", async () => {
    await asUser(db, ALICE, () => db.query("update public.memberships set role = 'content_manager' where user_id = $1", [BOB]));
    await expect(
      asUser(db, BOB, () => db.query("update public.organization_settings set autonomy_mode = 'autopilot' where organization_id = $1", [orgA])),
    ).rejects.toThrow(/only admins/);

    await asUser(db, ALICE, () => db.query("update public.organization_settings set autonomy_mode = 'autopilot' where organization_id = $1", [orgA]));
    const audit = await asUser(db, ALICE, async () =>
      (await db.query<{ action: string; actor_id: string }>("select action, actor_id from public.audit_logs where organization_id = $1 and action = 'settings.autonomy_changed'", [orgA])).rows,
    );
    expect(audit).toEqual([{ action: "settings.autonomy_changed", actor_id: ALICE }]);
  });

  it("le journal d'audit est inaltérable et réservé aux admins", async () => {
    await expect(asUser(db, ALICE, () => db.query("insert into public.audit_logs (organization_id, action, entity_type) values ($1, 'fake', 'x')", [orgA]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, ALICE, () => db.query("delete from public.audit_logs"))).rejects.toThrow(/permission denied/);
    const forBob = await asUser(db, BOB, async () => (await db.query("select * from public.audit_logs")).rows);
    expect(forBob).toHaveLength(0);
  });

  it("log_audit refuse une organisation dont on n'est pas membre", async () => {
    await expect(asUser(db, CAROL, () => db.query("select public.log_audit($1, 'x', 'y', null)", [orgA]))).rejects.toThrow(/not a member/);
  });

  it("les tables CTA historiques restent fermées au client", async () => {
    const rows = await asUser(db, ALICE, async () => {
      try {
        return (await db.query("select * from public.cta_campaigns")).rows;
      } catch (e) {
        return String(e);
      }
    });
    expect(rows === "error: permission denied for table cta_campaigns" || (Array.isArray(rows) && rows.length === 0)).toBe(true);
  });

  it("un admin ne peut pas se retirer lui-même", async () => {
    const deleted = await asUser(db, ALICE, async () => (await db.query("delete from public.memberships where user_id = $1 returning 1", [ALICE])).rows);
    expect(deleted).toHaveLength(0);
    void orgB;
  });
});

describe("fournisseurs directs", () => {
  it("accepte LinkedIn et refuse un fournisseur inconnu", async () => {
    const orgId = (await db.query<{ id: string }>("select id from public.organizations where slug = 'beerecos-lyon'")).rows[0].id;
    await asUser(db, ALICE, () => db.query("insert into public.provider_connections (organization_id, provider) values ($1, 'linkedin')", [orgId]));
    await expect(asUser(db, ALICE, () => db.query("insert into public.provider_connections (organization_id, provider) values ($1, 'tiktok')", [orgId]))).rejects.toThrow(/check constraint/);
  });
});
