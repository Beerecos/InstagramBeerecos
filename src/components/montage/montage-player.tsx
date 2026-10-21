"use client";

import { createElement, useEffect, useState } from "react";

/**
 * Aperçu en direct du montage avec le lecteur officiel Hyperframes : la composition (coupes, sous-titres, animations)
 * est recalculée par le serveur à chaque version ; aucune image n'est rendue tant qu'on ne demande pas le MP4.
 */
export function MontagePlayer({ montageId, version, title }: { montageId: string; version: string; title: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    import("@hyperframes/player").then(() => alive && setReady(true)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const src = `/api/montages/${montageId}/composition?v=${encodeURIComponent(version)}`;
  return (
    <div className="aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line" data-testid="montage-preview">
      {ready
        ? createElement("hyperframes-player", { key: src, src, width: 1080, height: 1920, controls: true, "aria-label": `Aperçu du montage « ${title} »`, style: { display: "block", width: "100%", height: "100%" } })
        : null}
    </div>
  );
}
