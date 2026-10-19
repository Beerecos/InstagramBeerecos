import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Bienvenue" };

export default function WelcomePage() {
  return (
    <>
      <PageHeader eyebrow="Première connexion" title="Créons l'espace BeeRecos" description="Tu en deviens administrateur. Le mode d'autonomie démarre en « Manuel » : rien n'est publié ni envoyé sans ta validation." />
      <OnboardingForm />
    </>
  );
}
