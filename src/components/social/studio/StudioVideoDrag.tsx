"use client";
import { useRef, type PointerEvent, type RefObject } from 'react';
import type { ReelPreviewHandle } from '../ReelPreview';
import type { Edit } from '@/domain/social/montage/edit';
import { CENTERED_FRAME, dragFraming, type Framing } from '@/domain/social/montage/direct-framing';

type Gesture = { x: number; y: number; ratio: number; aspect: number; original: Framing; next: Framing };
/** Keep the video and its foreground cutout aligned. Commit only once per gesture. */
export default function StudioVideoDrag({ framing, player, onChange }: {
  framing: Edit['framing']; player: RefObject<ReelPreviewHandle | null>; onChange: (frame: Framing) => void;
}) {
  const drag = useRef<Gesture | null>(null);
  const finish = (cancel = false) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (cancel) player.current?.previewFraming(framing);
    else if (JSON.stringify(d.next) !== JSON.stringify(d.original)) onChange(d.next);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    d.next = dragFraming(d.original, (e.clientX - d.x) * d.ratio, (e.clientY - d.y) * d.ratio, d.aspect);
    player.current?.previewFraming(d.next);
  };
  return <button type="button" aria-label="Déplacer la vidéo dans le cadre" className="absolute inset-x-0 top-0 bottom-[12%] cursor-move touch-none rounded-t-2xl border-2 border-brand bg-transparent focus:outline focus:outline-2 focus:outline-white"
    onPointerDown={e => {
      player.current?.pause();
      e.currentTarget.setPointerCapture(e.pointerId);
      const original = framing ?? CENTERED_FRAME;
      drag.current = { x: e.clientX, y: e.clientY, ratio: 1080 / e.currentTarget.getBoundingClientRect().width, aspect: player.current?.sourceAspect() ?? 9 / 16, original, next: original };
    }} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}
    onKeyDown={e => {
      if (e.key === 'Escape') { finish(true); return; }
      const dx = e.key === 'ArrowRight' ? 10 : e.key === 'ArrowLeft' ? -10 : 0;
      const dy = e.key === 'ArrowDown' ? 10 : e.key === 'ArrowUp' ? -10 : 0;
      if (dx || dy) { e.preventDefault(); onChange(dragFraming(framing ?? CENTERED_FRAME, dx, dy, player.current?.sourceAspect() ?? 9 / 16)); }
    }}>
    <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-xs text-white">Glisser pour cadrer</span>
  </button>;
}
