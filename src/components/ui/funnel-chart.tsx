import { cn } from "./cn";

export type FunnelStage = { key: string; label: string; value: number | null };

const fmt = new Intl.NumberFormat("fr-FR");
const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });

/**
 * Entonnoir de conversion : une seule série, donc une seule teinte (séquentielle),
 * barres horizontales à partir d'une ligne de base commune, valeurs et taux écrits.
 * Le tableau accessible porte les mêmes données pour les lecteurs d'écran.
 */
export function FunnelChart({ stages, title }: { stages: FunnelStage[]; title: string }) {
  const max = Math.max(1, ...stages.map((s) => s.value ?? 0));
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <ol aria-hidden className="space-y-1.5">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].value : null;
          const rate = s.value !== null && prev ? s.value / prev : null;
          return (
            <li key={s.key} className="group grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-3 text-sm" title={rate !== null ? `${s.label} : ${fmt.format(s.value ?? 0)} (${pct.format(rate)} de l'étape précédente)` : s.label}>
              <span className="truncate text-ink-2">{s.label}</span>
              <span className="h-5 rounded-r-[4px] bg-[var(--seq-track)]">
                <span className={cn("block h-full rounded-r-[4px] bg-[var(--seq-1)] transition-[width] group-hover:brightness-110")} style={{ width: s.value ? `${Math.max(1.5, (s.value / max) * 100)}%` : "0%" }} />
              </span>
              <span className="text-right tabular-nums text-ink-1">
                {s.value === null ? "—" : fmt.format(s.value)}
                {rate !== null ? <span className="block text-[11px] text-ink-3">{pct.format(rate)}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>Étape</th><th>Volume</th></tr></thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.key}><td>{s.label}</td><td>{s.value === null ? "Non disponible" : fmt.format(s.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
