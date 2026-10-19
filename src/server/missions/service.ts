import "server-only";
import { after } from "next/server";
import { AGENTS } from "@/domain/missions/agents";
import { planFromRequest } from "@/domain/missions/planner";
import type { Approval, BrandMemory, Mission } from "@/domain/missions/types";
import { isDemoMode, serverEnv } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AnthropicProvider } from "@/providers/ai/anthropic";
import type { AIProvider } from "@/providers/ai/types";
import { getCurrentUser, requirePermission, type CurrentUser } from "@/server/auth/dal";
import { availableCapabilities } from "./capabilities";
import { seedDemo } from "./demo-seed";
import { advanceMission } from "./engine";
import { inspect, runWatchdog } from "./watchdog-runner";
import { WATCHDOG_PAUSE_PREFIX } from "@/domain/missions/watchdog";
import { MemoryMissionStore } from "./memory-store";
import type { MissionStore } from "./store";
import { SupabaseMissionStore } from "./supabase-store";

const g = globalThis as unknown as { __bmDemoStore?: Promise<MemoryMissionStore> };

async function demoStore(orgId: string): Promise<MemoryMissionStore> {
  g.__bmDemoStore ??= (async () => {
    const s = new MemoryMissionStore();
    await seedDemo(s, orgId);
    return s;
  })();
  return g.__bmDemoStore;
}

function requireOrg(user: CurrentUser): string {
  if (!user.organization) throw new Error("Aucune organisation : terminez la configuration dans /bienvenue.");
  return user.organization.id;
}

/** Stockage lié à l'utilisateur (RLS). */
export async function userStore(): Promise<{ store: MissionStore; orgId: string; user: CurrentUser }> {
  const user = await getCurrentUser();
  const orgId = requireOrg(user);
  if (isDemoMode()) return { store: await demoStore(orgId), orgId, user };
  return { store: new SupabaseMissionStore(await createSupabaseServerClient()), orgId, user };
}

/** Stockage du moteur : client serveur, à n'utiliser qu'après vérification des droits. */
async function engineStore(orgId: string): Promise<MissionStore> {
  if (isDemoMode()) return demoStore(orgId);
  return new SupabaseMissionStore(createSupabaseAdminClient());
}

function aiProvider(): AIProvider | null {
  const env = serverEnv();
  return env.ANTHROPIC_API_KEY ? new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL }) : null;
}

function runInBackground(orgId: string, missionId: string) {
  after(async () => {
    const store = await engineStore(orgId);
    try {
      await advanceMission(missionId, { store, ai: aiProvider(), capabilities: availableCapabilities(serverEnv()) });
    } catch (e) {
      await store.addActivity(orgId, { missionId, taskId: null, actor: "system", message: `Arrêt du moteur : ${e instanceof Error ? e.message : String(e)}` });
    }
  });
}

/** Queen Bee : comprend la demande, crée la mission et son graphe de tâches, puis lance l'équipe. */
export async function createMissionFromRequest(request: string): Promise<Mission> {
  const user = await requirePermission("content:edit");
  const orgId = requireOrg(user);
  const store = await engineStore(orgId);
  const plan = planFromRequest(request);
  const { mission, tasks } = await store.createMission({ organizationId: orgId, title: plan.title, request, template: plan.template, objective: plan.objective, createdBy: user.demo ? null : user.id, tasks: plan.tasks });
  const agents = [...new Set(tasks.map((t) => AGENTS[t.agent].name))];
  await store.addActivity(orgId, { missionId: mission.id, taskId: null, actor: "queen_bee", message: `Queen Bee crée la mission. ${plan.reason} Équipe mobilisée : ${agents.join(", ")}.` });
  runInBackground(orgId, mission.id);
  return mission;
}

export async function resumeMission(missionId: string): Promise<void> {
  const user = await requirePermission("content:edit");
  const orgId = requireOrg(user);
  const store = await engineStore(orgId);
  const loaded = await store.getMission(missionId);
  if (!loaded || loaded.mission.organizationId !== orgId) throw new Error("Mission introuvable.");
  // Relance humaine : lève les pauses posées par le Chien de garde.
  for (const t of loaded.tasks.filter((x) => x.waitingReason?.startsWith(WATCHDOG_PAUSE_PREFIX))) {
    await store.updateTask(t.id, { status: "todo", waitingReason: null, attempts: 0 }, "waiting");
  }
  await store.addActivity(orgId, { missionId, taskId: null, actor: "user", message: "Équipe relancée." });
  runInBackground(orgId, missionId);
}

export type ApprovalAction = "approve" | "request_changes" | "reject";

/** Décision humaine. Garantie côté serveur : seuls les rôles autorisés décident, et une seule fois. */
export async function decideApproval(approvalId: string, action: ApprovalAction, comment: string | null): Promise<void> {
  const user = await requirePermission("content:approve");
  const orgId = requireOrg(user);
  const store = await engineStore(orgId);
  const approval = await store.getApproval(approvalId);
  if (!approval) throw new Error("Validation introuvable.");
  const loaded = await store.getMission(approval.missionId);
  if (!loaded || loaded.mission.organizationId !== orgId) throw new Error("Validation introuvable.");
  const task = loaded.tasks.find((t) => t.id === approval.taskId)!;

  const status: Approval["status"] = action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested";
  const decided = await store.decideApproval(approvalId, { status, comment, decidedBy: user.demo ? null : user.id });
  if (!decided) throw new Error("Cette validation a déjà été traitée.");

  if (action === "approve") {
    await store.updateTask(task.id, { status: "validated" }, "to_validate");
    await store.addActivity(orgId, { missionId: task.missionId, taskId: task.id, actor: "user", message: `Validé : « ${task.title} ».` });
  } else if (action === "reject") {
    await store.updateTask(task.id, { status: "error", error: `Refusé${comment ? ` : ${comment}` : "."}` }, "to_validate");
    await store.addActivity(orgId, { missionId: task.missionId, taskId: task.id, actor: "user", message: `Refusé : « ${task.title} »${comment ? ` — ${comment}` : ""}.` });
  } else {
    const instruction = `${task.instruction}\n\nNouvelle version demandée par l'utilisateur${comment ? ` : ${comment}` : " (proposer une variante différente)"}.`;
    await store.updateTask(task.id, { status: "todo", output: null, instruction }, "to_validate");
    await store.addActivity(orgId, { missionId: task.missionId, taskId: task.id, actor: "user", message: `Nouvelle version demandée pour « ${task.title} »${comment ? ` : ${comment}` : ""}.` });
  }
  runInBackground(orgId, task.missionId);
}

export async function saveBrandMemory(memory: BrandMemory): Promise<void> {
  const user = await requirePermission("settings:manage");
  const orgId = requireOrg(user);
  const store = await engineStore(orgId);
  await store.saveBrandMemory(orgId, memory);
  await store.addActivity(orgId, { missionId: null, taskId: null, actor: "user", message: "Mémoire de marque mise à jour." });
}

export function engineStatus() {
  const env = serverEnv();
  return { llm: Boolean(env.ANTHROPIC_API_KEY), model: env.ANTHROPIC_MODEL ?? "claude-opus-5-5", capabilities: [...availableCapabilities(env)] };
}

export type AutonomyMode = "manual" | "validation" | "autopilot";

/** Mode d'autonomie réellement enregistré (organization_settings) ; « manuel » par défaut et en démo. */
export async function currentAutonomyMode(): Promise<AutonomyMode> {
  const user = await getCurrentUser();
  if (isDemoMode() || !user.organization) return "manual";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("organization_settings").select("autonomy_mode").eq("organization_id", user.organization.id).maybeSingle();
  return (data?.autonomy_mode as AutonomyMode | undefined) ?? "manual";
}

const lastWatchdogRun = (globalThis as unknown as { __bmWatchdog?: Map<string, number> }).__bmWatchdog ??= new Map();
const WATCHDOG_MIN_INTERVAL_MS = 3 * 60_000;

/** Tournée du Chien de garde pour l'organisation de l'utilisateur (bouton, ou impulsion périodique de l'interface). */
export async function runWatchdogNow(opts: { force?: boolean } = {}) {
  const user = await requirePermission("content:edit");
  const orgId = requireOrg(user);
  const last = lastWatchdogRun.get(orgId) ?? 0;
  if (!opts.force && Date.now() - last < WATCHDOG_MIN_INTERVAL_MS) return { skipped: true as const };
  lastWatchdogRun.set(orgId, Date.now());
  const res = await runWatchdog({ store: await engineStore(orgId), orgId, ai: aiProvider(), capabilities: availableCapabilities(serverEnv()) });
  return { skipped: false as const, actions: res.actions, relaunched: res.relaunched.length, inspected: res.inspections.length };
}

/** Tournée planifiée (cron) sur toutes les organisations. */
export async function runWatchdogAllOrganizations() {
  const caps = availableCapabilities(serverEnv());
  if (isDemoMode()) return [];
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("organizations").select("id");
  if (error) throw new Error(error.message);
  const store = new SupabaseMissionStore(admin);
  const out = [];
  for (const { id } of data ?? []) {
    const r = await runWatchdog({ store, orgId: id as string, ai: aiProvider(), capabilities: caps });
    out.push({ organizationId: id as string, actions: r.actions, relaunched: r.relaunched.length, inspected: r.inspections.length });
  }
  return out;
}

/** Inspections en lecture seule pour l'affichage. */
export async function watchdogReport() {
  const { store, orgId } = await userStore();
  const caps = availableCapabilities(serverEnv());
  const missions = await store.listMissions(orgId);
  const inspections = [];
  for (const m of missions) {
    const i = await inspect(store, orgId, m.id, caps);
    if (i) inspections.push({ mission: m, ...i });
  }
  const activity = (await store.listActivity(orgId, { limit: 300 })).filter((e) => e.actor === "watchdog").slice(0, 20);
  return { inspections, activity, tasks: await store.listTasks(orgId) };
}

export async function missionWatchdog(missionId: string) {
  const { store, orgId } = await userStore();
  const loaded = await store.getMission(missionId);
  if (!loaded || loaded.mission.organizationId !== orgId) return null;
  return inspect(store, orgId, missionId, availableCapabilities(serverEnv()));
}
