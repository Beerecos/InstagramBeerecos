import type { CreationMode, Pillar } from "@/domain/content";

/** Agents de l'équipe BeeMarketing (définitions dans agents.ts). */
export const AGENT_KEYS = [
  "queen_bee",
  "strategist",
  "researcher",
  "content_architect",
  "copywriter",
  "video_director",
  "creative_director",
  "social_manager",
  "lead_agent",
  "analytics_agent",
  "brand_guardian",
  "watchdog",
] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];
/** Agents qui exécutent des tâches (Queen Bee orchestre, le Watchdog supervise). */
export type WorkerAgentKey = Exclude<AgentKey, "queen_bee" | "watchdog">;
export const WORKER_AGENT_KEYS = AGENT_KEYS.filter((k): k is WorkerAgentKey => k !== "queen_bee" && k !== "watchdog");

export const TASK_STATUSES = [
  "todo",
  "analysis",
  "in_progress",
  "waiting",
  "to_validate",
  "validated",
  "scheduled",
  "published",
  "done",
  "error",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  analysis: "Analyse",
  in_progress: "En cours",
  waiting: "En attente",
  to_validate: "À valider",
  validated: "Validé",
  scheduled: "Programmé",
  published: "Publié",
  done: "Terminé",
  error: "Erreur",
};

/** Statuts qui débloquent les tâches dépendantes. */
export const SATISFIED_STATUSES: readonly TaskStatus[] = ["done", "validated", "scheduled", "published"];

export type MissionStatus = "planned" | "running" | "waiting_input" | "waiting_validation" | "done" | "error";

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  planned: "Planifiée",
  running: "En cours",
  waiting_input: "En attente",
  waiting_validation: "À valider",
  done: "Terminée",
  error: "Erreur",
};

/** Ressources dont une tâche a besoin pour s'exécuter réellement. */
export type Capability = "llm" | "web_search" | "instagram" | "linkedin" | "video_upload" | "video_provider" | "analytics_data" | "clubs_data";

export type DeliverableKind =
  | "strategy_brief"
  | "research_note"
  | "idea"
  | "calendar_entry"
  | "hook"
  | "script"
  | "caption"
  | "carousel"
  | "post"
  | "story"
  | "email"
  | "linkedin_post"
  | "landing_copy"
  | "storyboard"
  | "visual_brief"
  | "publication_plan"
  | "lead_funnel"
  | "kpi_plan"
  | "brand_review";

export type Deliverable = {
  kind: DeliverableKind;
  title: string;
  content: string;
  platform?: "instagram" | "linkedin" | "facebook" | "tiktok" | "youtube" | "email" | "landing";
  pillar?: Pillar;
  mode?: CreationMode;
  scheduledFor?: string; // ISO, proposition (aucune programmation tant que non validé)
};

/** Sortie normalisée de tout agent : décisions et livrables, jamais de raisonnement interne. */
export type AgentOutput = {
  summary: string;
  decisions: string[];
  deliverables: Deliverable[];
  /** Points que l'agent n'a pas pu établir (données absentes, source manquante…). */
  limitations: string[];
};

export type TaskSpec = {
  key: string;
  agent: WorkerAgentKey;
  title: string;
  dependsOn: string[];
  needs: Capability[];
  requiresApproval?: boolean;
  /** Consigne spécifique à la tâche, ajoutée au rôle de l'agent. */
  instruction: string;
};

export type MissionTemplateKey =
  | "weekly_content"
  | "club_invitation"
  | "studio_to_reels"
  | "ai_video"
  | "content_ideas"
  | "editorial_calendar"
  | "performance_analysis"
  | "lead_campaign"
  | "event_communication"
  | "training_launch";

export type Mission = {
  id: string;
  organizationId: string;
  title: string;
  request: string;
  template: MissionTemplateKey;
  objective: string;
  status: MissionStatus;
  isDemo: boolean;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type MissionTask = {
  id: string;
  missionId: string;
  key: string;
  agent: WorkerAgentKey;
  title: string;
  instruction: string;
  status: TaskStatus;
  needs: Capability[];
  requiresApproval: boolean;
  dependsOn: string[]; // ids de tâches
  output: AgentOutput | null;
  waitingReason: string | null;
  error: string | null;
  attempts: number;
  position: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type ActivityEvent = {
  id: string;
  missionId: string | null;
  taskId: string | null;
  actor: AgentKey | "user" | "system";
  message: string;
  createdAt: string;
};

export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";

export type Approval = {
  id: string;
  missionId: string;
  taskId: string;
  agent: AgentKey;
  title: string;
  status: ApprovalStatus;
  comment: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type BrandMemory = {
  company: string;
  description: string;
  positioning: string;
  targets: string[];
  offers: string[];
  tone: string;
  allowedWords: string[];
  forbiddenWords: string[];
  ctas: string[];
  references: string[];
  pillarWeights: Record<Pillar, number>;
};
