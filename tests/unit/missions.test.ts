import { describe, expect, it } from "vitest";
import { brandIssues } from "@/domain/missions/brand-check";
import { deriveMissionStatus, readyTasks, validateTaskGraph } from "@/domain/missions/graph";
import { classifyRequest, planFromRequest } from "@/domain/missions/planner";
import { MISSION_TEMPLATES } from "@/domain/missions/templates";
import type { AgentOutput, Capability } from "@/domain/missions/types";
import { ProviderError } from "@/providers/errors";
import type { AIProvider } from "@/providers/ai/types";
import { advanceMission } from "@/server/missions/engine";
import { MemoryMissionStore } from "@/server/missions/memory-store";

const ORG = "org-1";

function fakeAi(handler: (system: string, prompt: string) => AgentOutput | Error = () => ({ summary: "ok", decisions: [], deliverables: [{ kind: "post", title: "Post", content: "Rejoins BeeRecos." }], limitations: [] })) {
  const calls: { system: string; prompt: string }[] = [];
  const ai: AIProvider = {
    id: "fake",
    displayName: "Fake",
    capabilities: async () => ({ generateText: true, generateStructured: true, webSearch: false, analyzeImage: false, generateImage: false, generateVideo: false, transcribeAudio: false, textToSpeech: false }),
    healthCheck: async () => ({ status: "connected" }),
    generateText: async () => ({ text: "", usage: { provider: "fake", model: "fake", inputTokens: 0, outputTokens: 0 } }),
    generateStructured: async ({ system, prompt }) => {
      calls.push({ system, prompt });
      const r = handler(system, prompt);
      if (r instanceof Error) throw r;
      return { data: r as never, sources: [], usage: { provider: "fake", model: "fake", inputTokens: 1, outputTokens: 1 } };
    },
  };
  return { ai, calls };
}

async function newMission(store: MemoryMissionStore, template: keyof typeof MISSION_TEMPLATES = "content_ideas") {
  const t = MISSION_TEMPLATES[template];
  return store.createMission({ organizationId: ORG, title: t.label, request: "test", template, objective: t.objective, createdBy: null, tasks: t.tasks });
}

const ALL: Set<Capability> = new Set(["llm", "web_search"]);

describe("Queen Bee — planification", () => {
  it("chaque modèle de mission est un graphe valide (sans cycle, dépendances existantes)", () => {
    for (const t of Object.values(MISSION_TEMPLATES)) expect(validateTaskGraph(t.tasks), t.key).toEqual([]);
  });

  it("détecte un cycle", () => {
    expect(validateTaskGraph([{ key: "a", dependsOn: ["b"] }, { key: "b", dependsOn: ["a"] }])[0]).toMatch(/cycle/);
  });

  it("classe les demandes types", () => {
    expect(classifyRequest("Prépare-moi une semaine de contenu Instagram")?.template).toBe("weekly_content");
    expect(classifyRequest("Crée une campagne pour inviter des chefs d'entreprise à visiter un club BeeRecos")?.template).toBe("club_invitation");
    expect(classifyRequest("Transforme cette vidéo studio en Reel")?.template).toBe("studio_to_reels");
    expect(classifyRequest("Crée-moi une vidéo 100 % IA")?.template).toBe("ai_video");
    expect(classifyRequest("Trouve 20 idées de contenus")?.template).toBe("content_ideas");
    expect(classifyRequest("Crée un calendrier éditorial de 30 jours")?.template).toBe("editorial_calendar");
    expect(classifyRequest("Analyse mes performances Instagram")?.template).toBe("performance_analysis");
    expect(classifyRequest("Prépare le lancement d'une nouvelle formation")?.template).toBe("training_launch");
    expect(classifyRequest("Prépare ma communication pour un événement")?.template).toBe("event_communication");
    expect(classifyRequest("Prépare une campagne de génération de leads")?.template).toBe("lead_campaign");
    // Demande phare du cahier des charges : un plan de semaine qui cite une vidéo et les clubs.
    expect(classifyRequest("Queen Bee, prépare la semaine prochaine. 3 contenus réseau monétisé, 2 formation, 2 IA. Utilise ma vidéo tournée hier pour lundi et jeudi. Je veux générer des visites dans nos clubs.")?.template).toBe("weekly_content");
  });

  it("explique son choix, même par défaut", () => {
    expect(planFromRequest("Bonjour").reason).toMatch(/Aucun modèle/);
  });
});

describe("Moteur d'orchestration", () => {
  it("sans modèle IA, aucune tâche ne prétend travailler : elles attendent avec la raison", async () => {
    const store = new MemoryMissionStore();
    const { mission } = await newMission(store);
    const status = await advanceMission(mission.id, { store, ai: null, capabilities: new Set() });
    const { tasks } = (await store.getMission(mission.id))!;
    expect(status).toBe("waiting_input");
    expect(tasks[0]).toMatchObject({ status: "waiting", output: null });
    expect(tasks[0].waitingReason).toMatch(/Claude/);
    expect(tasks[1].status).toBe("todo"); // bloquée par la dépendance, pas exécutée
  });

  it("exécute dans l'ordre du graphe, transmet le contexte des dépendances et termine", async () => {
    const store = new MemoryMissionStore();
    const { ai, calls } = fakeAi();
    const { mission } = await newMission(store, "content_ideas");
    expect(await advanceMission(mission.id, { store, ai, capabilities: ALL })).toBe("done");
    expect(calls).toHaveLength(3);
    expect(calls[0].system).toMatch(/Chercheur/);
    expect(calls[1].prompt).toMatch(/Production de Chercheur/);
    expect(calls[2].system).toMatch(/Gardien de la marque/);
    const activity = await store.listActivity(ORG, { missionId: mission.id });
    expect(activity.some((e) => /Architecte de contenu a terminé/.test(e.message))).toBe(true);
  });

  it("s'arrête sur une validation humaine puis reprend après l'approbation", async () => {
    const store = new MemoryMissionStore();
    const { ai } = fakeAi();
    const { mission } = await newMission(store, "editorial_calendar");
    expect(await advanceMission(mission.id, { store, ai, capabilities: ALL })).toBe("waiting_validation");
    const [approval] = await store.listApprovals(ORG, "pending");
    expect(approval.title).toBe("Calendrier 30 jours");
    const { tasks } = (await store.getMission(mission.id))!;
    expect(readyTasks(tasks)).toHaveLength(0); // le contrôle de marque attend la validation

    await store.decideApproval(approval.id, { status: "approved", comment: null, decidedBy: null });
    await store.updateTask(approval.taskId, { status: "validated" }, "to_validate");
    expect(await advanceMission(mission.id, { store, ai, capabilities: ALL })).toBe("done");
    expect(await store.decideApproval(approval.id, { status: "rejected", comment: null, decidedBy: null })).toBe(false); // une seule décision
  });

  it("réessaie une erreur temporaire une fois, puis passe en erreur", async () => {
    const store = new MemoryMissionStore();
    const { ai, calls } = fakeAi(() => new ProviderError("fake", "timeout", "délai"));
    const { mission } = await newMission(store);
    expect(await advanceMission(mission.id, { store, ai, capabilities: ALL })).toBe("error");
    expect(calls).toHaveLength(2);
    const { tasks } = (await store.getMission(mission.id))!;
    expect(tasks[0]).toMatchObject({ status: "error", attempts: 2 });
  });

  it("une tâche ne s'exécute qu'une fois même si deux moteurs tournent en parallèle", async () => {
    const store = new MemoryMissionStore();
    const { ai, calls } = fakeAi();
    const { mission } = await newMission(store);
    await Promise.all([advanceMission(mission.id, { store, ai, capabilities: ALL }), advanceMission(mission.id, { store, ai, capabilities: ALL })]);
    expect(calls).toHaveLength(3);
  });

  it("le Gardien de la marque ajoute ses contrôles automatiques", async () => {
    const store = new MemoryMissionStore();
    const { ai } = fakeAi((system) => ({ summary: "ok", decisions: [], limitations: [], deliverables: system.includes("Gardien de la marque") ? [] : [{ kind: "post", title: "Post", content: "Rejoins Beerecos et la Beeschool, argent facile !" }] }));
    const { mission } = await newMission(store);
    await advanceMission(mission.id, { store, ai, capabilities: ALL });
    const review = (await store.getMission(mission.id))!.tasks.find((t) => t.agent === "brand_guardian")!;
    const text = review.output!.decisions.join("\n");
    expect(text).toMatch(/« Beerecos » doit s'écrire « BeeRecos »/);
    expect(text).toMatch(/« BeeSchool »/);
    expect(text).toMatch(/argent facile/);
  });

  it("dérive le statut de mission de l'état réel des tâches", () => {
    expect(deriveMissionStatus([])).toBe("planned");
  });
});

describe("contrôle de marque", () => {
  it("ignore les identifiants techniques", () => {
    expect(brandIssues([{ kind: "post", title: "x", content: "beerecos.fr et @beerecos" }], { forbiddenWords: [] })).toEqual([]);
  });
});
