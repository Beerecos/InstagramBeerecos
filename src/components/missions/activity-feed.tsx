import { AGENTS } from "@/domain/missions/agents";
import { AGENT_KEYS, type ActivityEvent, type AgentKey } from "@/domain/missions/types";
import { AgentAvatar } from "./agent-avatar";

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function actorName(actor: ActivityEvent["actor"]): string {
  if (actor === "user") return "Vous";
  if (actor === "system") return "Système";
  return AGENTS[actor].name;
}

/** Chaque ligne correspond à un événement réellement enregistré par le moteur ou une décision humaine. */
export function ActivityFeed({ events, emptyLabel = "Aucune activité pour l'instant." }: { events: ActivityEvent[]; emptyLabel?: string }) {
  if (events.length === 0) return <p className="py-6 text-center text-sm text-ink-3">{emptyLabel}</p>;
  const today = new Date().toDateString();
  return (
    <ol className="space-y-3" aria-label="Fil d'activité">
      {events.map((e) => {
        const d = new Date(e.createdAt);
        const isAgent = (AGENT_KEYS as readonly string[]).includes(e.actor);
        return (
          <li key={e.id} className="flex gap-3">
            {isAgent ? (
              <AgentAvatar agent={e.actor as AgentKey} size="sm" />
            ) : (
              <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[10px] font-semibold text-ink-2">{e.actor === "user" ? "Vous" : "Sys"}</span>
            )}
            <div className="min-w-0 text-sm">
              <p className="text-ink-1">
                <span className="font-medium">{actorName(e.actor)}</span> <span className="text-ink-2">{e.message.replace(new RegExp(`^${actorName(e.actor)} `), "")}</span>
              </p>
              <time className="text-xs tabular-nums text-ink-3" dateTime={e.createdAt}>
                {d.toDateString() === today ? timeFmt.format(d) : `${dayFmt.format(d)} · ${timeFmt.format(d)}`}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
