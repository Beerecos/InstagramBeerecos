import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";
import { Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Conversations" };

export default function ConversationsPage() {
  return (
    <>
      <PageHeader eyebrow="Conversations" title="Inbox Instagram" description="Les DM issus des commentaires, avec le contenu d’origine, le score et le club suggéré." />
      <ComingSoon phase={5} features={["Réponse suggérée par Claude, envoi en un clic", "Prendre la main à tout moment", "Proposer une invitation et choisir le club", "Aucun envoi automatique si la confiance est faible"]}>
        <Card>
          <EmptyState icon={<MessagesSquare />} title="Aucune conversation">Les conversations arriveront dès que ManyChat (ou Instagram) sera connecté.</EmptyState>
        </Card>
      </ComingSoon>
    </>
  );
}
