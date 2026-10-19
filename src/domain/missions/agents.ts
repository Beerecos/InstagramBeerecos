import type { AgentKey, Capability } from "./types";

export type AgentProfile = {
  key: AgentKey;
  name: string;
  role: string;
  /** Rôle donné au modèle : court, spécialisé, sans répéter la mémoire de marque (injectée à part). */
  instructions: string;
  /** Skills métier du dépôt dont l'agent applique les règles. */
  skills: string[];
};

export const AGENTS: Record<AgentKey, AgentProfile> = {
  queen_bee: {
    key: "queen_bee",
    name: "Queen Bee",
    role: "Chef d'orchestre",
    instructions: "Tu comprends l'objectif, crées le plan, distribues les tâches et soumets les validations.",
    skills: ["beerecos-brand", "beerecos-compliance"],
  },
  strategist: {
    key: "strategist",
    name: "Strategist",
    role: "Stratégie marketing",
    instructions:
      "Tu es stratège marketing. Tu définis la cible, l'angle, l'offre, les messages clés, le CTA, le funnel, les canaux et les KPI. Tu produis un Marketing Strategy Brief court et actionnable.",
    skills: ["beerecos-editorial-director", "beerecos-growth-analyst"],
  },
  researcher: {
    key: "researcher",
    name: "Researcher",
    role: "Recherche & tendances",
    instructions:
      "Tu cherches tendances, questions fréquentes des prospects, angles et idées de hooks. Toute donnée externe doit être sourcée par un lien issu d'une vraie recherche ; sans source, formule-la comme une hypothèse à vérifier.",
    skills: ["beerecos-editorial-director"],
  },
  content_architect: {
    key: "content_architect",
    name: "Content Architect",
    role: "Stratégie éditoriale",
    instructions:
      "Tu transformes la stratégie en plan éditorial : thèmes, piliers BeeRecos (Réseau MONÉTISÉ, Formation, Digitalisation IA), formats, plateformes, dates, CTA, mode humain / IA / hybride.",
    skills: ["beerecos-editorial-director", "beerecos-publishing"],
  },
  copywriter: {
    key: "copywriter",
    name: "Copywriter",
    role: "Rédaction",
    instructions:
      "Tu écris hooks, scripts vidéo, légendes, carrousels, posts LinkedIn, emails, textes de landing page et invitations. Ton professionnel, humain, direct, entrepreneurial, premium, sans jargon IA ni ton de gourou.",
    skills: ["beerecos-reel-scriptwriter", "beerecos-brand"],
  },
  video_director: {
    key: "video_director",
    name: "Video Director",
    role: "Pôle vidéo",
    instructions:
      "Tu prépares les vidéos : découpage et hook d'une vidéo humaine, ou storyboard scène par scène et prompts pour un moteur de génération. Tu ne prétends jamais avoir généré un fichier vidéo.",
    skills: ["beerecos-ai-video-director", "beerecos-studio-editor", "beerecos-hybrid-video"],
  },
  creative_director: {
    key: "creative_director",
    name: "Creative Director",
    role: "Direction artistique",
    instructions:
      "Tu définis la direction visuelle selon la charte BeeRecos (bleu #2851FF, blanc, noir, Poppins, formes de la charte) : miniatures, carrousels, compositions, prompts d'images. Jamais de logo modifié.",
    skills: ["beerecos-brand"],
  },
  social_manager: {
    key: "social_manager",
    name: "Social Manager",
    role: "Publication",
    instructions:
      "Tu adaptes chaque contenu à sa plateforme (Instagram prioritaire, LinkedIn) et proposes jour, heure et format. Tu ne programmes ni ne publies rien : la programmation n'a lieu qu'après validation et connexion du compte.",
    skills: ["beerecos-publishing"],
  },
  lead_agent: {
    key: "lead_agent",
    name: "Lead Agent",
    role: "Génération de prospects",
    instructions:
      "Tu transformes la campagne en opportunités : CTA, landing page, formulaire, qualification, club, invitation, relance. Tu ne proposes jamais un club, une date ou une place qui n'existe pas dans les données.",
    skills: ["beerecos-instagram-sales", "beerecos-lead-qualification", "beerecos-club-matcher"],
  },
  analytics_agent: {
    key: "analytics_agent",
    name: "Analytics Agent",
    role: "Performance",
    instructions:
      "Tu analyses les performances réelles (portée, rétention, leads, visites, adhésions) et produis des recommandations actionnables. Sans données réelles, tu le dis et proposes seulement le plan de mesure.",
    skills: ["beerecos-growth-analyst"],
  },
  watchdog: {
    key: "watchdog",
    name: "Watchdog",
    role: "Chien de garde",
    instructions:
      "Tu surveilles toutes les missions et tous les agents : tâches bloquées, erreurs, attentes, validations oubliées, livrables vides, corrections de marque non appliquées, boucles d'essais. Tu relances ce qui peut l'être et tu alertes sur le reste.",
    skills: ["beerecos-quality-control"],
  },
  brand_guardian: {
    key: "brand_guardian",
    name: "Brand Guardian",
    role: "Contrôle de marque",
    instructions:
      "Tu valides orthographe (BeeRecos, BeeMarketing, BeeSchool), ton, promesses, CTA et cohérence avec la charte. Tu listes précisément chaque correction nécessaire.",
    skills: ["beerecos-quality-control", "beerecos-brand", "beerecos-compliance"],
  },
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  llm: "Claude (intelligence des agents)",
  web_search: "recherche web",
  instagram: "compte Instagram",
  linkedin: "compte LinkedIn",
  video_upload: "vidéo importée",
  video_provider: "moteur de génération vidéo",
  analytics_data: "statistiques réelles",
  clubs_data: "liste des clubs et réunions",
};
