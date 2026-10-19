import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";

/** Section dont le moteur arrive dans une phase ultérieure : on montre ce qu'elle fera, sans données fictives. */
export function ComingSoon({ phase, features, children }: { phase: number; features: string[]; children?: ReactNode }) {
  return (
    <div className="space-y-6">
      {children}
      <Card className="bg-surface-2/60">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">Arrive en phase {phase}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink-2">
              <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-ink-3" />
              {f}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
