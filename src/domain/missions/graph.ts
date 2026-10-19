import { SATISFIED_STATUSES, type MissionStatus, type MissionTask, type TaskSpec } from "./types";

/** Vérifie qu'un modèle forme un graphe orienté sans cycle et que chaque dépendance existe. */
export function validateTaskGraph(tasks: Pick<TaskSpec, "key" | "dependsOn">[]): string[] {
  const errors: string[] = [];
  const keys = new Set(tasks.map((t) => t.key));
  if (keys.size !== tasks.length) errors.push("clé de tâche dupliquée");
  for (const t of tasks) for (const d of t.dependsOn) if (!keys.has(d)) errors.push(`${t.key} dépend de ${d} inexistant`);
  const state = new Map<string, 0 | 1 | 2>();
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const visit = (k: string): boolean => {
    if (state.get(k) === 1) return false;
    if (state.get(k) === 2) return true;
    state.set(k, 1);
    for (const d of byKey.get(k)?.dependsOn ?? []) if (byKey.has(d) && !visit(d)) return false;
    state.set(k, 2);
    return true;
  };
  for (const t of tasks) if (!visit(t.key)) {
    errors.push(`cycle détecté autour de ${t.key}`);
    break;
  }
  return errors;
}

export function isSatisfied(task: Pick<MissionTask, "status">): boolean {
  return SATISFIED_STATUSES.includes(task.status);
}

/** Tâches prêtes : à faire (ou en attente d'une ressource) et dont toutes les dépendances sont satisfaites. */
export function readyTasks(tasks: MissionTask[]): MissionTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return tasks
    .filter((t) => t.status === "todo" || t.status === "waiting")
    .filter((t) => t.dependsOn.every((d) => {
      const dep = byId.get(d);
      return dep ? isSatisfied(dep) : false;
    }))
    .sort((a, b) => a.position - b.position);
}

export function progress(tasks: MissionTask[]): { done: number; total: number } {
  return { done: tasks.filter(isSatisfied).length, total: tasks.length };
}

/** Statut global de la mission, dérivé uniquement de l'état réel des tâches. */
export function deriveMissionStatus(tasks: MissionTask[]): MissionStatus {
  if (tasks.length > 0 && tasks.every(isSatisfied)) return "done";
  if (tasks.some((t) => t.status === "error")) return "error";
  if (tasks.some((t) => t.status === "in_progress" || t.status === "analysis")) return "running";
  if (tasks.some((t) => t.status === "to_validate")) return "waiting_validation";
  if (tasks.some((t) => t.status === "waiting")) return "waiting_input";
  return tasks.some(isSatisfied) ? "running" : "planned";
}
