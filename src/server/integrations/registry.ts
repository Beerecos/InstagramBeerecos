import "server-only";
import type { ServerEnv } from "@/lib/env/schema";
import type { ConnectionStatus } from "@/providers/types";

export type IntegrationId = "instagram" | "linkedin" | "claude" | "veo" | "runway" | "google_drive" | "supabase";

export type IntegrationCard = {
  id: IntegrationId;
  name: string;
  role: string;
  /** Variables d'environnement serveur nécessaires (noms seulement, jamais les valeurs). */
  requiredEnv: (keyof ServerEnv)[];
  permissions: string[];
  phase: number;
};

export const INTEGRATIONS: IntegrationCard[] = [
  { id: "supabase", name: "Supabase", role: "Base de données, authentification, stockage", requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"], permissions: ["Lecture/écriture des données BeeMarketing (RLS)"], phase: 1 },
  { id: "claude", name: "Claude", role: "Intelligence de l'orchestrateur et des agents", requiredEnv: ["ANTHROPIC_API_KEY"], permissions: ["Appels modèle"], phase: 2 },
  { id: "google_drive", name: "Google Drive", role: "Import des contenus et médias BeeRecos existants", requiredEnv: ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET"], permissions: ["Lecture des fichiers choisis"], phase: 2 },
  { id: "veo", name: "Google Veo", role: "Génération de scènes vidéo IA", requiredEnv: ["GOOGLE_VEO_API_KEY"], permissions: ["Génération vidéo (payant)"], phase: 3 },
  { id: "runway", name: "Runway", role: "Génération et transformation vidéo IA", requiredEnv: ["RUNWAY_API_KEY"], permissions: ["Génération vidéo (payant)"], phase: 3 },
  { id: "instagram", name: "Instagram", role: "Publication des Reels et posts, statistiques, commentaires → DM (API officielle Meta, sans abonnement)", requiredEnv: ["IG_ACCESS_TOKEN", "IG_USER_ID", "IG_APP_SECRET", "IG_VERIFY_TOKEN"], permissions: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_comments", "instagram_business_manage_messages"], phase: 4 },
  { id: "linkedin", name: "LinkedIn", role: "Publication sur ton profil et la page BeeRecos, statistiques (API officielle)", requiredEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"], permissions: ["w_member_social (profil)", "w_organization_social et r_organization_social (page, après validation LinkedIn)"], phase: 4 },
];

export type IntegrationState = IntegrationCard & { status: ConnectionStatus; missing: string[]; verified: boolean };

/** Statut basé sur la configuration ; le test de connexion réel est fait par l'adapter (healthCheck). */
export function integrationStates(env: ServerEnv): IntegrationState[] {
  return INTEGRATIONS.map((card) => {
    const missing = card.requiredEnv.filter((k) => !env[k]).map(String);
    return { ...card, missing, status: missing.length === 0 ? "connected" : "not_configured", verified: false };
  });
}
