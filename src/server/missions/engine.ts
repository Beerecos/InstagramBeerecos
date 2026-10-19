import { AGENTS, CAPABILITY_LABELS } from "@/domain/missions/agents";
import { brandIssues } from "@/domain/missions/brand-check";
import { deriveMissionStatus, readyTasks } from "@/domain/missions/graph";
import { WATCHDOG_PAUSE_PREFIX } from "@/domain/missions/watchdog";
import { AgentOutputSchema } from "@/domain/missions/schema";
import type { AgentOutput, BrandMemory, Capability, Mission, MissionTask } from "@/domain/missions/types";
import { PILLAR_LABELS } from "@/domain/content";
import { ProviderError } from "@/providers/errors";
import type { AIProvider } from "@/providers/ai/types";
import type { MissionStore } from "./store";

export type EngineDeps = {
  store: MissionStore;
  /** null quand aucun modèle n'est configuré : les tâches qui en ont besoin passent « En attente », sans faux résultat. */
  ai: AIProvider | null;
  capabilities: ReadonlySet<Capability>;
  now?: () => Date;
};

const MAX_ATTEMPTS = 2;
const DEP_OUTPUT_CHARS = 6000;

/**
 * Fait avancer une mission : exécute chaque tâche dont les dépendances sont satisfaites, jusqu'à ce que
 * plus rien ne soit exécutable (validation humaine, ressource manquante, fin). Idempotent : chaque tâche
 * est réservée par une mise à jour conditionnelle avant exécution.
 */
export async function advanceMission(missionId: string, deps: EngineDeps): Promise<Mission["status"]> {
  const { store, capabilities } = deps;
  const now = () => (deps.now ?? (() => new Date()))().toISOString();

  for (let round = 0; round < 50; round++) {
    const loaded = await store.getMission(missionId);
    if (!loaded) throw new Error(`Mission ${missionId} introuvable`);
    const { mission, tasks } = loaded;
    if (!mission.startedAt) await store.updateMission(mission.id, { startedAt: now() });

    let progressed = false;
    for (const task of readyTasks(tasks)) {
      if (task.waitingReason?.startsWith(WATCHDOG_PAUSE_PREFIX)) continue; // pause posée par le Chien de garde
      const missing = task.needs.filter((c) => !capabilities.has(c) || (c === "llm" && !deps.ai));
      if (missing.length > 0) {
        const reason = `Connexion requise : ${missing.map((c) => CAPABILITY_LABELS[c]).join(", ")}.`;
        if (task.status !== "waiting" || task.waitingReason !== reason) {
          await store.updateTask(task.id, { status: "waiting", waitingReason: reason }, task.status);
          await store.addActivity(mission.organizationId, { missionId, taskId: task.id, actor: task.agent, message: `${AGENTS[task.agent].name} attend : ${reason}` });
        }
        continue;
      }

      const claimed = await store.updateTask(task.id, { status: "in_progress", startedAt: now(), waitingReason: null, error: null, attempts: task.attempts + 1 }, task.status);
      if (!claimed) continue;
      progressed = true;
      await store.addActivity(mission.organizationId, { missionId, taskId: task.id, actor: task.agent, message: `${AGENTS[task.agent].name} commence « ${task.title} ».` });

      try {
        const brand = await store.getBrandMemory(mission.organizationId);
        const output = await runAgentTask({ mission, task, tasks, brand, ai: deps.ai! });
        const next = task.requiresApproval ? "to_validate" : "done";
        await store.updateTask(task.id, { status: next, output, completedAt: now() }, "in_progress");
        await store.addActivity(mission.organizationId, { missionId, taskId: task.id, actor: task.agent, message: `${AGENTS[task.agent].name} a terminé « ${task.title} » : ${output.summary}` });
        if (task.requiresApproval) {
          await store.createApproval(mission.organizationId, { missionId, taskId: task.id, agent: task.agent, title: task.title });
          await store.addActivity(mission.organizationId, { missionId, taskId: task.id, actor: "queen_bee", message: `Queen Bee soumet « ${task.title} » à votre validation.` });
        }
      } catch (e) {
        const retryable = e instanceof ProviderError ? e.retryable : false;
        const message = e instanceof Error ? e.message : String(e);
        const retry = retryable && task.attempts + 1 < MAX_ATTEMPTS;
        await store.updateTask(task.id, retry ? { status: "todo", error: message } : { status: "error", error: message }, "in_progress");
        await store.addActivity(mission.organizationId, {
          missionId,
          taskId: task.id,
          actor: "system",
          message: retry ? `« ${task.title} » : erreur temporaire, nouvelle tentative. (${message})` : `« ${task.title} » en erreur : ${message}`,
        });
      }
    }

    if (!progressed) break;
  }

  const final = await store.getMission(missionId);
  const status = deriveMissionStatus(final!.tasks);
  await store.updateMission(missionId, { status, completedAt: status === "done" ? now() : null });
  return status;
}

/** Contexte limité à ce qui est utile : mission, consigne, mémoire de marque, sorties des dépendances directes. */
export function buildTaskPrompt(mission: Mission, task: MissionTask, tasks: MissionTask[], brand: BrandMemory): string {
  const deps = tasks.filter((t) => task.dependsOn.includes(t.id) && t.output);
  const depText = deps
    .map((d) => {
      const body = d.output!.deliverables.map((x) => `### ${x.title} (${x.kind})\n${x.content}`).join("\n\n");
      return `## Production de ${AGENTS[d.agent].name} — ${d.title}\nRésumé : ${d.output!.summary}\n${body}`.slice(0, DEP_OUTPUT_CHARS);
    })
    .join("\n\n");
  const pillars = Object.entries(brand.pillarWeights).map(([k, v]) => `${PILLAR_LABELS[k as keyof typeof PILLAR_LABELS]} ${v} %`).join(", ");

  return [
    `# Mission\nDemande de l'utilisateur : ${mission.request}\nObjectif : ${mission.objective}`,
    `# Ta tâche : ${task.title}\n${task.instruction}`,
    `# Mémoire de marque\nEntreprise : ${brand.company} — ${brand.description}\nPositionnement : ${brand.positioning}\nCibles : ${brand.targets.join(" ; ")}\nOffres : ${brand.offers.join(" ; ")}\nTon : ${brand.tone}\nPondération des piliers : ${pillars}\nCTA de référence : ${brand.ctas.join(" | ")}\nMots interdits : ${brand.forbiddenWords.join(", ")}`,
    depText ? `# Travail déjà réalisé par l'équipe\n${depText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const GLOBAL_RULES = [
  "Tu fais partie de l'équipe marketing IA BeeMarketing de BeeRecos. Réponds en français.",
  "Écris toujours BeeRecos, BeeMarketing, BeeSchool avec cette casse exacte.",
  "N'invente aucun chiffre, témoignage, club, date de réunion, statistique ou source. Ce que tu ne peux pas établir va dans « limitations ».",
  "Ne donne pas ton raisonnement interne : seulement décisions (avec justification courte), livrables complets et limites.",
].join("\n");

async function runAgentTask(input: { mission: Mission; task: MissionTask; tasks: MissionTask[]; brand: BrandMemory; ai: AIProvider }): Promise<AgentOutput> {
  const { mission, task, tasks, brand, ai } = input;
  const profile = AGENTS[task.agent];
  const { data, sources } = await ai.generateStructured({
    system: `${GLOBAL_RULES}\n\nRôle : ${profile.name} — ${profile.role}.\n${profile.instructions}`,
    prompt: buildTaskPrompt(mission, task, tasks, brand),
    schema: AgentOutputSchema,
    allowWebSearch: task.agent === "researcher",
  });
  const output: AgentOutput = { ...data, limitations: [...data.limitations] };
  if (task.agent === "researcher") {
    if (sources.length) output.decisions.push(`Sources consultées : ${sources.join(" ; ")}`);
    else output.limitations.push("Aucune source web consultée : les éléments de tendance sont des hypothèses à vérifier.");
  }
  if (task.agent === "brand_guardian") {
    // Contrôle déterministe en plus de la relecture du modèle.
    const reviewed = tasks.filter((t) => task.dependsOn.includes(t.id) && t.output).flatMap((t) => t.output!.deliverables);
    const issues = brandIssues(reviewed, brand);
    if (issues.length) output.decisions.push(...issues.map((i) => `Correction obligatoire (contrôle automatique) : ${i}`));
  }
  return output;
}
