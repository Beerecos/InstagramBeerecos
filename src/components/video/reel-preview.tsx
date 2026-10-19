"use client";

import { Download } from "lucide-react";
import { createElement, useEffect, useState } from "react";

/**
 * Aperçu d'un Reel motion design avec le lecteur officiel Hyperframes (@hyperframes/player, Apache-2.0).
 * La composition est servie par /api/compositions/[taskId] ; le rendu MP4 se fait hors de l'application.
 */
export function ReelPreview({ taskId, index = 0, title }: { taskId: string; index?: number; title: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    import("@hyperframes/player").then(() => alive && setReady(true)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const src = `/api/compositions/${taskId}?i=${index}`;
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line" data-testid="reel-preview">
        {ready ? createElement("hyperframes-player", { src, width: 1080, height: 1920, controls: true, muted: true, autoplay: true, loop: true, "low-power-idle": true, "aria-label": `Aperçu du Reel « ${title} »`, style: { display: "block", width: "100%", height: "100%" } }) : null}
      </div>
      <div className="space-y-2 text-xs text-ink-3">
        <p>Aperçu Hyperframes 1080×1920. Le MP4 se rend avec Hyperframes, après votre validation.</p>
        <a href={`${src}&download=1`} className="inline-flex items-center gap-1 font-medium text-brand" download>
          <Download size={14} aria-hidden /> Télécharger la composition
        </a>
      </div>
    </div>
  );
}
