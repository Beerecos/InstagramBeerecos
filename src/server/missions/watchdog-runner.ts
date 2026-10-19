import { inspectMission, WATCHDOG_PAUSE_PREFIX, type MissionInspection } from "@/domain/missions/watchdog";
import type { Capability } from "@/domain/missions/types";
import type { AIProvider } from "@/providers/ai/types";
import { advanceMission } from "./engine";
import type { MissionStore } from "./store";

export type WatchdogRunResult = { inspections: MissionInspection[]; actions: number; relaunched: string[] };

/** Inspecte l'état réel d'une mission (lecture seule). */
export async function inspect(store: MissionStore, orgId: string, missionId: string, capabilities: ReadonlySet<Capability>, now = new Date()) {
  const loaded = await store.getMission(missionId);
  if (!loaded) return null;
  const [approvals, last] = await Promise.all([store.listApprovals(orgId), store.listActivity(orgId, { missionId, limit: 1 })]);
  return inspectMission({ ...loaded, approvals: approvals.filter((a) => a.missionId === missionId), lastActivityAt: last[0]?.createdAt ?? null }, { now, capabilities });
}

/**
 * Tournée du Chien de garde sur toutes les missions actives d'une organisation : applique les réparations sûres
 * (tâche abandonnée, essai restant, travail prêt non exécuté, boucle d'essais), journalise chaque intervention,
 * puis relance le moteur. Les missions de démonstration sont inspectées mais jamais modifiées.
 * Idempotent : chaque modification est conditionnée au statut observé.
 */
export async function runWatchdog(deps: { store: MissionStore; orgId: string; ai: AIProvider | null; capabilities: ReadonlySet<Capability>; now?: Date }): Promise<WatchdogRunResult> {
  const { store, orgId, capabilities } = deps;
  const now = deps.now ?? new Date();
  const result: WatchdogRunResult = { inspections: [], actions: 0, relaunched: [] };
  const log = (missionId: string, taskId: string | null, message: string) => store.addActivity(orgId, { missionId, taskId, actor: "watchdog", message });

  for (const mission of await store.listMissions(orgId)) {
    if (mission.status === "done") continue;
    const inspection = await inspect(store, orgId, mission.id, capabilities, now);
    if (!inspection) continue;
    result.inspections.push(inspection);
    if (mission.isDemo) continue;

    let relaunch = false;
    const pause = inspection.findings.find((x) => x.action.type === "pause");
    if (pause && pause.action.type === "pause") {
      const { tasks } = (await store.getMission(mission.id))!;
      for (const t of tasks.filter((x) => x.status === "todo" || (x.status === "waiting" && !x.waitingReason?.startsWith(WATCHDOG_PAUSE_PREFIX)))) {
        if (await store.updateTask(t.id, { status: "waiting", waitingReason: pause.action.reason }, t.status)) result.actions++;
      }
      await log(mission.id, null, `${pause.message} Relancez l'équipe depuis la mission quand le problème est réglé.`);
      continue;
    }

    for (const finding of inspection.findings) {
      const a = finding.action;
      if (a.type === "reset_stuck" && (await store.updateTask(a.taskId, { status: "todo", error: "Interrompu : relancé par le Chien de garde." }, "in_progress"))) {
        result.actions++;
        relaunch = true;
        await log(mission.id, a.taskId, `${finding.message} Je remets la tâche en file.`);
      } else if (a.type === "retry" && (await store.updateTask(a.taskId, { status: "todo", error: null }, "error"))) {
        result.actions++;
        relaunch = true;
        await log(mission.id, a.taskId, `${finding.message} Je tente un dernier essai.`);
      } else if (a.type === "relaunch") {
        relaunch = true;
      }
    }

    if (relaunch) {
      result.relaunched.push(mission.id);
      await log(mission.id, null, "Je relance l'équipe sur cette mission.");
      await advanceMission(mission.id, { store, ai: deps.ai, capabilities, now: () => new Date() });
    }
  }
  return result;
}
