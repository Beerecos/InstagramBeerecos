import type { ReactNode } from "react";

export type TimelineEvent = { id: string; at: string; title: string; detail?: ReactNode; icon?: ReactNode };

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span aria-hidden className="absolute -left-[27px] top-0.5 flex size-3.5 items-center justify-center rounded-full bg-surface-1 ring-2 ring-line">{e.icon}</span>
          <time className="text-xs text-ink-3">{e.at}</time>
          <p className="text-sm font-medium text-ink-1">{e.title}</p>
          {e.detail ? <div className="text-sm text-ink-2">{e.detail}</div> : null}
        </li>
      ))}
    </ol>
  );
}
