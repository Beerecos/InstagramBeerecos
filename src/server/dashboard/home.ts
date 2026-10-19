import "server-only";
import type { FunnelStage } from "@/components/ui/funnel-chart";

export type HomeSnapshot = {
  connected: boolean;
  today: { nextPublication: string | null; toReview: number | null; inboundDms: number | null; hotLeads: number | null; invitations: number | null; upcomingVisitors: number | null };
  kpis: { views: number | null; leads: number | null; invitations: number | null; visits: number | null; memberships: number | null };
  funnel: FunnelStage[];
  insight: string | null;
};

export const FUNNEL_STAGES: Array<Pick<FunnelStage, "key" | "label">> = [
  { key: "views", label: "Vues" },
  { key: "comments", label: "Commentaires" },
  { key: "dms", label: "DM" },
  { key: "leads", label: "Prospects" },
  { key: "qualified", label: "Prospects qualifiés" },
  { key: "invitations", label: "Invitations" },
  { key: "bookings", label: "Réservations" },
  { key: "attended", label: "Présences" },
  { key: "memberships", label: "Adhésions" },
];

/**
 * Tableau de bord d'accueil. Les sources (contenus, leads, invitations, analytics) arrivent
 * aux phases 2 à 7 : en attendant, toutes les valeurs sont « non disponibles » (null), jamais inventées.
 */
export async function getHomeSnapshot(): Promise<HomeSnapshot> {
  return {
    connected: false,
    today: { nextPublication: null, toReview: null, inboundDms: null, hotLeads: null, invitations: null, upcomingVisitors: null },
    kpis: { views: null, leads: null, invitations: null, visits: null, memberships: null },
    funnel: FUNNEL_STAGES.map((s) => ({ ...s, value: null })),
    insight: null,
  };
}
