/**
 * Projet de réel : vue unifiée d'un montage (fonction serveur `montage`, base BeeMarketing partagée).
 * Règle pure : statut lisible et prochaine action utile, déduits uniquement des champs réels renvoyés par le serveur.
 * Trois états distincts, jamais confondus : préparation du projet, traitement du rendu, validation éditoriale.
 * « Exporté » ne signifie jamais « publié ».
 */
import type { MontageStatus } from "@/domain/social/montage/montage";

export type ReelSource = "filme" | "ia";
export type ReelProjectFacts = {
  status: MontageStatus;
  renderStatus: "rendering" | "done" | "failed" | null;
  finalVideoUrl?: string | null;
  sentToReels?: boolean;
  previewApproved?: boolean;
  hasEdit?: boolean;
};
export type ReelStage = "preparation" | "rendu" | "validation" | "exporte";
export type ReelState = { stage: ReelStage; label: string; next: string; tone: "neutral" | "busy" | "ok" | "error" };

export function reelState(f: ReelProjectFacts): ReelState {
  if (f.status === "error") return { stage: "preparation", label: "Erreur sur la prise", next: "Ouvrir le projet et relancer l'étape en échec", tone: "error" };
  if (f.status === "uploading") return { stage: "preparation", label: "Envoi de la vidéo", next: "Terminer l'envoi de la vidéo", tone: "busy" };
  if (f.status === "uploaded") return { stage: "preparation", label: "Vidéo reçue", next: "Lancer la transcription", tone: "neutral" };
  if (f.status === "transcribing") return { stage: "preparation", label: "Transcription en cours", next: "Attendre la fin de la transcription", tone: "busy" };
  if (f.renderStatus === "rendering") return { stage: "rendu", label: "Rendu MP4 en cours", next: "Suivre le rendu", tone: "busy" };
  if (f.renderStatus === "failed") return { stage: "rendu", label: "Rendu échoué", next: "Corriger puis relancer le rendu", tone: "error" };
  if (f.renderStatus === "done" && f.finalVideoUrl) return { stage: "exporte", label: f.sentToReels ? "MP4 prêt · transféré" : "MP4 prêt", next: "Télécharger la vidéo, la couverture et la légende", tone: "ok" };
  if (f.previewApproved) return { stage: "validation", label: "Version validée", next: "Lancer le rendu MP4", tone: "ok" };
  return { stage: "preparation", label: f.hasEdit === false ? "Prêt à monter" : "Montage en cours", next: "Monter puis valider la planche contact", tone: "neutral" };
}

/** Recherche simple sur le titre (sans accents ni casse). */
export const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const matchesQuery = (title: string, q: string) => !q.trim() || normalize(title).includes(normalize(q.trim()));
