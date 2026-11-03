import type { Metadata } from "next";
import StudioHome from "@/components/reels/studio-home";

export const metadata: Metadata = { title: "Studio" };

/** Accueil : le studio s'ouvre directement sur le dernier projet (choix du projet dans sa barre d'outils). */
export default function HomePage() {
  return <StudioHome />;
}
