import { z } from "zod";

/** Schéma de sortie commun à tous les agents (validé par le fournisseur IA et à la lecture). */
export const AgentOutputSchema = z.object({
  summary: z.string().describe("Résumé en 1 à 3 phrases de ce qui a été produit"),
  decisions: z.array(z.string()).describe("Décisions prises, chacune avec sa justification en une phrase"),
  deliverables: z.array(
    z.object({
      kind: z.enum([
        "strategy_brief", "research_note", "idea", "calendar_entry", "hook", "script", "caption", "carousel", "post", "story",
        "email", "linkedin_post", "landing_copy", "storyboard", "visual_brief", "publication_plan", "lead_funnel", "kpi_plan", "brand_review",
      ]),
      title: z.string(),
      content: z.string().describe("Contenu complet, prêt à relire"),
      platform: z.enum(["instagram", "linkedin", "facebook", "tiktok", "youtube", "email", "landing"]).optional(),
      pillar: z.enum(["reseau_monetise", "formation", "digitalisation_ia"]).optional(),
      mode: z.enum(["ai", "human", "hybrid"]).optional(),
      scheduledFor: z.string().optional().describe("Date et heure proposées au format ISO 8601"),
    }),
  ),
  limitations: z.array(z.string()).describe("Ce qui n'a pas pu être établi faute de données ou de source"),
});
