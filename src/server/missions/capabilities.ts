import "server-only";
import type { Capability } from "@/domain/missions/types";
import type { ServerEnv } from "@/lib/env/schema";

/**
 * Ressources réellement disponibles. Une capacité n'est déclarée que si l'intégration correspondante
 * existe ET est configurée : sans adapter vidéo, sans import de média ni données d'analytics, elles restent absentes.
 */
export function availableCapabilities(env: ServerEnv): Set<Capability> {
  const caps = new Set<Capability>();
  if (env.ANTHROPIC_API_KEY) {
    caps.add("llm");
    caps.add("web_search");
  }
  if (env.IG_ACCESS_TOKEN && env.IG_USER_ID) caps.add("instagram");
  if (env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET) caps.add("linkedin");
  // video_upload, video_provider, analytics_data, clubs_data : ajoutés avec la bibliothèque média (MVP 2),
  // les adapters Veo/Runway, la synchronisation des statistiques et la base clubs.
  return caps;
}
