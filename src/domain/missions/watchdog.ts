import { AGENTS, CAPABILITY_LABELS } from "./agents";
import { isSatisfied, readyTasks } from "./graph";
import type { Approval, Capability, Mission, MissionTask, WorkerAgentKey } from "./types";

/**
 * Chien de garde : inspection déterministe d'une mission (aucun appel IA, aucune donnée inventée).
 * Il produit des constats et, quand c'est sûr, une action de réparation que le serveur applique.
 */
/** Préfixe des raisons d'attente posées par le Chien de garde : le moteur n'exécute pas ces tâches tant qu'un humain ne relance pas. */
export const WATCHDOG_PAUSE_PREFIX = "Mis en pause par le Chien de garde";

export type WatchdogSeverity = "info" | "warning" | "critical";

export type WatchdogAction =
  | { type: "reset_stuck"; taskId: string } // tâche « En cours » abandonnée → remise à faire
  | { type: "retry"; taskId: string } // erreur avec un essai restant → nouvel essai
  | { type: "relaunch" } // travail prêt mais personne ne l'exécute → relancer l'équipe
  | { type: "pause"; reason: string } // trop d'essais : on arrête la mission avant de gaspiller
  | { type: "none" };

export type WatchdogFinding = {
  code:
    | "stuck_task"
    | "error_task"
    | "waiting_resolved"
    | "waiting_capability"
    | "idle_ready_work"
    | "stale_approval"
    | "empty_output"
    | "agent_limitations"
    | "brand_corrections"
    | "runaway_attempts"
    | "paused";
  severity: WatchdogSeverity;
  missionId: string;
  taskId: string | null;
  agent: WorkerAgentKey | null;
  message: string;
  action: WatchdogAction;
};

export type WatchdogLimits = {
  /** Au-delà, une tâche « En cours » est considérée comme abandonnée (moteur interrompu). */
  stuckAfterMinutes: number;
  /** Délai sans activité avant de relancer du travail prêt. */
  idleAfterMinutes: number;
  /** Délai avant de rappeler une validation en attente. */
  staleApprovalHours: number;
  /** Essais par tâche avant abandon. */
  maxAttemptsPerTask: number;
  /** Essais cumulés par tâche au-delà desquels la mission est mise en pause (protection des coûts). */
  maxAttemptsPerMissionFactor: number;
};

export const DEFAULT_LIMITS: WatchdogLimits = {
  stuckAfterMinutes: 10,
  idleAfterMinutes: 2,
  staleApprovalHours: 24,
  maxAttemptsPerTask: 2,
  maxAttemptsPerMissionFactor: 3,
};

export type MissionInspection = { missionId: string; health: number; findings: WatchdogFinding[] };

const minutes = (from: string | null, now: Date) => (from ? (now.getTime() - new Date(from).getTime()) / 60_000 : Infinity);

export function inspectMission(
  input: { mission: Mission; tasks: MissionTask[]; approvals: Approval[]; lastActivityAt: string | null },
  ctx: { now: Date; capabilities: ReadonlySet<Capability>; limits?: WatchdogLimits },
): MissionInspection {
  const { mission, tasks, approvals } = input;
  const limits = ctx.limits ?? DEFAULT_LIMITS;
  const findings: WatchdogFinding[] = [];
  const f = (x: Omit<WatchdogFinding, "missionId">) => findings.push({ ...x, missionId: mission.id });
  const name = (t: MissionTask) => AGENTS[t.agent].name;

  if (tasks.length > 0 && tasks.every(isSatisfied)) return { missionId: mission.id, health: 100, findings: [] };

  const paused = tasks.filter((t) => t.status === "waiting" && t.waitingReason?.startsWith(WATCHDOG_PAUSE_PREFIX));
  if (paused.length) {
    f({ code: "paused", severity: "critical", taskId: null, agent: null, message: `Mission en pause (${paused.length} tâche(s)) : relancez l'équipe depuis la mission quand le problème est réglé.`, action: { type: "none" } });
  }
  const totalAttempts = tasks.reduce((n, t) => n + t.attempts, 0);
  if (!paused.length && totalAttempts > tasks.length * limits.maxAttemptsPerMissionFactor) {
    f({
      code: "runaway_attempts",
      severity: "critical",
      taskId: null,
      agent: null,
      message: `${totalAttempts} essais pour ${tasks.length} tâches : mission mise en pause pour éviter une boucle coûteuse.`,
      action: { type: "pause", reason: `${WATCHDOG_PAUSE_PREFIX} : trop d'essais.` },
    });
  }

  for (const t of tasks) {
    if (t.status === "in_progress" && minutes(t.startedAt, ctx.now) > limits.stuckAfterMinutes) {
      f({
        code: "stuck_task",
        severity: "critical",
        taskId: t.id,
        agent: t.agent,
        message: `${name(t)} est « En cours » sur « ${t.title} » depuis plus de ${limits.stuckAfterMinutes} min : exécution interrompue.`,
        action: t.attempts < limits.maxAttemptsPerTask ? { type: "reset_stuck", taskId: t.id } : { type: "none" },
      });
    }
    if (t.status === "error") {
      const refused = (t.error ?? "").startsWith("Refusé");
      f({
        code: "error_task",
        severity: "critical",
        taskId: t.id,
        agent: t.agent,
        message: refused ? `« ${t.title} » a été refusé : la suite de la mission attend une décision.` : `${name(t)} a échoué sur « ${t.title} » : ${t.error ?? "erreur inconnue"}`,
        action: !refused && t.attempts < limits.maxAttemptsPerTask ? { type: "retry", taskId: t.id } : { type: "none" },
      });
    }
    if (t.status === "waiting" && !t.waitingReason?.startsWith(WATCHDOG_PAUSE_PREFIX)) {
      const missing = t.needs.filter((c) => !ctx.capabilities.has(c));
      f(
        missing.length === 0
          ? { code: "waiting_resolved", severity: "info", taskId: t.id, agent: t.agent, message: `La ressource attendue pour « ${t.title} » est maintenant disponible : relance.`, action: { type: "relaunch" } }
          : { code: "waiting_capability", severity: "warning", taskId: t.id, agent: t.agent, message: `« ${t.title} » attend : ${missing.map((c) => CAPABILITY_LABELS[c]).join(", ")}.`, action: { type: "none" } },
      );
    }
    if (isSatisfied(t) && t.output) {
      if (t.output.deliverables.length === 0 && t.agent !== "brand_guardian") {
        f({ code: "empty_output", severity: "warning", taskId: t.id, agent: t.agent, message: `${name(t)} a terminé « ${t.title} » sans aucun livrable.`, action: { type: "none" } });
      }
      if (t.output.limitations.length > 0) {
        f({ code: "agent_limitations", severity: "info", taskId: t.id, agent: t.agent, message: `${name(t)} signale ${t.output.limitations.length} limite(s) sur « ${t.title} » : ${t.output.limitations[0]}`, action: { type: "none" } });
      }
      if (t.agent === "brand_guardian") {
        const corrections = t.output.decisions.filter((d) => d.startsWith("Correction obligatoire"));
        if (corrections.length) {
          f({ code: "brand_corrections", severity: "warning", taskId: t.id, agent: t.agent, message: `${corrections.length} correction(s) de marque à appliquer avant publication.`, action: { type: "none" } });
        }
      }
    }
  }

  for (const a of approvals.filter((x) => x.status === "pending")) {
    if (minutes(a.createdAt, ctx.now) > limits.staleApprovalHours * 60) {
      const t = tasks.find((x) => x.id === a.taskId);
      f({ code: "stale_approval", severity: "warning", taskId: a.taskId, agent: t?.agent ?? null, message: `« ${a.title} » attend votre validation depuis plus de ${limits.staleApprovalHours} h.`, action: { type: "none" } });
    }
  }

  // Travail prêt, personne dessus, aucune activité récente : le moteur s'est arrêté.
  const ready = readyTasks(tasks).filter((t) => t.status === "todo");
  const running = tasks.some((t) => t.status === "in_progress");
  if (ready.length > 0 && !running && minutes(input.lastActivityAt, ctx.now) > limits.idleAfterMinutes) {
    f({ code: "idle_ready_work", severity: "warning", taskId: ready[0].id, agent: ready[0].agent, message: `${ready.length} tâche(s) prête(s) sans agent au travail (« ${ready[0].title} ») : relance de l'équipe.`, action: { type: "relaunch" } });
  }

  const weight = { critical: 30, warning: 10, info: 0 } as const;
  const health = Math.max(0, 100 - findings.reduce((n, x) => n + weight[x.severity], 0));
  return { missionId: mission.id, health, findings };
}

/** Santé d'un agent sur l'ensemble des missions : part des tâches sans erreur ni blocage. */
export function agentHealth(tasks: MissionTask[], agent: WorkerAgentKey): { health: number | null; errors: number; stuck: number; total: number } {
  const own = tasks.filter((t) => t.agent === agent);
  const errors = own.filter((t) => t.status === "error").length;
  const stuck = own.filter((t) => t.status === "waiting").length;
  return { health: own.length ? Math.round(((own.length - errors - stuck * 0.5) / own.length) * 100) : null, errors, stuck, total: own.length };
}
