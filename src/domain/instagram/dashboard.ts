/**
 * Tableau de bord de l'onglet Post : chaque création (réel du Studio ou post) est rangée dans une seule étape, d'après
 * son état réel. Aucune étape n'est supposée : un réel n'est « prêt » que si son MP4 est rendu, un post que s'il a
 * au moins une photo et une légende.
 */
import type { Publication } from "./publication";

export const STAGES = ["preparation", "pret", "publication", "publie"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = { preparation: "En préparation", pret: "Prêts à publier", publication: "En publication", publie: "Publiés" };

export type ReelFacts = { renderStatus?: string | null; finalVideoUrl?: string | null };

export function stageOf(item: { kind: "reel"; reel: ReelFacts; pub?: Publication | null } | { kind: "post"; pub: Publication }): Stage {
  const pub = item.pub ?? null;
  if (pub?.status === "published") return "publie";
  if (pub?.status === "publishing") return "publication";
  if (item.kind === "reel") return item.reel.renderStatus === "done" && item.reel.finalVideoUrl ? "pret" : "preparation";
  return pub && pub.status !== "error" && pub.media.length > 0 && pub.caption.trim() ? "pret" : "preparation";
}

export function countByStage(stages: Stage[]): Record<Stage, number> {
  const out = { preparation: 0, pret: 0, publication: 0, publie: 0 } as Record<Stage, number>;
  for (const s of stages) out[s] += 1;
  return out;
}
