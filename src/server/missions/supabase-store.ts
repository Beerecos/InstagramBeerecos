import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BRAND_MEMORY } from "@/domain/missions/brand-defaults";
import type { ActivityEvent, AgentKey, AgentOutput, Approval, BrandMemory, Capability, Mission, MissionTask } from "@/domain/missions/types";
import type { MissionStore, NewMission, TaskPatch } from "./store";

type Row = Record<string, unknown>;

const toMission = (r: Row): Mission => ({
  id: r.id as string,
  organizationId: r.organization_id as string,
  title: r.title as string,
  request: r.request as string,
  template: r.template as Mission["template"],
  objective: r.objective as string,
  status: r.status as Mission["status"],
  isDemo: r.is_demo as boolean,
  createdBy: (r.created_by as string | null) ?? null,
  createdAt: r.created_at as string,
  startedAt: (r.started_at as string | null) ?? null,
  completedAt: (r.completed_at as string | null) ?? null,
});

const toTask = (r: Row, deps: string[]): MissionTask => ({
  id: r.id as string,
  missionId: r.mission_id as string,
  key: r.key as string,
  agent: r.agent_key as MissionTask["agent"],
  title: r.title as string,
  instruction: r.instruction as string,
  status: r.status as MissionTask["status"],
  needs: (r.needs as Capability[]) ?? [],
  requiresApproval: r.requires_approval as boolean,
  dependsOn: deps,
  output: (r.output as AgentOutput | null) ?? null,
  waitingReason: (r.waiting_reason as string | null) ?? null,
  error: (r.error as string | null) ?? null,
  attempts: r.attempts as number,
  position: r.position as number,
  createdAt: r.created_at as string,
  startedAt: (r.started_at as string | null) ?? null,
  completedAt: (r.completed_at as string | null) ?? null,
});

const toApproval = (r: Row): Approval => ({
  id: r.id as string,
  missionId: r.mission_id as string,
  taskId: r.task_id as string,
  agent: r.agent_key as AgentKey,
  title: r.title as string,
  status: r.status as Approval["status"],
  comment: (r.comment as string | null) ?? null,
  decidedBy: (r.decided_by as string | null) ?? null,
  decidedAt: (r.decided_at as string | null) ?? null,
  createdAt: r.created_at as string,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase : ${res.error.message}`);
  return res.data;
}

const TASK_COLUMNS: Record<keyof TaskPatch, string> = {
  status: "status",
  output: "output",
  waitingReason: "waiting_reason",
  error: "error",
  attempts: "attempts",
  startedAt: "started_at",
  completedAt: "completed_at",
  instruction: "instruction",
};

/**
 * Stockage Supabase. Avec le client utilisateur, la RLS s'applique ; le moteur utilise le client serveur
 * (clé secrète) uniquement après vérification des droits de l'utilisateur sur l'organisation.
 */
export class SupabaseMissionStore implements MissionStore {
  readonly kind = "supabase" as const;
  constructor(private readonly db: SupabaseClient) {}

  async listMissions(organizationId: string) {
    const rows = check(await this.db.from("missions").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200));
    return (rows ?? []).map(toMission);
  }

  async getMission(id: string) {
    const m = check(await this.db.from("missions").select("*").eq("id", id).maybeSingle());
    if (!m) return null;
    const tasks = check(await this.db.from("mission_tasks").select("*").eq("mission_id", id).order("position")) ?? [];
    const ids = tasks.map((t: Row) => t.id as string);
    const deps = ids.length ? check(await this.db.from("task_dependencies").select("task_id, depends_on_task_id").in("task_id", ids)) ?? [] : [];
    const depMap = new Map<string, string[]>();
    for (const d of deps as Row[]) depMap.set(d.task_id as string, [...(depMap.get(d.task_id as string) ?? []), d.depends_on_task_id as string]);
    return { mission: toMission(m), tasks: tasks.map((t: Row) => toTask(t, depMap.get(t.id as string) ?? [])) };
  }

  async createMission(input: NewMission) {
    const m = check(
      await this.db
        .from("missions")
        .insert({ organization_id: input.organizationId, title: input.title, request: input.request, template: input.template, objective: input.objective, created_by: input.createdBy })
        .select("*")
        .single(),
    );
    const rows = check(
      await this.db
        .from("mission_tasks")
        .insert(input.tasks.map((t, position) => ({
          mission_id: m.id,
          organization_id: input.organizationId,
          key: t.key,
          agent_key: t.agent,
          title: t.title,
          instruction: t.instruction,
          needs: t.needs,
          requires_approval: Boolean(t.requiresApproval),
          position,
        })))
        .select("id, key"),
    ) as Row[];
    const idByKey = new Map(rows.map((r) => [r.key as string, r.id as string]));
    const deps = input.tasks.flatMap((t) => t.dependsOn.map((d) => ({ task_id: idByKey.get(t.key), depends_on_task_id: idByKey.get(d), organization_id: input.organizationId })));
    if (deps.length) check(await this.db.from("task_dependencies").insert(deps));
    return (await this.getMission(m.id as string))!;
  }

  async updateMission(id: string, patch: Partial<Pick<Mission, "status" | "startedAt" | "completedAt">>) {
    const row: Row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.startedAt !== undefined) row.started_at = patch.startedAt;
    if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
    check(await this.db.from("missions").update(row).eq("id", id));
  }

  async updateTask(id: string, patch: TaskPatch, expectedStatus?: MissionTask["status"]) {
    const row: Row = {};
    for (const [k, v] of Object.entries(patch)) row[TASK_COLUMNS[k as keyof TaskPatch]] = v;
    let q = this.db.from("mission_tasks").update(row).eq("id", id);
    if (expectedStatus) q = q.eq("status", expectedStatus);
    const rows = check(await q.select("id"));
    return (rows ?? []).length > 0;
  }

  async listTasks(organizationId: string) {
    const rows = check(await this.db.from("mission_tasks").select("*, missions(title, is_demo)").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(500)) ?? [];
    return (rows as Row[]).map((r) => {
      const m = r.missions as { title: string; is_demo: boolean } | null;
      return { ...toTask(r, []), missionTitle: m?.title ?? "", isDemo: m?.is_demo ?? false };
    });
  }

  async addActivity(organizationId: string, e: Omit<ActivityEvent, "id" | "createdAt">) {
    check(await this.db.from("activity_logs").insert({ organization_id: organizationId, mission_id: e.missionId, task_id: e.taskId, actor: e.actor, message: e.message.slice(0, 2000) }));
  }

  async listActivity(organizationId: string, opts: { missionId?: string; limit?: number } = {}) {
    let q = this.db.from("activity_logs").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(opts.limit ?? 100);
    if (opts.missionId) q = q.eq("mission_id", opts.missionId);
    return ((check(await q) ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      missionId: (r.mission_id as string | null) ?? null,
      taskId: (r.task_id as string | null) ?? null,
      actor: r.actor as ActivityEvent["actor"],
      message: r.message as string,
      createdAt: r.created_at as string,
    }));
  }

  async createApproval(organizationId: string, input: Pick<Approval, "missionId" | "taskId" | "agent" | "title">) {
    const r = check(await this.db.from("approvals").insert({ organization_id: organizationId, mission_id: input.missionId, task_id: input.taskId, agent_key: input.agent, title: input.title }).select("*").single());
    return toApproval(r);
  }

  async listApprovals(organizationId: string, status?: Approval["status"]) {
    let q = this.db.from("approvals").select("*, missions(title, is_demo)").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200);
    if (status) q = q.eq("status", status);
    return ((check(await q) ?? []) as Row[]).map((r) => {
      const m = r.missions as { title: string; is_demo: boolean } | null;
      return { ...toApproval(r), missionTitle: m?.title ?? "", isDemo: m?.is_demo ?? false };
    });
  }

  async getApproval(id: string) {
    const r = check(await this.db.from("approvals").select("*").eq("id", id).maybeSingle());
    return r ? toApproval(r) : null;
  }

  async decideApproval(id: string, patch: Pick<Approval, "status" | "comment" | "decidedBy">) {
    const rows = check(
      await this.db
        .from("approvals")
        .update({ status: patch.status, comment: patch.comment, decided_by: patch.decidedBy, decided_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending")
        .select("id"),
    );
    return (rows ?? []).length > 0;
  }

  async getBrandMemory(organizationId: string): Promise<BrandMemory> {
    const r = check(await this.db.from("brand_memory").select("memory").eq("organization_id", organizationId).maybeSingle());
    return { ...DEFAULT_BRAND_MEMORY, ...((r?.memory as Partial<BrandMemory>) ?? {}) };
  }

  async saveBrandMemory(organizationId: string, memory: BrandMemory) {
    check(await this.db.from("brand_memory").upsert({ organization_id: organizationId, memory, updated_at: new Date().toISOString() }));
  }
}
