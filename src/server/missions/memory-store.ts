import { randomUUID } from "node:crypto";
import { DEFAULT_BRAND_MEMORY } from "@/domain/missions/brand-defaults";
import type { ActivityEvent, Approval, BrandMemory, Mission, MissionTask } from "@/domain/missions/types";
import type { MissionStore, NewMission, TaskPatch } from "./store";

type State = {
  missions: Map<string, Mission>;
  tasks: Map<string, MissionTask>;
  activity: (ActivityEvent & { organizationId: string })[];
  approvals: Map<string, Approval & { organizationId: string }>;
  brand: Map<string, BrandMemory>;
};

/** Stockage en mémoire (mode démo sans Supabase, et tests). Non persistant entre redémarrages. */
export class MemoryMissionStore implements MissionStore {
  readonly kind = "memory" as const;
  private s: State = { missions: new Map(), tasks: new Map(), activity: [], approvals: new Map(), brand: new Map() };

  constructor(private readonly now: () => Date = () => new Date()) {}

  private ts() {
    return this.now().toISOString();
  }

  async listMissions(organizationId: string) {
    return [...this.s.missions.values()].filter((m) => m.organizationId === organizationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getMission(id: string) {
    const mission = this.s.missions.get(id);
    if (!mission) return null;
    const tasks = [...this.s.tasks.values()].filter((t) => t.missionId === id).sort((a, b) => a.position - b.position);
    return { mission: { ...mission }, tasks: tasks.map((t) => ({ ...t })) };
  }

  async createMission(input: NewMission, opts: { isDemo?: boolean; id?: string; createdAt?: string } = {}) {
    const id = opts.id ?? randomUUID();
    const createdAt = opts.createdAt ?? this.ts();
    const mission: Mission = {
      id,
      organizationId: input.organizationId,
      title: input.title,
      request: input.request,
      template: input.template,
      objective: input.objective,
      status: "planned",
      isDemo: opts.isDemo ?? false,
      createdBy: input.createdBy,
      createdAt,
      startedAt: null,
      completedAt: null,
    };
    this.s.missions.set(id, mission);
    const idByKey = new Map(input.tasks.map((t) => [t.key, randomUUID()]));
    const tasks = input.tasks.map<MissionTask>((spec, position) => ({
      id: idByKey.get(spec.key)!,
      missionId: id,
      key: spec.key,
      agent: spec.agent,
      title: spec.title,
      instruction: spec.instruction,
      status: "todo",
      needs: spec.needs,
      requiresApproval: Boolean(spec.requiresApproval),
      dependsOn: spec.dependsOn.map((k) => idByKey.get(k)!),
      output: null,
      waitingReason: null,
      error: null,
      attempts: 0,
      position,
      createdAt,
      startedAt: null,
      completedAt: null,
    }));
    for (const t of tasks) this.s.tasks.set(t.id, t);
    return { mission: { ...mission }, tasks };
  }

  async updateMission(id: string, patch: Partial<Pick<Mission, "status" | "startedAt" | "completedAt">>) {
    const m = this.s.missions.get(id);
    if (m) this.s.missions.set(id, { ...m, ...patch });
  }

  async updateTask(id: string, patch: TaskPatch, expectedStatus?: MissionTask["status"]) {
    const t = this.s.tasks.get(id);
    if (!t || (expectedStatus && t.status !== expectedStatus)) return false;
    this.s.tasks.set(id, { ...t, ...patch });
    return true;
  }

  async listTasks(organizationId: string) {
    return [...this.s.tasks.values()].flatMap((t) => {
      const m = this.s.missions.get(t.missionId);
      return m && m.organizationId === organizationId ? [{ ...t, missionTitle: m.title, isDemo: m.isDemo }] : [];
    });
  }

  async addActivity(organizationId: string, event: Omit<ActivityEvent, "id" | "createdAt">, createdAt?: string) {
    this.s.activity.push({ ...event, organizationId, id: randomUUID(), createdAt: createdAt ?? this.ts() });
  }

  async listActivity(organizationId: string, opts: { missionId?: string; limit?: number } = {}) {
    return this.s.activity
      .filter((e) => e.organizationId === organizationId && (!opts.missionId || e.missionId === opts.missionId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, opts.limit ?? 100)
      .map((e) => withoutOrg(e));
  }

  async createApproval(organizationId: string, input: Pick<Approval, "missionId" | "taskId" | "agent" | "title">, createdAt?: string) {
    const a: Approval & { organizationId: string } = { ...input, organizationId, id: randomUUID(), status: "pending", comment: null, decidedBy: null, decidedAt: null, createdAt: createdAt ?? this.ts() };
    this.s.approvals.set(a.id, a);
    return withoutOrg(a);
  }

  async listApprovals(organizationId: string, status?: Approval["status"]) {
    return [...this.s.approvals.values()]
      .filter((a) => a.organizationId === organizationId && (!status || a.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => {
        const a = withoutOrg(row);
        const m = this.s.missions.get(a.missionId);
        return { ...a, missionTitle: m?.title ?? "", isDemo: m?.isDemo ?? false };
      });
  }

  async getApproval(id: string) {
    const a = this.s.approvals.get(id);
    return a ? withoutOrg(a) : null;
  }

  async decideApproval(id: string, patch: Pick<Approval, "status" | "comment" | "decidedBy">) {
    const a = this.s.approvals.get(id);
    if (!a || a.status !== "pending") return false;
    this.s.approvals.set(id, { ...a, ...patch, decidedAt: this.ts() });
    return true;
  }

  async getBrandMemory(organizationId: string) {
    return structuredClone(this.s.brand.get(organizationId) ?? DEFAULT_BRAND_MEMORY);
  }

  async saveBrandMemory(organizationId: string, memory: BrandMemory) {
    this.s.brand.set(organizationId, structuredClone(memory));
  }
}

function withoutOrg<T extends { organizationId: string }>(row: T): Omit<T, "organizationId"> {
  const copy: Partial<T> = { ...row };
  delete copy.organizationId;
  return copy as Omit<T, "organizationId">;
}
