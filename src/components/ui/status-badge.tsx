import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Flame, Snowflake, Sun, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "progress" | "good" | "warning" | "critical" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  progress: "bg-accent-soft text-[#1f43e6] dark:text-[#9fb2ff]",
  good: "bg-[#e3f4e3] text-[#0a6e0a] dark:bg-[#183018] dark:text-[#7fd67f]",
  warning: "bg-[#fdf1d6] text-[#8a5a00] dark:bg-[#3a2e10] dark:text-[#f6c860]",
  critical: "bg-[#fbe4e4] text-[#a32626] dark:bg-[#3b1a1a] dark:text-[#f19a9a]",
  brand: "bg-accent-soft text-[#1f43e6] dark:text-[#9fb2ff]",
};
const ICONS: Record<Tone, ReactNode> = {
  neutral: <CircleDashed aria-hidden size={12} />,
  progress: <Clock aria-hidden size={12} />,
  good: <CheckCircle2 aria-hidden size={12} />,
  warning: <AlertTriangle aria-hidden size={12} />,
  critical: <XCircle aria-hidden size={12} />,
  brand: <Sun aria-hidden size={12} />,
};

/** Statuts connus de l'application → libellé français + ton. Le libellé accompagne toujours la couleur. */
export const STATUS_MAP: Record<string, { label: string; tone: Tone; icon?: ReactNode }> = {
  // cycle éditorial
  idea: { label: "Idée", tone: "neutral" },
  script: { label: "Script", tone: "neutral" },
  production: { label: "Production", tone: "progress" },
  review: { label: "À valider", tone: "warning" },
  approved: { label: "Validé", tone: "good" },
  scheduled: { label: "Programmé", tone: "progress" },
  published: { label: "Publié", tone: "good" },
  analyzed: { label: "Analysé", tone: "neutral" },
  // vidéo
  draft: { label: "Brouillon", tone: "neutral" },
  script_ready: { label: "Script prêt", tone: "neutral" },
  storyboard_ready: { label: "Storyboard prêt", tone: "neutral" },
  generating: { label: "Génération", tone: "progress" },
  assembling: { label: "Montage", tone: "progress" },
  ready_for_review: { label: "À valider", tone: "warning" },
  failed: { label: "Échec", tone: "critical" },
  archived: { label: "Archivé", tone: "neutral" },
  // intégrations
  connected: { label: "Connecté", tone: "good" },
  configured: { label: "Configuré", tone: "progress" },
  not_configured: { label: "À configurer", tone: "warning" },
  error: { label: "Erreur", tone: "critical" },
  // leads
  cold: { label: "Froid", tone: "neutral", icon: <Snowflake aria-hidden size={12} /> },
  warm: { label: "Tiède", tone: "warning", icon: <Sun aria-hidden size={12} /> },
  hot: { label: "Chaud", tone: "critical", icon: <Flame aria-hidden size={12} /> },
};

export function StatusBadge({ status, label, tone, className }: { status?: string; label?: string; tone?: Tone; className?: string }) {
  const known = status ? STATUS_MAP[status] : undefined;
  const t = tone ?? known?.tone ?? "neutral";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TONES[t], className)}>
      {known?.icon ?? ICONS[t]}
      {label ?? known?.label ?? status}
    </span>
  );
}
