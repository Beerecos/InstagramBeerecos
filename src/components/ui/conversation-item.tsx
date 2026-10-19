import { cn } from "./cn";
import type { LeadTemperature } from "./lead-card";
import { StatusBadge } from "./status-badge";

export function ConversationItem({ handle, preview, at, unread, temperature, active }: { handle: string; preview: string; at: string; unread?: boolean; temperature?: LeadTemperature; active?: boolean }) {
  return (
    <div className={cn("flex gap-3 rounded-xl p-3", active ? "bg-surface-2" : "hover:bg-surface-2")}>
      <div aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-honey-soft text-sm font-semibold text-ink-1">
        {handle.replace("@", "").slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-sm", unread ? "font-semibold text-ink-1" : "text-ink-1")}>{handle}</span>
          <time className="shrink-0 text-xs text-ink-3">{at}</time>
        </div>
        <p className={cn("truncate text-sm", unread ? "text-ink-1" : "text-ink-2")}>{preview}</p>
        {temperature ? <StatusBadge status={temperature} className="mt-1" /> : null}
      </div>
      {unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-honey" aria-label="Non lu" /> : null}
    </div>
  );
}
