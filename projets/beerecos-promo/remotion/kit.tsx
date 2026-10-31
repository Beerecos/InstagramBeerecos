import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { Video } from "@remotion/media";
import { C, CFG } from "./config";
import { EASE_IN_OUT, font, tw, useFormat } from "./ui";

/* ---------- Zone visuelle et points de raccord ---------- */
export type Pt = [number, number];
export type Rect = { x: number; y: number; w: number; h: number };

/** Zone visuelle du format courant et conversion de coordonnées relatives (0–1) en pixels. */
export const useVisual = () => {
  const f = useFormat();
  const V = f.visual;
  const v = f.id === "9x16";
  const at = (fx: number, fy: number): Pt => [V.x + V.w * fx, V.y + V.h * fy];
  const center: Pt = [V.x + V.w / 2, V.y + V.h / 2];
  return { V, v, at, center, W: f.width, H: f.height };
};

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const lerpRect = (a: Rect, b: Rect, p: number): Rect => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });

/* ---------- Photos ---------- */
export const IMAGES: Record<string, { src: string; w: number; h: number; focus: Pt }> = {
  accueil: { src: CFG.media.accueil, w: 800, h: 450, focus: [400, 225] },
  conversation: { src: CFG.media.conversation, w: 1280, h: 720, focus: [760, 260] },
  reunion: { src: CFG.media.reunion, w: 1600, h: 900, focus: [520, 360] },
  formateur: { src: CFG.media.formationStill, w: 1280, h: 720, focus: [760, 300] },
  outils: { src: CFG.media.outilsStill, w: 1280, h: 720, focus: [600, 330] },
};

/** Vidéos du site de référence (muettes, 1280×720, 10 s). */
export const VIDEOS: Record<string, { src: string; w: number; h: number; focus: Pt }> = {
  formation: { src: CFG.media.formationVideo, w: 1280, h: 720, focus: [760, 300] },
  outils: { src: CFG.media.outilsVideo, w: 1280, h: 720, focus: [600, 330] },
};

/** Cadrage « cover » centré sur un point d'intérêt ; renvoie aussi la conversion image → fenêtre. */
export const cover = (img: (typeof IMAGES)[string], r: { w: number; h: number }, zoom = 1.05, focus: Pt = img.focus) => {
  const s = Math.max(r.w / img.w, r.h / img.h) * zoom;
  const iw = img.w * s;
  const ih = img.h * s;
  const ox = Math.min(Math.max(focus[0] * s - r.w / 2, 0), iw - r.w);
  const oy = Math.min(Math.max(focus[1] * s - r.h / 2, 0), ih - r.h);
  return { s, iw, ih, ox, oy, map: (x: number, y: number): Pt => [x * s - ox, y * s - oy] };
};

/** Fenêtre photo arrondie (masque de la charte). `push` = léger mouvement secondaire. */
export const PhotoWindow: React.FC<{
  name: keyof typeof IMAGES; rect: Rect; radius?: number; zoom?: number; push?: number; dim?: number; opacity?: number;
  children?: (map: (x: number, y: number) => Pt) => React.ReactNode; tag?: boolean;
}> = ({ name, rect, radius = 36, zoom = 1.05, push = 0, dim = 0, opacity = 1, children, tag = true }) => {
  const img = IMAGES[name];
  const c = cover(img, rect, zoom * (1 + push));
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: radius, overflow: "hidden", opacity, background: "#0b1020" }}>
      <Img src={staticFile(img.src)} style={{ position: "absolute", left: -c.ox, top: -c.oy, width: c.iw, height: c.ih }} />
      {dim > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${dim})` }} />}
      {children?.(c.map)}
      {tag && rect.w > 260 && (
        <div style={{ ...font, position: "absolute", left: 22, bottom: 16, fontSize: 22, fontWeight: 500, color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>{CFG.labels.illustration}</div>
      )}
    </div>
  );
};

/** Fenêtre vidéo arrondie : même cadrage que PhotoWindow, lecture muette à partir de `from` secondes. */
export const VideoWindow: React.FC<{ name: keyof typeof VIDEOS; rect: Rect; radius?: number; zoom?: number; from?: number; opacity?: number; focus?: Pt; tag?: boolean }> = ({ name, rect, radius = 36, zoom = 1.04, from = 0, opacity = 1, focus, tag = true }) => {
  const vid = VIDEOS[name];
  const c = cover(vid, rect, zoom, focus ?? vid.focus);
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: radius, overflow: "hidden", opacity, background: "#0b1020" }}>
      <Video src={staticFile(vid.src)} muted trimBefore={Math.round(from * CFG.video.fps)} style={{ position: "absolute", left: -c.ox, top: -c.oy, width: c.iw, height: c.ih }} />
      {tag && rect.w > 260 && (
        <div style={{ ...font, position: "absolute", left: 22, bottom: 16, fontSize: 22, fontWeight: 500, color: "rgba(255,255,255,0.85)", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>{CFG.labels.illustration}</div>
      )}
    </div>
  );
};

/* ---------- Fil bleu ---------- */
/** Point bleu qui guide le regard (coordonnées plein cadre). */
export const Dot: React.FC<{ keys: [number, number, number][]; taps?: number[]; hideAt?: number; showFrom?: number }> = ({ keys, taps = [], hideAt, showFrom = 0 }) => {
  const f = useCurrentFrame();
  let [x, y] = [keys[0][1], keys[0][2]];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, x0, y0] = keys[i];
    const [f1, x1, y1] = keys[i + 1];
    if (f1 <= f0) {
      if (f >= f1) [x, y] = [x1, y1];
    } else if (f >= f0 && f <= f1) {
      x = tw(f, [f0, f1], [x0, x1], EASE_IN_OUT);
      y = tw(f, [f0, f1], [y0, y1], EASE_IN_OUT);
    } else if (f > f1) [x, y] = [x1, y1];
  }
  const s = CFG.marker.size;
  const op = (f < showFrom ? 0 : 1) * (hideAt === undefined ? 1 : tw(f, [hideAt, hideAt + 8], [1, 0]));
  return (
    <>
      {taps.map((t) => {
        if (f < t || f > t + 16) return null;
        const p = tw(f, [t, t + 16], [0, 1]);
        return <div key={t} style={{ position: "absolute", left: x - 44 * p, top: y - 44 * p, width: 88 * p, height: 88 * p, borderRadius: "50%", border: `3px solid ${C.blue}`, opacity: (1 - p) * op, boxSizing: "border-box" }} />;
      })}
      <div style={{ position: "absolute", left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: "50%", background: C.blue, boxShadow: "0 0 0 5px rgba(255,255,255,0.92), 0 6px 18px rgba(40,81,255,0.35)", opacity: op }} />
    </>
  );
};

/** Lien bleu tracé progressivement entre deux points (recommandation, connexion). */
export const Link: React.FC<{ a: Pt; b: Pt; p: number; width?: number; color?: string; opacity?: number }> = ({ a, b, p, width = 6, color = C.blue, opacity = 1 }) => {
  const { W, H } = useVisual();
  if (p <= 0) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity, pointerEvents: "none" }}>
      <line x1={a[0]} y1={a[1]} x2={lerp(a[0], b[0], p)} y2={lerp(a[1], b[1], p)} stroke={color} strokeWidth={width} strokeLinecap="round" />
    </svg>
  );
};

/* ---------- Habillages d'appareils (captures réelles) ---------- */
export const PhoneFrame: React.FC<{ rect: Rect; children: React.ReactNode; opacity?: number; style?: React.CSSProperties }> = ({ rect, children, opacity = 1, style }) => (
  <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: rect.w * 0.13, background: "#0E0F12", padding: rect.w * 0.035, boxSizing: "border-box", boxShadow: "0 30px 70px rgba(11,21,51,0.22)", opacity, ...style }}>
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: rect.w * 0.1, overflow: "hidden", background: C.white }}>{children}</div>
  </div>
);

export const BrowserFrame: React.FC<{ rect: Rect; url: string; children: React.ReactNode; opacity?: number }> = ({ rect, url, children, opacity = 1 }) => (
  <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 20, background: C.white, border: `2px solid ${C.line}`, overflow: "hidden", boxShadow: "0 30px 70px rgba(11,21,51,0.18)", opacity }}>
    <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: C.surface, borderBottom: `2px solid ${C.line}` }}>
      {["#DDE2EA", "#DDE2EA", "#DDE2EA"].map((c, i) => <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: c, display: "block" }} />)}
      <div style={{ ...font, marginLeft: 16, flex: 1, height: 32, borderRadius: 16, background: C.white, display: "flex", alignItems: "center", padding: "0 16px", fontSize: 18, fontWeight: 500, color: C.grey }}>{url}</div>
    </div>
    <div style={{ position: "relative", width: "100%", height: rect.h - 52, overflow: "hidden" }}>{children}</div>
  </div>
);

/** Silhouette de personne (graphisme, aucune personne réelle). */
export const Person: React.FC<{ size?: number; color?: string }> = ({ size = 48, color = C.blue }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <circle cx={16} cy={11} r={5} fill="none" stroke={color} strokeWidth={2.4} />
    <path d="M6 27 C6 20 10 18 16 18 C22 18 26 20 26 27" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
  </svg>
);
