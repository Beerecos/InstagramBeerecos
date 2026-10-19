import "server-only";
import { AGENT_KEYS, type AgentKey, type Deliverable, type MissionTask, type WorkerAgentKey } from "@/domain/missions/types";
import { progress } from "@/domain/missions/graph";
import { AGENTS } from "@/domain/missions/agents";
import { userStore, watchdogReport } from "./service";

export async function listMissions() {
  const { store, orgId } = await userStore();
  const missions = await store.listMissions(orgId);
  const tasks = await store.listTasks(orgId);
  return missions.map((m) => {
    const own = tasks.filter((t) => t.missionId === m.id);
    return { ...m, progress: progress(own), agents: [...new Set(own.map((t) => t.agent))] as AgentKey[] };
  });
}

export async function getMissionWorkspace(id: string) {
  const { store, orgId } = await userStore();
  const loaded = await store.getMission(id);
  if (!loaded || loaded.mission.organizationId !== orgId) return null;
  const [activity, approvals] = await Promise.all([store.listActivity(orgId, { missionId: id, limit: 200 }), store.listApprovals(orgId)]);
  return { ...loaded, activity, approvals: approvals.filter((a) => a.missionId === id), progress: progress(loaded.tasks) };
}

export type AgentState = {
  agent: WorkerAgentKey;
  state: "working" | "waiting_validation" | "blocked" | "idle";
  current: (MissionTask & { missionTitle: string; isDemo: boolean }) | null;
  done: number;
  total: number;
  lastAction: string | null;
};

export async function getTeam(): Promise<AgentState[]> {
  const { store, orgId } = await userStore();
  const [tasks, activity] = await Promise.all([store.listTasks(orgId), store.listActivity(orgId, { limit: 300 })]);
  return AGENT_KEYS.filter((k): k is WorkerAgentKey => k !== "queen_bee" && k !== "watchdog").map((agent) => {
    const own = tasks.filter((t) => t.agent === agent);
    const pick = (s: MissionTask["status"][]) => own.find((t) => s.includes(t.status)) ?? null;
    const working = pick(["in_progress", "analysis"]);
    const validating = pick(["to_validate"]);
    const blocked = pick(["waiting", "error"]);
    const current = working ?? validating ?? blocked ?? null;
    return {
      agent,
      state: working ? "working" : validating ? "waiting_validation" : blocked ? "blocked" : "idle",
      current,
      done: own.filter((t) => ["done", "validated", "scheduled", "published"].includes(t.status)).length,
      total: own.length,
      lastAction: activity.find((e) => e.actor === agent)?.message ?? null,
    };
  });
}

export async function getApprovalsInbox() {
  const { store, orgId } = await userStore();
  const [approvals, tasks] = await Promise.all([store.listApprovals(orgId), store.listTasks(orgId)]);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return approvals.map((a) => ({ ...a, task: byId.get(a.taskId) ?? null }));
}

export type StudioItem = Deliverable & { id: string; missionId: string; missionTitle: string; agent: AgentKey; taskStatus: MissionTask["status"]; isDemo: boolean };

/** Contenus produits par l'équipe (livrables des tâches), avec le statut réel de leur tâche. */
export async function getStudioItems(): Promise<StudioItem[]> {
  const { store, orgId } = await userStore();
  const tasks = await store.listTasks(orgId);
  return tasks.flatMap((t) =>
    (t.output?.deliverables ?? []).map((d, i) => ({ ...d, id: `${t.id}:${i}`, missionId: t.missionId, missionTitle: t.missionTitle, agent: t.agent, taskStatus: t.status, isDemo: t.isDemo })),
  );
}

export async function getDashboard() {
  const { store, orgId } = await userStore();
  const [missions, tasks, approvals, activity] = await Promise.all([store.listMissions(orgId), store.listTasks(orgId), store.listApprovals(orgId, "pending"), store.listActivity(orgId, { limit: 8 })]);
  return {
    pendingApprovals: approvals.length,
    activeMissions: missions.filter((m) => m.status !== "done").length,
    activeAgents: new Set(tasks.filter((t) => t.status === "in_progress" || t.status === "analysis").map((t) => t.agent)).size,
    urgent: tasks.filter((t) => t.status === "waiting" || t.status === "error").slice(0, 5),
    activity,
    hasDemo: missions.some((m) => m.isDemo),
  };
}

export async function getBrand() {
  const { store, orgId, user } = await userStore();
  return { memory: await store.getBrandMemory(orgId), user };
}

export async function getNotifications() {
  const { store, orgId } = await userStore();
  const [approvals, tasks] = await Promise.all([store.listApprovals(orgId, "pending"), store.listTasks(orgId)]);
  const items: { id: string; text: string; href: string }[] = [];
  if (approvals.length) items.push({ id: "approvals", text: `${approvals.length} contenu${approvals.length > 1 ? "s attendent" : " attend"} votre validation.`, href: "/approvals" });
  for (const t of tasks.filter((x) => x.status === "waiting").slice(0, 3)) items.push({ id: t.id, text: `${t.title} : ${t.waitingReason ?? "en attente"}`, href: `/missions/${t.missionId}` });
  for (const t of tasks.filter((x) => x.status === "error").slice(0, 3)) items.push({ id: t.id, text: `Erreur sur « ${t.title} »`, href: `/missions/${t.missionId}` });
  return items;
}

export type HiveAgent = { key: AgentKey; name: string; role: string; state: AgentState["state"]; detail: string | null; missionId: string | null; isDemo: boolean };

/** État de chaque agent pour la Ruche (bureau pixel) : uniquement des statuts réels de tâches. */
export async function getHive(): Promise<HiveAgent[]> {
  const [team, guard] = await Promise.all([getTeam(), watchdogReport()]);
  const critical = guard.inspections.filter((i) => i.mission.status !== "done").flatMap((i) => i.findings).filter((f) => f.severity === "critical");
  const anyWorking = team.some((a) => a.state === "working");
  return [
    { key: "queen_bee", name: AGENTS.queen_bee.name, role: AGENTS.queen_bee.role, state: anyWorking ? "working" : "idle", detail: anyWorking ? "Coordonne l'équipe" : null, missionId: null, isDemo: false },
    { key: "watchdog", name: AGENTS.watchdog.name, role: AGENTS.watchdog.role, state: critical.length ? "blocked" : "idle", detail: critical[0]?.message ?? "Fait sa ronde : rien à signaler", missionId: critical[0]?.missionId ?? null, isDemo: false },
    ...team.map((a) => ({
      key: a.agent,
      name: AGENTS[a.agent].name,
      role: AGENTS[a.agent].role,
      state: a.state,
      detail: a.current ? `« ${a.current.title} »${a.current.waitingReason ? ` — ${a.current.waitingReason}` : ""}` : null,
      missionId: a.current?.missionId ?? null,
      isDemo: a.current?.isDemo ?? false,
    })),
  ];
}
