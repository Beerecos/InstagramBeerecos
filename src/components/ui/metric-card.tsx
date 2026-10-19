import type { ReactNode } from "react";
import { cn } from "./cn";

const fmt = new Intl.NumberFormat("fr-FR");

/** Valeur nulle = donnée indisponible (« — »), distincte de zéro. */
export function MetricCard({ label, value, hint, delta, icon, emphasis = false }: { label: string; value: number | null; hint?: string; delta?: { value: number; period: string }; icon?: ReactNode; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-card p-4 ring-1", emphasis ? "bg-brand text-brand-ink ring-brand" : "bg-surface-1 ring-line")}>
      <div className={cn("flex items-center justify-between text-xs font-medium uppercase tracking-wide", emphasis ? "opacity-80" : "text-ink-3")}>
        {label}
        {icon}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value === null ? "—" : fmt.format(value)}</p>
      {delta ? (
        <p className={cn("mt-1 text-xs", emphasis ? "opacity-80" : "text-ink-2")}>
          {delta.value >= 0 ? "▲" : "▼"} {fmt.format(Math.abs(delta.value))} % {delta.period}
        </p>
      ) : hint ? (
        <p className={cn("mt-1 text-xs", emphasis ? "opacity-80" : "text-ink-2")}>{hint}</p>
      ) : null}
    </div>
  );
}
