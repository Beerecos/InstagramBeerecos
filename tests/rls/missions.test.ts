import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDatabase, createUser, type Db } from "./harness";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SALES = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let db: Db;
let org: string;
let mission: string;
let task: string;
let approval: string;

beforeAll(async () => {
  db = await createDatabase();
  for (const [id, n] of [[ADMIN, "Admin"], [SALES, "Commercial"], [OTHER, "Autre"]]) await createUser(db, id, n);
  org = await asUser(db, ADMIN, async () => (await db.query<{ id: string }>("select public.create_organization('BeeRecos', 'beerecos') as id")).rows[0].id);
  await asUser(db, OTHER, () => db.query("select public.create_organization('Autre', 'autre')"));
  await asUser(db, ADMIN, () => db.query("insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'sales')", [org, SALES]));
  mission = await asUser(db, ADMIN, async () =>
    (await db.query<{ id: string }>("insert into public.missions (organization_id, title, request, template, objective) values ($1, 'Semaine', 'Prépare ma semaine', 'weekly_content', 'obj') returning id", [org])).rows[0].id);
  task = await asUser(db, ADMIN, async () =>
    (await db.query<{ id: string }>("insert into public.mission_tasks (mission_id, organization_id, key, agent_key, title, instruction) values ($1, $2, 'copy', 'copywriter', 'Textes', 'x') returning id", [mission, org])).rows[0].id);
  // Création d'une validation par le moteur (rôle serveur).
  approval = (await db.query<{ id: string }>("insert into public.approvals (organization_id, mission_id, task_id, agent_key, title) values ($1, $2, $3, 'copywriter', 'Textes') returning id", [org, mission, task])).rows[0].id;
}, 30_000);

describe("RLS missions", () => {
  it("isole les missions par organisation", async () => {
    expect(await asUser(db, OTHER, async () => (await db.query("select * from public.missions")).rows)).toHaveLength(0);
    expect(await asUser(db, SALES, async () => (await db.query("select * from public.missions")).rows)).toHaveLength(1);
  });

  it("un commercial lit mais ne crée pas de mission et ne décide pas de validation", async () => {
    await expect(asUser(db, SALES, () => db.query("insert into public.missions (organization_id, title, request, template, objective) values ($1, 'x', 'x', 'weekly_content', 'x')", [org]))).rejects.toThrow(/row-level security/);
    const updated = await asUser(db, SALES, async () => (await db.query("update public.approvals set status = 'approved' where id = $1 returning 1", [approval])).rows);
    expect(updated).toHaveLength(0);
  });

  it("l'activité n'est pas falsifiable depuis le client", async () => {
    await expect(asUser(db, ADMIN, () => db.query("insert into public.activity_logs (organization_id, actor, message) values ($1, 'copywriter', 'faux')", [org]))).rejects.toThrow(/permission denied/);
  });

  it("un admin valide, et la décision est auditée", async () => {
    await asUser(db, ADMIN, () => db.query("update public.approvals set status = 'approved', decided_by = $2, decided_at = now() where id = $1", [approval, ADMIN]));
    const audit = await asUser(db, ADMIN, async () => (await db.query<{ action: string }>("select action from public.audit_logs where entity_id = $1", [approval])).rows);
    expect(audit.map((a) => a.action)).toEqual(["approval.approved"]);
  });

  it("refuse une dépendance d'une tâche sur elle-même", async () => {
    await expect(asUser(db, ADMIN, () => db.query("insert into public.task_dependencies (task_id, depends_on_task_id, organization_id) values ($1, $1, $2)", [task, org]))).rejects.toThrow(/check constraint/);
  });
});
