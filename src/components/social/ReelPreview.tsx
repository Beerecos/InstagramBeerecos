"use client";
import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { Edit, Placement } from "@/domain/social/montage/edit";

/** Commandes exposées par l'aperçu : sauter à un instant, lire, mettre en pause, rejouer depuis le début. */
export type ReelPreviewHandle = { seek: (seconds: number) => void; play: () => void; pause: () => void; paused?: () => boolean; restart: () => void; listen: () => void; sourceAspect: () => number; previewPlacement: (index: number, placement: Placement) => void; previewFraming: (framing: Edit["framing"]) => void; bounds: (index: number) => { x: number; y: number; width: number; height: number } | null };

type PlayerElement = HTMLElement & { seek?: (t: number) => void; play?: () => void; pause?: () => void; currentTime?: number; paused?: boolean; muted?: boolean; iframeElement?: HTMLIFrameElement };

export const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Image fixe montrée quand le système demande de réduire les animations (accroche posée, guide présent). */
const STILL_AT = 1.6;

/**
 * Aperçu d'un Reel motion design avec le lecteur officiel Hyperframes (@hyperframes/player, Apache-2.0).
 * La composition est passée en `srcdoc` (même HTML que l'export MP4, ressources servies par /hyperframes/).
 * Lecture automatique en boucle, sauf mouvement réduit : présentation statique, commandes toujours disponibles.
 */
const ReelPreview = forwardRef<ReelPreviewHandle, { html: string; title: string; onTimeUpdate?: (seconds: number) => void; onReady?: () => void; autoplay?: boolean; preservePosition?: boolean }>(function ReelPreview({ html, title, onTimeUpdate, onReady, autoplay = true, preservePosition = false }, ref) {
  const [ready, setReady] = useState(false);
  const player = useRef<PlayerElement | null>(null);
  const reduced = prefersReducedMotion();
  const pendingSeek = useRef<number | null>(null);
  const playerReady = useRef(false);
  const position = useRef({ time: 0, paused: true, muted: true });
  const preserve = useRef(preservePosition);
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  preserve.current = preservePosition;
  const bindPlayer = useCallback((el: PlayerElement | null) => {
    const old = player.current;
    if (old && preserve.current) position.current = {time: old.currentTime ?? position.current.time, paused: old.paused ?? true, muted: old.muted ?? true};
    player.current = el; playerReady.current = false;
    if (el) el.addEventListener("ready", () => {
      if (preserve.current) {
        const p = position.current;
        el.seek?.(p.time); el.muted = p.muted;
        if (p.paused) el.pause?.(); else el.play?.();
      }
      playerReady.current = true;
      if (pendingSeek.current !== null) { el.seek?.(pendingSeek.current); pendingSeek.current = null; }
      readyCallback.current?.();
    }, {once: true});
  }, []);
  useEffect(() => {
    let alive = true;
    import("@hyperframes/player").then(() => { if (alive) setReady(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // Position de lecture (≈ 10 fois par seconde) pour le Studio : curseur de timeline, mot prononcé.
  useEffect(() => {
    const el = player.current;
    if (!ready || !el || !onTimeUpdate) return;
    const onTime = (e: Event) => onTimeUpdate(Number((e as CustomEvent<{ currentTime?: number }>).detail?.currentTime ?? 0));
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [ready, html, onTimeUpdate]);
  // Mouvement réduit : on pose une image représentative au lieu de lancer l'animation.
  useEffect(() => {
    if (!ready || !reduced) return;
    const t = setTimeout(() => player.current?.seek?.(STILL_AT), 400);
    return () => clearTimeout(t);
  }, [ready, reduced, html]);
  useImperativeHandle(ref, () => ({
    seek: (seconds: number) => {
      const el = player.current;
      position.current.time = seconds;
      if (!el || !playerReady.current) { pendingSeek.current = seconds; return; }
      el.seek?.(seconds);
      if (autoplay && !prefersReducedMotion()) el.play?.();
    },
    play: () => player.current?.play?.(),
    pause: () => player.current?.pause?.(),
    paused: () => player.current?.paused ?? true,
    restart: () => { player.current?.seek?.(0); player.current?.play?.(); },
    listen: () => { if (player.current) { player.current.muted = false; player.current.play?.(); } },
    sourceAspect: () => {
      const videos = player.current?.iframeElement?.contentDocument?.querySelectorAll<HTMLVideoElement>('video.take');
      const video = Array.from(videos ?? []).find(v => Number(v.dataset.start) <= (player.current?.currentTime ?? 0) && Number(v.dataset.start) + Number(v.dataset.duration) > (player.current?.currentTime ?? 0));
      return video?.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 9 / 16;
    },
    // Transient transforms during a gesture; the same values are persisted on pointerup.
    previewPlacement: (index, placement) => {
      const el = player.current?.iframeElement?.contentDocument?.getElementById(`placement-${index}`);
      if (el) el.style.transform = `translate(${placement.x}px,${placement.y}px) scale(${placement.scale})`;
    },
    previewFraming: (framing) => {
      const doc = player.current?.iframeElement?.contentDocument;
      doc?.querySelectorAll<HTMLElement>("video.take").forEach(el => {
        const rhythm = Number(el.dataset.rhythmZoom ?? 1);
        el.style.transform = framing ? `translate(${framing.x}px, ${framing.y}px) scale(${framing.scale * rhythm})` : rhythm !== 1 ? `scale(${rhythm})` : "";
        el.style.transformOrigin = framing ? "50% 50%" : "50% 32%";
        el.style.objectPosition = `${framing?.focusX ?? 50}% ${framing?.focusY ?? 50}%`;
      });
    },
    bounds: (index: number) => {
      try {
        const doc = player.current?.iframeElement?.contentDocument;
        const el = doc?.getElementById(`a${index}`);
        const root = doc?.getElementById("root");
        if (!el || !root) return null;
        const r = el.getBoundingClientRect(), base = root.getBoundingClientRect();
        if (!r.width || !r.height || !base.width) return null;
        const ratio = 1080/base.width;
        return {x:(r.x-base.x)*ratio,y:(r.y-base.y)*ratio,width:r.width*ratio,height:r.height*ratio};
      } catch { return null; }
    },
  }), [autoplay]);
  return (
    <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black/5 shadow-[0_8px_30px_rgba(40,81,255,0.18)] ring-1 ring-line" data-testid="reel-preview">
      {ready
        ? createElement("hyperframes-player", {
            key: html, ref: bindPlayer, srcdoc: html, width: 1080, height: 1920, controls: true, muted: true,
            ...(reduced || !autoplay ? {} : { autoplay: true, loop: true }),
            "aria-label": `Aperçu du Reel « ${title} »`, style: { display: "block", width: "100%", height: "100%" },
          })
        : <p role="status" className="grid h-full place-items-center p-4 text-xs text-mut">Chargement du lecteur…</p>}
    </div>
  );
});

export default ReelPreview;
