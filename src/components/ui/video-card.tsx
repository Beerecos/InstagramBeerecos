import { Play } from "lucide-react";
import type { VideoState } from "@/domain/content";
import { StatusBadge } from "./status-badge";

export function VideoCard({ title, posterUrl, durationSeconds, state, progress }: { title: string; posterUrl?: string; durationSeconds?: number; state: VideoState; progress?: { step: string; current: number; total: number } }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-line">
      <div className="relative aspect-[9/16] max-h-72 bg-surface-2">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase, dimensions inconnues
          <img src={posterUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-3"><Play aria-hidden /></div>
        )}
        {durationSeconds ? <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 text-xs text-white tabular-nums">{Math.round(durationSeconds)} s</span> : null}
      </div>
      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-ink-1">{title}</h3>
        <StatusBadge status={state} />
        {progress ? (
          <div>
            <div className="flex justify-between text-xs text-ink-2"><span>{progress.step}</span><span className="tabular-nums">{progress.current}/{progress.total}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.current} aria-label={progress.step}>
              <div className="h-full rounded-full bg-[var(--seq-1)]" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
