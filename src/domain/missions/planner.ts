import { normalize } from "./text";
import { MISSION_TEMPLATES } from "./templates";
import type { MissionTemplateKey, TaskSpec } from "./types";

type Rule = { template: MissionTemplateKey; patterns: RegExp[] };

// Ordre = priorité : la première règle qui correspond l'emporte.
const RULES: Rule[] = [
  // Une demande « semaine » est un plan de contenus, même si elle cite une vidéo ou les clubs.
  { template: "weekly_content", patterns: [/\bsemaine\b/, /\b7 jours\b/] },
  { template: "studio_to_reels", patterns: [/\b(video|rush|tournage|tourne)\b.*\b(studio|tourne|telephone|importe|ma video)\b/, /transforme.*video/, /ma video/] },
  { template: "ai_video", patterns: [/video.*(100 ?% ?ia|ia|intelligence artificielle|generee)/, /(100 ?% ?ia)/] },
  { template: "club_invitation", patterns: [/\b(club|visite|visiter|invit)/] },
  { template: "performance_analysis", patterns: [/\b(analys|performance|statistique|resultat|kpi)/] },
  { template: "editorial_calendar", patterns: [/calendrier/, /\b30 jours\b/, /\bmois\b/] },
  { template: "training_launch", patterns: [/\bformation\b.*\b(lance|lancement|nouvelle)\b/, /\b(lance|lancement)\b.*\bformation\b/, /beeschool/] },
  { template: "event_communication", patterns: [/\b(evenement|soiree|salon|conference|webinaire)\b/] },
  { template: "lead_campaign", patterns: [/\b(lead|prospect|generation de)\b/, /\bcampagne\b/] },
  { template: "content_ideas", patterns: [/\bidees?\b/] },
  { template: "weekly_content", patterns: [/\bcontenus?\b/, /\bposts?\b/, /\breels?\b/] },
];

export type PlanDraft = {
  template: MissionTemplateKey;
  title: string;
  objective: string;
  tasks: TaskSpec[];
  /** Comment le modèle de mission a été choisi (affiché à l'utilisateur). */
  reason: string;
};

/** Classement déterministe de la demande. Retourne null si rien ne correspond clairement. */
export function classifyRequest(request: string): { template: MissionTemplateKey; matched: string } | null {
  const text = normalize(request);
  for (const rule of RULES) {
    const hit = rule.patterns.find((p) => p.test(text));
    if (hit) return { template: rule.template, matched: hit.source };
  }
  return null;
}

export function buildPlan(request: string, template: MissionTemplateKey, reason: string): PlanDraft {
  const t = MISSION_TEMPLATES[template];
  const trimmed = request.trim().replace(/\s+/g, " ");
  const title = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
  return { template, title: title || t.label, objective: t.objective, tasks: t.tasks, reason };
}

export function planFromRequest(request: string): PlanDraft {
  const c = classifyRequest(request);
  if (c) return buildPlan(request, c.template, `Modèle « ${MISSION_TEMPLATES[c.template].label} » choisi d'après votre demande.`);
  return buildPlan(request, "weekly_content", "Aucun modèle spécifique détecté : plan de contenus par défaut, ajustable.");
}
