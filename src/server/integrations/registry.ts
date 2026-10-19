import "server-only";
import type { ServerEnv } from "@/lib/env/schema";
import type { ConnectionStatus } from "@/providers/types";

export type IntegrationId = "instagram" | "metricool" | "manychat" | "claude" | "veo" | "runway" | "google_drive" | "supabase";

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
  { id: "metricool", name: "Metricool", role: "Programmation des publications et statistiques", requiredEnv: ["METRICOOL_MCP_URL", "METRICOOL_API_TOKEN"], permissions: ["Programmer, modifier, annuler", "Lire les statistiques"], phase: 4 },
  { id: "manychat", name: "ManyChat", role: "Commentaires → DM Instagram", requiredEnv: ["MANYCHAT_API_TOKEN", "MANYCHAT_WEBHOOK_SECRET"], permissions: ["Envoyer des messages en réponse", "Recevoir les événements"], phase: 5 },
  { id: "instagram", name: "Instagram (Meta)", role: "Connexion directe au compte (option)", requiredEnv: ["IG_ACCESS_TOKEN", "IG_USER_ID", "IG_APP_SECRET"], permissions: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_comments", "instagram_business_manage_messages"], phase: 5 },
];

export type IntegrationState = IntegrationCard & { status: ConnectionStatus; missing: string[]; verified: boolean };

/** Statut basé sur la configuration ; le test de connexion réel est fait par l'adapter (healthCheck). */
export function integrationStates(env: ServerEnv): IntegrationState[] {
  return INTEGRATIONS.map((card) => {
    const missing = card.requiredEnv.filter((k) => !env[k]).map(String);
    return { ...card, missing, status: missing.length === 0 ? "connected" : "not_configured", verified: false };
  });
}
