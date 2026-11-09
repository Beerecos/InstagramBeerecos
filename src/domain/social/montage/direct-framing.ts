import type { Edit } from './edit';
export type Framing = NonNullable<Edit['framing']>;
export const CENTERED_FRAME: Framing = { x: 0, y: 0, scale: 1, focusX: 50, focusY: 50 };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Pan the cover crop first, then use the zoom margin, without revealing empty edges. */
export function dragFraming(original: Framing, dx: number, dy: number, aspect: number): Framing {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 9 / 16;
  const pan = (offset: number, focus: number, delta: number, size: number, cover: number, limit: number) => {
    const crop = (cover - size) * original.scale;
    const wantedFocus = crop > 0 ? focus - delta / crop * 100 : focus;
    const nextFocus = clamp(wantedFocus, 0, 100);
    const remainder = delta - (focus - nextFocus) / 100 * crop;
    const margin = Math.min(limit, size * (original.scale - 1) / 2);
    return { offset: Math.round(clamp(offset + remainder, -margin, margin)), focus: nextFocus };
  };
  const x = pan(original.x, original.focusX ?? 50, dx, 1080, Math.max(1080, 1920 * a), 540);
  const y = pan(original.y, original.focusY ?? 50, dy, 1920, Math.max(1920, 1080 / a), 960);
  return { ...original, x: x.offset, y: y.offset, focusX: x.focus, focusY: y.focus };
}
