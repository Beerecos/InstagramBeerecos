import { AGENTS } from "@/domain/missions/agents";
import type { AgentKey } from "@/domain/missions/types";
import { cn } from "@/components/ui/cn";

const INITIALS: Record<AgentKey, string> = {
  queen_bee: "QB",
  strategist: "St",
  researcher: "Re",
  content_architect: "CA",
  copywriter: "Co",
  video_director: "Vi",
  creative_director: "Cr",
  social_manager: "SM",
  lead_agent: "Le",
  analytics_agent: "An",
  brand_guardian: "BG",
};

/** Monogramme sobre (pas d'avatar cartoon). Queen Bee porte la couleur de marque, les agents un ton neutre. */
export function AgentAvatar({ agent, size = "md", active = false }: { agent: AgentKey; size?: "sm" | "md" | "lg"; active?: boolean }) {
  const s = size === "sm" ? "size-7 text-[10px]" : size === "lg" ? "size-12 text-sm" : "size-9 text-xs";
  return (
    <span
      title={AGENTS[agent].name}
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-xl font-semibold tracking-tight",
        s,
        agent === "queen_bee" ? "bg-brand text-white" : "bg-surface-2 text-ink-1 ring-1 ring-line",
      )}
    >
      {INITIALS[agent]}
      {active ? (
        <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2.5 rounded-full bg-brand ring-2 ring-surface-1" />
        </span>
      ) : null}
    </span>
  );
}
