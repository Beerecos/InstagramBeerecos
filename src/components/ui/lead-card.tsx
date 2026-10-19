import { MapPin } from "lucide-react";
import { StatusBadge } from "./status-badge";

export type LeadTemperature = "cold" | "warm" | "hot";

export function LeadCard({ name, city, profession, temperature, score, source }: { name: string; city?: string; profession?: string; temperature: LeadTemperature; score?: number; source?: string }) {
  return (
    <article className="rounded-2xl bg-surface-1 p-3 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-ink-1">{name}</h3>
          {profession ? <p className="text-sm text-ink-2">{profession}</p> : null}
        </div>
        <StatusBadge status={temperature} label={score !== undefined ? `${STATUS_LABEL[temperature]} · ${score}` : undefined} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-ink-3">
        {city ? <span className="inline-flex items-center gap-1"><MapPin aria-hidden size={12} />{city}</span> : null}
        {source ? <span>Source : {source}</span> : null}
      </div>
    </article>
  );
}

const STATUS_LABEL: Record<LeadTemperature, string> = { cold: "Froid", warm: "Tiède", hot: "Chaud" };
