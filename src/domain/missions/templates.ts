import type { MissionTemplateKey, TaskSpec } from "./types";

export type MissionTemplate = {
  key: MissionTemplateKey;
  label: string;
  objective: string;
  tasks: TaskSpec[];
};

const L: TaskSpec["needs"] = ["llm"];

/** Contrôle de marque final, commun à toutes les missions qui produisent des textes publics. */
const guard = (deps: string[]): TaskSpec => ({
  key: "brand_review",
  agent: "brand_guardian",
  title: "Contrôle de marque",
  dependsOn: deps,
  needs: L,
  instruction: "Relis tous les livrables des tâches précédentes. Liste chaque correction (orthographe des marques, ton, promesses, CTA, charte) ou confirme qu'ils sont conformes.",
});

const publicationPlan = (deps: string[]): TaskSpec => ({
  key: "publication_plan",
  agent: "social_manager",
  title: "Plan de publication",
  dependsOn: deps,
  needs: L,
  requiresApproval: true,
  instruction: "Propose pour chaque contenu validé : plateforme, format, jour et heure, légende adaptée. Indique que la programmation réelle attend la connexion du compte et la validation.",
});

export const MISSION_TEMPLATES: Record<MissionTemplateKey, MissionTemplate> = {
  weekly_content: {
    key: "weekly_content",
    label: "Contenus de la semaine",
    objective: "Préparer 7 jours de contenus BeeRecos équilibrés entre les trois piliers, orientés visites de clubs.",
    tasks: [
      { key: "strategy", agent: "strategist", title: "Brief stratégique de la semaine", dependsOn: [], needs: L, instruction: "Définis l'objectif de la semaine, la cible, l'angle, le CTA principal et les KPI." },
      { key: "plan", agent: "content_architect", title: "Plan éditorial 7 jours", dependsOn: ["strategy"], needs: L, instruction: "Planifie 7 contenus (un par jour) en respectant la pondération des piliers et un mix humain / IA / hybride. Pour chaque jour : pilier, format, plateforme, mode, sujet, CTA." },
      { key: "copy", agent: "copywriter", title: "Hooks, scripts et légendes", dependsOn: ["plan"], needs: L, requiresApproval: true, instruction: "Pour chaque contenu du plan : hook, script ou texte, légende Instagram, CTA." },
      { key: "visuals", agent: "creative_director", title: "Direction visuelle", dependsOn: ["plan"], needs: L, instruction: "Pour chaque contenu : visuel ou miniature à produire, composition, prompt d'image éventuel." },
      { key: "video", agent: "video_director", title: "Storyboards des vidéos", dependsOn: ["copy"], needs: L, instruction: "Pour chaque contenu vidéo : storyboard scène par scène (vidéo humaine à tourner ou scènes IA)." },
      guard(["copy", "visuals", "video"]),
      publicationPlan(["brand_review"]),
    ],
  },
  club_invitation: {
    key: "club_invitation",
    label: "Invitation Club BeeRecos",
    objective: "Convaincre des dirigeants de venir découvrir une réunion de club BeeRecos.",
    tasks: [
      { key: "research", agent: "researcher", title: "Persona et objections", dependsOn: [], needs: L, instruction: "Décris le dirigeant cible, ses freins à rejoindre un réseau, ses questions fréquentes et 5 idées de hooks." },
      { key: "strategy", agent: "strategist", title: "Angle, CTA et KPI", dependsOn: ["research"], needs: L, instruction: "Choisis l'angle, la promesse honnête, le CTA vers la visite de club et les KPI (demandes, visites, adhésions)." },
      { key: "copy", agent: "copywriter", title: "Reel, carrousel, post, story, email, message LinkedIn", dependsOn: ["strategy"], needs: L, requiresApproval: true, instruction: "Écris un script de Reel, un carrousel, un post, une story, un email d'invitation et un message LinkedIn, tous avec le même CTA." },
      { key: "funnel", agent: "lead_agent", title: "Landing page, formulaire et relances", dependsOn: ["strategy"], needs: L, requiresApproval: true, instruction: "Rédige la page d'invitation, les champs minimaux du formulaire (RGPD), les 3 questions de qualification et la séquence de relance. N'invente aucun club ni date." },
      { key: "visuals", agent: "creative_director", title: "Visuels de la campagne", dependsOn: ["copy"], needs: L, instruction: "Direction visuelle du Reel, du carrousel et de la story selon la charte." },
      guard(["copy", "funnel", "visuals"]),
      publicationPlan(["brand_review"]),
    ],
  },
  studio_to_reels: {
    key: "studio_to_reels",
    label: "Vidéo studio → Reels",
    objective: "Transformer une vidéo tournée en plusieurs Reels prêts à valider.",
    tasks: [
      { key: "analysis", agent: "video_director", title: "Analyse et découpage de la vidéo", dependsOn: [], needs: ["llm", "video_upload"], instruction: "À partir de la transcription horodatée, propose les meilleurs passages (début, fin, score /100, pilier) et le hook de chacun." },
      { key: "copy", agent: "copywriter", title: "Titres, textes écran et légendes", dependsOn: ["analysis"], needs: L, requiresApproval: true, instruction: "Pour chaque Reel retenu : titre, textes à l'écran, légende, CTA." },
      guard(["copy"]),
      publicationPlan(["brand_review"]),
    ],
  },
  ai_video: {
    key: "ai_video",
    label: "Vidéo 100 % IA",
    objective: "Préparer puis produire une vidéo générée par IA, fidèle à la marque.",
    tasks: [
      { key: "research", agent: "researcher", title: "Recherche et angles", dependsOn: [], needs: L, instruction: "Trouve 3 angles et les questions que se pose la cible sur le sujet." },
      { key: "strategy", agent: "strategist", title: "Angle et CTA", dependsOn: ["research"], needs: L, instruction: "Choisis un angle, la promesse et le CTA." },
      { key: "script", agent: "copywriter", title: "Hook et script", dependsOn: ["strategy"], needs: L, requiresApproval: true, instruction: "Écris le hook et le script (20–35 s), plus 2 hooks alternatifs." },
      { key: "storyboard", agent: "video_director", title: "Storyboard et prompts vidéo", dependsOn: ["script"], needs: L, instruction: "Découpe en scènes de 2–8 s : plan, mouvement, sujet, texte écran, son, prompt moteur 9:16." },
      { key: "generation", agent: "video_director", title: "Génération des scènes", dependsOn: ["storyboard"], needs: ["video_provider"], instruction: "Envoie chaque scène au moteur vidéo connecté et assemble le rendu." },
      guard(["script", "storyboard"]),
      publicationPlan(["brand_review", "generation"]),
    ],
  },
  content_ideas: {
    key: "content_ideas",
    label: "Idées de contenus",
    objective: "Trouver 20 idées de contenus BeeRecos utiles et différenciantes.",
    tasks: [
      { key: "research", agent: "researcher", title: "Tendances et questions de la cible", dependsOn: [], needs: L, instruction: "Liste les sujets et questions qui comptent pour les dirigeants de TPE/PME en ce moment." },
      { key: "ideas", agent: "content_architect", title: "20 idées réparties par pilier", dependsOn: ["research"], needs: L, instruction: "Propose 20 idées (pilier, format, plateforme, mode, hook, CTA), réparties selon la pondération des piliers." },
      guard(["ideas"]),
    ],
  },
  editorial_calendar: {
    key: "editorial_calendar",
    label: "Calendrier éditorial 30 jours",
    objective: "Construire un calendrier éditorial de 30 jours cohérent avec la stratégie BeeRecos.",
    tasks: [
      { key: "strategy", agent: "strategist", title: "Objectifs du mois", dependsOn: [], needs: L, instruction: "Fixe les objectifs du mois, les temps forts et les KPI." },
      { key: "calendar", agent: "content_architect", title: "Calendrier 30 jours", dependsOn: ["strategy"], needs: L, requiresApproval: true, instruction: "Planifie 30 jours : date, pilier, format, plateforme, mode, sujet, CTA." },
      guard(["calendar"]),
    ],
  },
  performance_analysis: {
    key: "performance_analysis",
    label: "Analyse des performances",
    objective: "Comprendre ce qui génère des visites de clubs et décider des prochains contenus.",
    tasks: [
      { key: "analysis", agent: "analytics_agent", title: "Analyse des résultats", dependsOn: [], needs: ["llm", "analytics_data"], instruction: "Analyse portée, rétention, leads, visites et adhésions par contenu, format et pilier." },
      { key: "recommendations", agent: "strategist", title: "Recommandations", dependsOn: ["analysis"], needs: L, requiresApproval: true, instruction: "Transforme l'analyse en 3 à 5 décisions concrètes pour les deux prochaines semaines." },
    ],
  },
  lead_campaign: {
    key: "lead_campaign",
    label: "Campagne de génération de leads",
    objective: "Générer des demandes de visite qualifiées.",
    tasks: [
      { key: "strategy", agent: "strategist", title: "Stratégie de la campagne", dependsOn: [], needs: L, instruction: "Cible, offre, angle, CTA, canaux et KPI de la campagne." },
      { key: "copy", agent: "copywriter", title: "Contenus de la campagne", dependsOn: ["strategy"], needs: L, requiresApproval: true, instruction: "Écris les contenus de la campagne pour chaque canal, avec le même CTA." },
      { key: "funnel", agent: "lead_agent", title: "Tunnel de conversion", dependsOn: ["strategy"], needs: L, requiresApproval: true, instruction: "Landing page, formulaire, qualification, relances. Aucun club ni date inventé." },
      guard(["copy", "funnel"]),
      publicationPlan(["brand_review"]),
    ],
  },
  event_communication: {
    key: "event_communication",
    label: "Communication d'événement",
    objective: "Faire venir les bonnes personnes à un événement BeeRecos.",
    tasks: [
      { key: "strategy", agent: "strategist", title: "Stratégie de l'événement", dependsOn: [], needs: L, instruction: "Public, promesse, messages, calendrier avant / pendant / après, KPI." },
      { key: "plan", agent: "content_architect", title: "Plan de communication", dependsOn: ["strategy"], needs: L, instruction: "Séquence de contenus avant, pendant et après l'événement." },
      { key: "copy", agent: "copywriter", title: "Textes", dependsOn: ["plan"], needs: L, requiresApproval: true, instruction: "Écris chaque contenu de la séquence." },
      { key: "visuals", agent: "creative_director", title: "Visuels", dependsOn: ["plan"], needs: L, instruction: "Direction visuelle de la séquence." },
      guard(["copy", "visuals"]),
      publicationPlan(["brand_review"]),
    ],
  },
  training_launch: {
    key: "training_launch",
    label: "Lancement de formation",
    objective: "Lancer une formation BeeSchool et remplir les sessions.",
    tasks: [
      { key: "research", agent: "researcher", title: "Besoins de la cible", dependsOn: [], needs: L, instruction: "Problèmes concrets que la formation résout et objections." },
      { key: "strategy", agent: "strategist", title: "Positionnement et offre", dependsOn: ["research"], needs: L, instruction: "Promesse, preuve, offre, CTA et KPI du lancement." },
      { key: "plan", agent: "content_architect", title: "Séquence de lancement", dependsOn: ["strategy"], needs: L, instruction: "Séquence de contenus du teasing à la clôture des inscriptions." },
      { key: "copy", agent: "copywriter", title: "Textes de lancement", dependsOn: ["plan"], needs: L, requiresApproval: true, instruction: "Écris chaque contenu de la séquence, email compris." },
      { key: "video", agent: "video_director", title: "Vidéo de présentation", dependsOn: ["copy"], needs: L, instruction: "Storyboard de la vidéo de présentation de la formation." },
      guard(["copy", "video"]),
      publicationPlan(["brand_review"]),
    ],
  },
};
