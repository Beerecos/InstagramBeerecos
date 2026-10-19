import type { ActivityEvent, Approval, BrandMemory, Mission, MissionTask, TaskSpec } from "@/domain/missions/types";

export type NewMission = Pick<Mission, "organizationId" | "title" | "request" | "template" | "objective" | "createdBy"> & { tasks: TaskSpec[] };

export type TaskPatch = Partial<Pick<MissionTask, "status" | "output" | "waitingReason" | "error" | "attempts" | "startedAt" | "completedAt" | "instruction">>;

/** Persistance des missions. Deux implémentations : Supabase (production) et mémoire (démo, tests). */
export interface MissionStore {
  readonly kind: "supabase" | "memory";
  listMissions(organizationId: string): Promise<Mission[]>;
  getMission(id: string): Promise<{ mission: Mission; tasks: MissionTask[] } | null>;
  createMission(input: NewMission): Promise<{ mission: Mission; tasks: MissionTask[] }>;
  updateMission(id: string, patch: Partial<Pick<Mission, "status" | "startedAt" | "completedAt">>): Promise<void>;
  /** Mise à jour conditionnelle : n'écrit que si le statut actuel vaut `expectedStatus` (verrou optimiste). */
  updateTask(id: string, patch: TaskPatch, expectedStatus?: MissionTask["status"]): Promise<boolean>;
  listTasks(organizationId: string): Promise<(MissionTask & { missionTitle: string; isDemo: boolean })[]>;
  addActivity(organizationId: string, event: Omit<ActivityEvent, "id" | "createdAt">): Promise<void>;
  listActivity(organizationId: string, opts?: { missionId?: string; limit?: number }): Promise<ActivityEvent[]>;
  createApproval(organizationId: string, input: Pick<Approval, "missionId" | "taskId" | "agent" | "title">): Promise<Approval>;
  listApprovals(organizationId: string, status?: Approval["status"]): Promise<(Approval & { missionTitle: string; isDemo: boolean })[]>;
  getApproval(id: string): Promise<Approval | null>;
  decideApproval(id: string, patch: Pick<Approval, "status" | "comment" | "decidedBy">): Promise<boolean>;
  getBrandMemory(organizationId: string): Promise<BrandMemory>;
  saveBrandMemory(organizationId: string, memory: BrandMemory): Promise<void>;
}
