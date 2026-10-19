import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function AgentMessage({ role, children }: { role: "user" | "agent"; children: ReactNode }) {
  const agent = role === "agent";
  return (
    <div className={cn("flex gap-3", agent ? "" : "flex-row-reverse")}>
      {agent ? (
        <div aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles size={16} /></div>
      ) : null}
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed", agent ? "bg-surface-1 text-ink-1 ring-1 ring-line" : "bg-brand text-brand-ink")}>
        <span className="sr-only">{agent ? "BeeMarketing : " : "Vous : "}</span>
        {children}
      </div>
    </div>
  );
}
