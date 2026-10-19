import { describe, expect, it } from "vitest";
import { MISSION_TEMPLATES } from "@/domain/missions/templates";
import type { AgentOutput, Approval, Capability, MissionTask } from "@/domain/missions/types";
import { agentHealth, inspectMission, WATCHDOG_PAUSE_PREFIX } from "@/domain/missions/watchdog";
import type { AIProvider } from "@/providers/ai/types";
import { advanceMission } from "@/server/missions/engine";
import { MemoryMissionStore } from "@/server/missions/memory-store";
import { runWatchdog } from "@/server/missions/watchdog-runner";

const ORG = "org-1";
const NOW = new Date("2026-10-19T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const CAPS: Set<Capability> = new Set(["llm", "web_search"]);
const out = (o: Partial<AgentOutput> = {}): AgentOutput => ({ summary: "ok", decisions: [], deliverables: [{ kind: "post", title: "Post", content: "Rejoins BeeRecos." }], limitations: [], ...o });

function okAi(): AIProvider & { count: () => number } {
  let n = 0;
  return {
    id: "fake",
    displayName: "Fake",
    capabilities: async () => ({ generateText: true, generateStructured: true, webSearch: false, analyzeImage: false, generateImage: false, generateVideo: false, transcribeAudio: false, textToSpeech: false }),
    healthCheck: async () => ({ status: "connected" }),
    generateText: async () => ({ text: "", usage: { provider: "fake", model: "fake", inputTokens: 0, outputTokens: 0 } }),
    generateStructured: async () => {
      n++;
      return { data: out() as never, sources: [], usage: { provider: "fake", model: "fake", inputTokens: 1, outputTokens: 1 } };
    },
    count: () => n,
  };
}

async function setup(template: keyof typeof MISSION_TEMPLATES = "content_ideas") {
  const store = new MemoryMissionStore();
  const t = MISSION_TEMPLATES[template];
  const { mission, tasks } = await store.createMission({ organizationId: ORG, title: t.label, request: "test", template, objective: t.objective, createdBy: null, tasks: t.tasks });
  return { store, mission, tasks };
}

const view = async (store: MemoryMissionStore, id: string, approvals: Approval[] = [], lastActivityAt: string | null = ago(0)) => {
  const { mission, tasks } = (await store.getMission(id))!;
  return { mission, tasks, approvals, lastActivityAt };
};
const codes = (r: ReturnType<typeof inspectMission>) => r.findings.map((f) => f.code);

describe("Watchdog — règles d'inspection", () => {
  it("tâche « En cours » abandonnée → remise en file", async () => {
    const { store, mission, tasks } = await setup();
    await store.updateTask(tasks[0].id, { status: "in_progress", startedAt: ago(30), attempts: 1 });
    const r = inspectMission(await view(store, mission.id), { now: NOW, capabilities: CAPS });
    const f = r.findings.find((x) => x.code === "stuck_task")!;
    expect(f.action).toEqual({ type: "reset_stuck", taskId: tasks[0].id });
    expect(r.health).toBeLessThan(100);
  });

  it("tâche récente « En cours » : rien à signaler", async () => {
    const { store, mission, tasks } = await setup();
    await store.updateTask(tasks[0].id, { status: "in_progress", startedAt: ago(1), attempts: 1 });
    expect(codes(inspectMission(await view(store, mission.id), { now: NOW, capabilities: CAPS }))).not.toContain("stuck_task");
  });

  it("erreur avec un essai restant → nouvel essai ; essais épuisés → aucune réparation", async () => {
    const { store, mission, tasks } = await setup();
    await store.updateTask(tasks[0].id, { status: "error", error: "boom", attempts: 1 });
    expect(inspectMission(await view(store, mission.id), { now: NOW, capabilities: CAPS }).findings.find((x) => x.code === "error_task")!.action.type).toBe("retry");
    await store.updateTask(tasks[0].id, { attempts: 2 });
    expect(inspectMission(await view(store, mission.id), { now: NOW, capabilities: CAPS }).findings.find((x) => x.code === "error_task")!.action.type).toBe("none");
  });

  it("un contenu refusé par un humain n'est jamais relancé", async () => {
    const { store, mission, tasks } = await setup();
    await store.updateTask(tasks[0].id, { status: "error", error: "Refusé : hors sujet", attempts: 1 });
    expect(inspectMission(await view(store, mission.id), { now: NOW, capabilities: CAPS }).findings.find((x) => x.code === "error_task")!.action.type).toBe("none");
  });

  it("attente : ressource toujours absente → alerte ; ressource connectée → relance", async () => {
    const { store, mission, tasks } = await setup();
    await store.updateTask(tasks[0].id, { status: "waiting", waitingReason: "Connexion requise : Claude." });
    expect(codes(inspectMission(await view(store, mission.id), { now: NOW, capabilities: new Set() }))).toContain("waiting_capability");
    const resolved = inspectMission(await view(store, mission.id), { now: NOW, capabilities: CAPS }).findings.find((x) => x.code === "waiting_resolved");
    expect(resolved?.action.type).toBe("relaunch");
  });

  it("travail prêt sans activité → relance ; activité récente → patience", async () => {
    const { store, mission } = await setup();
    expect(codes(inspectMission(await view(store, mission.id, [], ago(10)), { now: NOW, capabilities: CAPS }))).toContain("idle_ready_work");
    expect(codes(inspectMission(await view(store, mission.id, [], ago(0.5)), { now: NOW, capabilities: CAPS }))).not.toContain("idle_ready_work");
  });

  it("validation oubliée, livrable vide, limites et corrections de marque", async () => {
    const { store, mission, tasks } = await setup("weekly_content");
    const guardian = tasks.find((t) => t.agent === "brand_guardian")!;
    await store.updateTask(tasks[0].id, { status: "done", output: out({ deliverables: [], limitations: ["Pas de source."] }) });
    await store.updateTask(guardian.id, { status: "done", output: out({ decisions: ["Correction obligatoire (contrôle automatique) : écrire BeeRecos."] }) });
    const approval: Approval = { id: "a1", missionId: mission.id, taskId: tasks[1].id, agent: tasks[1].agent, title: "Copy", status: "pending", comment: null, decidedBy: null, decidedAt: null, createdAt: ago(60 * 30) };
    const c = codes(inspectMission(await view(store, mission.id, [approval]), { now: NOW, capabilities: CAPS }));
    expect(c).toEqual(expect.arrayContaining(["stale_approval", "empty_output", "agent_limitations", "brand_corrections"]));
  });

  it("boucle d'essais → pause de la mission", async () => {
    const { store, mission, tasks } = await setup();
    for (const t of tasks) await store.updateTask(t.id, { attempts: 4 });
    const f = inspectMission(await view(store, mission.id), { now: NOW, capabilities: CAPS }).findings.find((x) => x.code === "runaway_attempts")!;
    expect(f.action.type).toBe("pause");
  });

  it("mission terminée : santé 100, aucun constat", async () => {
    const { store, mission, tasks } = await setup();
    for (const t of tasks) await store.updateTask(t.id, { status: "done", output: out() });
    expect(inspectMission(await view(store, mission.id), { now: NOW, capabilities: CAPS })).toEqual({ missionId: mission.id, health: 100, findings: [] });
  });

  it("santé d'un agent", () => {
    const t = (status: MissionTask["status"]) => ({ agent: "copywriter", status }) as MissionTask;
    expect(agentHealth([t("done"), t("error"), t("done"), t("waiting")], "copywriter")).toMatchObject({ health: 63, errors: 1, stuck: 1, total: 4 });
    expect(agentHealth([], "copywriter").health).toBeNull();
  });
});

describe("Watchdog — interventions", () => {
  it("répare une tâche abandonnée, journalise et relance l'équipe jusqu'au bout", async () => {
    const { store, mission, tasks } = await setup();
    await store.updateTask(tasks[0].id, { status: "in_progress", startedAt: ago(30), attempts: 1 });
    const ai = okAi();
    const res = await runWatchdog({ store, orgId: ORG, ai, capabilities: CAPS, now: NOW });
    expect(res.relaunched).toEqual([mission.id]);
    expect((await store.getMission(mission.id))!.mission.status).not.toBe("planned");
    expect(ai.count()).toBeGreaterThan(0);
    const log = await store.listActivity(ORG, { missionId: mission.id });
    expect(log.some((e) => e.actor === "watchdog" && e.message.includes("remets la tâche en file"))).toBe(true);
  });

  it("idempotent : une seconde tournée ne réexécute rien", async () => {
    const { store, mission, tasks } = await setup();
    await store.updateTask(tasks[0].id, { status: "in_progress", startedAt: ago(30), attempts: 1 });
    const ai = okAi();
    await runWatchdog({ store, orgId: ORG, ai, capabilities: CAPS, now: NOW });
    const calls = ai.count();
    const second = await runWatchdog({ store, orgId: ORG, ai, capabilities: CAPS, now: new Date() });
    expect(ai.count()).toBe(calls);
    expect(second.actions).toBe(0);
    expect((await store.getMission(mission.id))!.tasks.every((t) => t.status !== "in_progress")).toBe(true);
  });

  it("pause : le moteur n'exécute plus la mission et la pause n'est posée qu'une fois", async () => {
    const { store, mission, tasks } = await setup();
    for (const t of tasks) await store.updateTask(t.id, { attempts: 4 });
    const ai = okAi();
    await runWatchdog({ store, orgId: ORG, ai, capabilities: CAPS, now: NOW });
    const after = (await store.getMission(mission.id))!.tasks;
    expect(after.every((t) => t.status === "waiting" && t.waitingReason?.startsWith(WATCHDOG_PAUSE_PREFIX))).toBe(true);
    await advanceMission(mission.id, { store, ai, capabilities: CAPS });
    expect(ai.count()).toBe(0);
    const again = await runWatchdog({ store, orgId: ORG, ai, capabilities: CAPS, now: NOW });
    expect(again.actions).toBe(0);
    expect((await store.listActivity(ORG, { missionId: mission.id })).filter((e) => e.actor === "watchdog")).toHaveLength(1);
  });

  it("missions de démonstration : inspectées, jamais modifiées", async () => {
    const store = new MemoryMissionStore();
    const t = MISSION_TEMPLATES.content_ideas;
    const { mission, tasks } = await store.createMission({ organizationId: ORG, title: t.label, request: "x", template: "content_ideas", objective: t.objective, createdBy: null, tasks: t.tasks }, { isDemo: true });
    await store.updateTask(tasks[0].id, { status: "in_progress", startedAt: ago(30), attempts: 1 });
    const ai = okAi();
    const res = await runWatchdog({ store, orgId: ORG, ai, capabilities: CAPS, now: NOW });
    expect(res.inspections[0].findings.length).toBeGreaterThan(0);
    expect(res.actions).toBe(0);
    expect(ai.count()).toBe(0);
    expect((await store.getMission(mission.id))!.tasks[0].status).toBe("in_progress");
  });
});
