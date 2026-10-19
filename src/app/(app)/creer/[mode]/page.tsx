import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Créer" };

const TITLES = { ai: "Créer avec l'IA", human: "Utiliser ma vidéo", hybrid: "Créer une vidéo hybride" } as const;

export function generateStaticParams() {
  return Object.keys(TITLES).map((mode) => ({ mode }));
}

export default async function CreateModePage({ params }: PageProps<"/creer/[mode]">) {
  const { mode } = await params;
  if (!(mode in TITLES)) notFound();
  return (
    <>
      <PageHeader eyebrow="Créer" title={TITLES[mode as keyof typeof TITLES]} />
      <Card>
        <EmptyState icon={<Construction />} title="Assistant de création en cours de construction" action={<ButtonLink href="/creer" variant="secondary">Retour</ButtonLink>}>
          {mode === "ai" ? "Le moteur éditorial (phase 2) puis la génération vidéo (phase 3) alimenteront cet assistant." : "Le studio vidéo (phase 3) alimentera cet assistant : upload, transcription, détection des meilleurs passages."}
        </EmptyState>
      </Card>
    </>
  );
}
