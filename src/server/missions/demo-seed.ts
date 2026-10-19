import { deriveMissionStatus } from "@/domain/missions/graph";
import { MISSION_TEMPLATES } from "@/domain/missions/templates";
import type { AgentOutput, MissionTask, MissionTemplateKey, TaskStatus } from "@/domain/missions/types";
import { DEMO_REEL } from "@/domain/video/reel";
import type { MemoryMissionStore } from "./memory-store";

/**
 * Données de DÉMONSTRATION (mode démo uniquement, missions marquées isDemo) : elles montrent l'interface
 * avant toute connexion. Aucune statistique ni aucun résultat de publication n'est simulé.
 */
type SeedTask = { status: TaskStatus; output?: AgentOutput; waitingReason?: string; approval?: boolean };

const out = (summary: string, deliverables: AgentOutput["deliverables"], decisions: string[] = [], limitations: string[] = []): AgentOutput => ({ summary, decisions, deliverables, limitations });

const SEEDS: { template: MissionTemplateKey; title: string; request: string; minutesAgo: number; tasks: Record<string, SeedTask> }[] = [
  {
    template: "weekly_content",
    title: "Créer 7 jours de contenus BeeRecos",
    request: "Prépare-moi une semaine de contenus Instagram autour des trois piliers, avec un CTA vers les visites de clubs.",
    minutesAgo: 95,
    tasks: {
      strategy: { status: "done", output: out("Semaine orientée « le réseau qui rapporte », CTA CLUB sur 4 contenus sur 7.", [{ kind: "strategy_brief", title: "Brief de la semaine", content: "Cible : dirigeants de TPE/PME locaux.\nAngle : un réseau se mesure à ce qu'il rapporte.\nCTA principal : « Commente CLUB et je t'invite à découvrir un club BeeRecos. »\nKPI : demandes CLUB, invitations, visites." }], ["Angle « réseau rentable » retenu : il relie les trois piliers au bénéfice concret."]) },
      plan: { status: "done", output: out("7 contenus planifiés : 3 Réseau MONÉTISÉ, 2 Formation, 2 Digitalisation IA ; 3 humains, 2 IA, 2 hybrides.", [
        { kind: "calendar_entry", title: "Lundi — Vidéo face caméra de Cédric", content: "Pourquoi un réseau doit se mesurer en chiffre d'affaires.", pillar: "reseau_monetise", mode: "human", platform: "instagram" },
        { kind: "calendar_entry", title: "Mardi — Carrousel IA", content: "5 erreurs qui rendent un réseau inutile.", pillar: "reseau_monetise", mode: "ai", platform: "instagram" },
        { kind: "calendar_entry", title: "Mercredi — Témoignage membre", content: "À tourner en club : une recommandation devenue un client.", pillar: "reseau_monetise", mode: "human", platform: "instagram" },
        { kind: "calendar_entry", title: "Jeudi — Vidéo IA", content: "Un agent IA qui prépare un rendez-vous commercial.", pillar: "digitalisation_ia", mode: "hybrid", platform: "instagram" },
        { kind: "calendar_entry", title: "Vendredi — Coulisses de réunion", content: "Les 60 premières minutes d'une réunion BeeRecos.", pillar: "formation", mode: "human", platform: "instagram" },
        { kind: "calendar_entry", title: "Samedi — Conseil business", content: "Le pitch en 30 secondes, méthode BeeSchool.", pillar: "formation", mode: "hybrid", platform: "linkedin" },
        { kind: "calendar_entry", title: "Dimanche — Story", content: "Question ouverte : qui t'a recommandé ton meilleur client ?", pillar: "digitalisation_ia", mode: "ai", platform: "instagram" },
      ]) },
      copy: { status: "to_validate", approval: true, output: out("7 hooks, scripts et légendes rédigés.", [
        { kind: "hook", title: "Lundi — hook", content: "Ton réseau te coûte du temps. Est-ce qu'il te rapporte des clients ?", pillar: "reseau_monetise", platform: "instagram" },
        { kind: "script", title: "Lundi — script (30 s)", content: "Hook : Ton réseau te coûte du temps. Est-ce qu'il te rapporte des clients ?\nTension : on multiplie les cafés et les salons, sans jamais mesurer ce qui en sort.\nValeur : chez BeeRecos, chaque recommandation est suivie jusqu'au chiffre d'affaires.\nCTA : Commente CLUB et je t'invite à découvrir un club BeeRecos.", pillar: "reseau_monetise", platform: "instagram" },
        { kind: "caption", title: "Lundi — légende", content: "Un réseau qui ne rapporte rien, c'est un club de café.\n\nChez BeeRecos, on mesure ce que les recommandations rapportent vraiment.\n\n💬 Commente CLUB et je t'invite à découvrir un club près de chez toi.", platform: "instagram" },
      ]) },
      visuals: { status: "done", output: out("Direction visuelle définie selon la charte.", [{ kind: "visual_brief", title: "Carrousel de mardi", content: "Fond blanc, titres Poppins SemiBold noir, accent bleu #2851FF, une idée par slide, logo officiel en dernière slide." }]) },
      video: { status: "todo" },
      brand_review: { status: "todo" },
      publication_plan: { status: "todo" },
    },
  },
  {
    template: "club_invitation",
    title: "Promouvoir une visite de club à Bayonne",
    request: "Campagne pour faire découvrir BeeRecos aux dirigeants de Bayonne et générer des demandes de visite.",
    minutesAgo: 40,
    tasks: {
      research: { status: "done", output: out("Persona et objections identifiés.", [{ kind: "research_note", title: "Persona", content: "Dirigeant de TPE à Bayonne, 35–55 ans, déjà sollicité par plusieurs réseaux.\nObjections : manque de temps, peur d'un réseau « cotisation sans retour », méconnaissance du fonctionnement." }], [], ["Aucune source web consultée : objections issues de la mémoire de marque, à vérifier avec les responsables de club."]) },
      strategy: { status: "done", output: out("Angle : « Viens voir avant de décider » — une réunion offerte, sans engagement.", [{ kind: "kpi_plan", title: "KPI", content: "Demandes de visite, invitations confirmées, présences, adhésions." }]) },
      copy: { status: "to_validate", approval: true, output: out("Reel, carrousel, post, story, email et message LinkedIn rédigés.", [{ kind: "script", title: "Reel — script", content: "Hook : Et si tu venais voir un réseau d'affaires avant de t'engager ?\nValeur : une réunion BeeRecos, c'est des dirigeants qui se recommandent vraiment.\nCTA : Commente CLUB, je t'envoie une invitation pour le club le plus proche.", platform: "instagram", pillar: "reseau_monetise" }]) },
      funnel: { status: "to_validate", approval: true, output: out("Page d'invitation, formulaire minimal et séquence de relance.", [{ kind: "lead_funnel", title: "Formulaire", content: "Prénom, nom, société, email, activité, ville, consentement au contact.\nQualification : priorité, statut, disponibilité.\nLe club et la date sont proposés uniquement à partir des réunions enregistrées." }], [], ["Aucun club n'est encore enregistré : la proposition de date sera faite par un humain."]) },
      visuals: { status: "todo" },
      brand_review: { status: "todo" },
      publication_plan: { status: "todo" },
    },
  },
  {
    template: "studio_to_reels",
    title: "Transformer une vidéo studio en trois Reels",
    request: "Transforme ma vidéo studio d'hier en trois Reels.",
    minutesAgo: 20,
    tasks: {
      analysis: { status: "waiting", waitingReason: "Connexion requise : vidéo importée." },
      copy: { status: "todo" },
      brand_review: { status: "todo" },
      publication_plan: { status: "todo" },
    },
  },
  {
    template: "ai_video",
    title: "Créer une vidéo 100 % IA expliquant le réseau monétisé",
    request: "Crée une vidéo 100 % IA qui explique ce qu'est un réseau monétisé.",
    minutesAgo: 150,
    tasks: {
      research: { status: "done", output: out("3 angles proposés.", [{ kind: "research_note", title: "Angles", content: "1. Le réseau comme actif mesurable.\n2. La recommandation suivie jusqu'au contrat.\n3. Le temps passé en réseau vs ce qu'il rapporte." }]) },
      strategy: { status: "done", output: out("Angle 2 retenu.", [{ kind: "strategy_brief", title: "Angle", content: "La recommandation suivie jusqu'au contrat. CTA : CLUB." }]) },
      script: { status: "validated", output: out("Script de 28 s et 2 hooks alternatifs.", [{ kind: "script", title: "Script", content: "Hook : Une recommandation, ça vaut combien ?\nValeur : dans un réseau monétisé, chaque mise en relation est suivie jusqu'au contrat signé.\nCTA : Commente CLUB pour découvrir un club BeeRecos.", pillar: "reseau_monetise", mode: "ai", platform: "instagram" }]) },
      storyboard: { status: "done", output: out("5 scènes 9:16 prêtes pour un moteur vidéo.", [{ kind: "storyboard", title: "Storyboard", content: "Scène 1 (3 s) : gros plan, deux mains qui se serrent, lumière douce, fond bureau.\nScène 2 (6 s) : interface sobre, une ligne relie deux entreprises.\n… (texte et logo ajoutés au montage, jamais par le moteur)" }]) },
      motion: { status: "to_validate", approval: true, output: out("Reel motion design de 16,5 s, 4 scènes, CTA CLUB.", [{ kind: "motion_reel", title: DEMO_REEL.title, content: JSON.stringify(DEMO_REEL), platform: "instagram", pillar: DEMO_REEL.pillar, mode: "ai" }], ["Alternance fond blanc / plein écran bleu, accent violet unique, révélations flou → net."]) },
      brand_review: { status: "todo" },
      publication_plan: { status: "todo" },
    },
  },
];

export async function seedDemo(store: MemoryMissionStore, organizationId: string, now = new Date()) {
  for (const seed of SEEDS) {
    const created = new Date(now.getTime() - seed.minutesAgo * 60_000);
    const iso = (offsetMin: number) => new Date(created.getTime() + offsetMin * 60_000).toISOString();
    const template = MISSION_TEMPLATES[seed.template];
    const { mission, tasks } = await store.createMission(
      { organizationId, title: seed.title, request: seed.request, template: seed.template, objective: template.objective, createdBy: null, tasks: template.tasks },
      { isDemo: true, createdAt: created.toISOString() },
    );
    await store.addActivity(organizationId, { missionId: mission.id, taskId: null, actor: "queen_bee", message: `Queen Bee crée la mission « ${seed.title} » et mobilise ${new Set(tasks.map((t) => t.agent)).size} agents.` }, iso(0));
    let minute = 1;
    for (const task of tasks as MissionTask[]) {
      const s = seed.tasks[task.key];
      if (!s) continue;
      const patch = { status: s.status, output: s.output ?? null, waitingReason: s.waitingReason ?? null, startedAt: s.output ? iso(minute) : null, completedAt: s.output ? iso(minute + 1) : null };
      await store.updateTask(task.id, patch);
      if (s.output) {
        await store.addActivity(organizationId, { missionId: mission.id, taskId: task.id, actor: task.agent, message: `${task.title} : ${s.output.summary}` }, iso(minute + 1));
        minute += 2;
      }
      if (s.waitingReason) await store.addActivity(organizationId, { missionId: mission.id, taskId: task.id, actor: task.agent, message: `En attente — ${s.waitingReason}` }, iso(minute));
      if (s.approval) {
        await store.createApproval(organizationId, { missionId: mission.id, taskId: task.id, agent: task.agent, title: task.title }, iso(minute));
        await store.addActivity(organizationId, { missionId: mission.id, taskId: task.id, actor: "queen_bee", message: `Queen Bee soumet « ${task.title} » à votre validation.` }, iso(minute));
      }
    }
    const fresh = (await store.getMission(mission.id))!;
    await store.updateMission(mission.id, { status: deriveMissionStatus(fresh.tasks), startedAt: iso(0) });
  }
}
