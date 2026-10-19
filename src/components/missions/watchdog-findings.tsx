import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import type { WatchdogFinding } from "@/domain/missions/watchdog";

const ICON = { critical: AlertOctagon, warning: AlertTriangle, info: Info } as const;
const CLS = {
  critical: "text-status-critical",
  warning: "text-[#6b4700] dark:text-[#f6c860]",
  info: "text-ink-3",
} as const;

export function HealthBadge({ health }: { health: number }) {
  const cls = health >= 80 ? "bg-[#dff5ee] text-[#0f6b4f] dark:bg-[#123a2e] dark:text-[#7fe0bd]" : health >= 50 ? "bg-[#fdf1d6] text-[#6b4700] dark:bg-[#3a2e10] dark:text-[#f6c860]" : "bg-[#fde2e2] text-[#8a1c1c] dark:bg-[#3d1515] dark:text-[#f5a3a3]";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`} aria-label={`Santé ${health} sur 100`}>{health}/100</span>;
}

export function WatchdogFindings({ findings, empty = "Rien à signaler." }: { findings: WatchdogFinding[]; empty?: string }) {
  if (!findings.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-2">
      {findings.map((f, i) => {
        const Icon = ICON[f.severity];
        return (
          <li key={`${f.code}-${f.taskId ?? i}`} className="flex gap-2 text-sm">
            <Icon aria-hidden size={16} className={`mt-0.5 shrink-0 ${CLS[f.severity]}`} />
            <span className="text-ink-1">{f.message}{f.action.type !== "none" ? <span className="text-ink-3"> — réparation automatique</span> : null}</span>
          </li>
        );
      })}
    </ul>
  );
}
