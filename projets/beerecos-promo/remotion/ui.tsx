import React, { createContext, useContext } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, CFG, Format, STAGE } from "./config";

/* ---------- Format courant (9:16 ou 16:9) ---------- */
export const FormatContext = createContext<Format>(CFG.formats.vertical);
export const useFormat = () => useContext(FormatContext);
export const useIsVertical = () => useFormat().id === "9x16";

/* ---------- Animation ---------- */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Interpolation bornée avec easing doux (toutes les animations sont pilotées par l'image courante). */
export const tw = (f: number, range: [number, number], out: [number, number], easing = EASE) =>
  interpolate(f, range, out, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

/** Entrée (fondu + glissé) entre in et in+dur, sortie optionnelle. */
export const appear = (f: number, inAt: number, dur = 12, outAt?: number, dy = 24) => {
  const a = tw(f, [inAt, inAt + dur], [0, 1]);
  const b = outAt === undefined ? 1 : tw(f, [outAt, outAt + 10], [1, 0], EASE_IN_OUT);
  return { opacity: a * b, transform: `translateY(${(1 - a) * dy}px)` } as React.CSSProperties;
};

/* ---------- Scène logique 900×900 mise à l'échelle par format ---------- */
export const Stage: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const { stage } = useFormat();
  return (
    <div style={{ position: "absolute", left: stage.x, top: stage.y, width: STAGE, height: STAGE, transform: `scale(${stage.scale})`, transformOrigin: "0 0", ...style }}>
      {children}
    </div>
  );
};

/* ---------- Typo ---------- */
export const font: React.CSSProperties = { fontFamily: "Poppins, sans-serif" };

/** Remplace « → » (absent du sous-ensemble latin de Poppins) par une flèche SVG. */
export const WithArrows: React.FC<{ text: string; size: number; color?: string }> = ({ text, size, color = C.blue }) => {
  const parts = text.split("→");
  return (
    <>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {p}
          {i < parts.length - 1 && (
            <svg width={size * 0.9} height={size * 0.6} viewBox="0 0 30 20" style={{ display: "inline-block", verticalAlign: "middle", margin: "0 0.08em" }}>
              <path d="M2 10 H25 M17 3 L26 10 L17 17" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </React.Fragment>
      ))}
    </>
  );
};

/** Titre de scène : un seul titre visible à la fois, fondu enchaîné aux images indiquées. */
export const Titles: React.FC<{ items: { text: string; from: number; to?: number }[]; accent?: string[] }> = ({ items, accent = [] }) => {
  const f = useCurrentFrame();
  const { title } = useFormat();
  return (
    <>
      {items.map((it, i) => {
        const a = tw(f, [it.from, it.from + 12], [0, 1]);
        const b = it.to === undefined ? 1 : tw(f, [it.to - 8, it.to], [1, 0], EASE_IN_OUT);
        const words = it.text.split(" ");
        return (
          <div key={i} style={{ position: "absolute", left: title.x, top: title.y, width: title.width, height: title.height, display: "flex", alignItems: "flex-end", opacity: a * b, transform: `translateY(${(1 - a) * 28}px)` }}>
            <div style={{ ...font, fontSize: title.fontSize, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em", color: C.black }}>
              {words.map((w, j) => (
                <span key={j} style={{ color: accent.some((a) => w.replace(/[.,]/g, "").includes(a)) ? C.blue : undefined }}>
                  <WithArrows text={w} size={title.fontSize} />
                  {j < words.length - 1 ? " " : ""}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
};

/** Mention discrète : le film présente un concept, avec des données fictives. */
export const ConceptTag: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const { safe } = useFormat();
  const v = useIsVertical();
  return (
    <div style={{ opacity, position: "absolute", left: safe.left, top: v ? safe.top : safe.top - 20, ...font, fontSize: v ? 24 : 20, fontWeight: 500, color: C.grey, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 10, height: 10, borderRadius: 5, background: C.blue, display: "block" }} />
      {CFG.labels.concept}
    </div>
  );
};

/* ---------- Interface ---------- */
export const Card: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; active?: number }> = ({ style, children, active = 0 }) => (
  <div
    style={{
      position: "absolute", background: C.white, borderRadius: 28, boxSizing: "border-box",
      border: `2px solid ${active > 0 ? C.blue : C.line}`,
      boxShadow: `0 18px 50px rgba(11,21,51,${0.07 + active * 0.07}), 0 0 0 ${active * 6}px rgba(40,81,255,0.12)`,
      ...font, ...style,
    }}
  >
    {children}
  </div>
);

export const Label: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ ...font, fontSize: 22, fontWeight: 500, color: C.grey, ...style }}>{children}</div>
);
export const Strong: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ ...font, fontSize: 30, fontWeight: 600, color: C.black, lineHeight: 1.2, ...style }}>{children}</div>
);

export const Pill: React.FC<{ children: React.ReactNode; tone?: "blue" | "soft" | "grey" | "green"; style?: React.CSSProperties }> = ({ children, tone = "soft", style }) => {
  const tones = {
    blue: { background: C.blue, color: C.white },
    soft: { background: C.blueSoft, color: C.blue },
    grey: { background: C.surface, color: C.grey },
    green: { background: "#E3F7F5", color: "#13867F" },
  };
  return (
    <span style={{ ...font, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 600, padding: "8px 18px", borderRadius: 999, whiteSpace: "nowrap", ...tones[tone], ...style }}>
      {children}
    </span>
  );
};

export const Button: React.FC<{ children: React.ReactNode; pressed?: number; style?: React.CSSProperties; variant?: "blue" | "ghost" }> = ({ children, pressed = 0, style, variant = "blue" }) => (
  <div
    style={{
      ...font, position: "absolute", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      height: 72, borderRadius: 20, fontSize: 26, fontWeight: 600, boxSizing: "border-box",
      background: variant === "blue" ? C.blue : C.white, color: variant === "blue" ? C.white : C.black,
      border: variant === "blue" ? "none" : `2px solid ${C.line}`,
      transform: `scale(${1 - pressed * 0.05})`, ...style,
    }}
  >
    {children}
  </div>
);

export const Avatar: React.FC<{ initials: string; size?: number; tone?: string }> = ({ initials, size = 72, tone = C.blue }) => (
  <div style={{ ...font, width: size, height: size, borderRadius: size / 2, flex: "none", background: tone === C.blue ? C.blueSoft : "#EEF0F4", color: tone, fontSize: size * 0.36, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
    {initials}
  </div>
);

export const Check: React.FC<{ size?: number; color?: string; mark?: string; progress?: number }> = ({ size = 32, color = C.blue, mark = "#fff", progress = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <circle cx={16} cy={16} r={16} fill={color} />
    <path d="M9 16.5 L14 21 L23 11" fill="none" stroke={mark} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={24} strokeDashoffset={24 * (1 - progress)} />
  </svg>
);

/* ---------- Icônes (tracés simples ; logos officiels à substituer si besoin) ---------- */
type IconProps = { size?: number; color?: string };
const stroke = (color: string) => ({ fill: "none", stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });
export const Icon = {
  Camera: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><rect x={3} y={9} width={19} height={15} rx={4} {...stroke(color)} /><path d="M22 14 L29 10 V23 L22 19" {...stroke(color)} /></svg>
  ),
  Sparkle: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><path d="M14 4 C15 11 17 13 24 14 C17 15 15 17 14 24 C13 17 11 15 4 14 C11 13 13 11 14 4 Z" {...stroke(color)} /><path d="M25 21 C25.5 24 26 24.5 29 25 C26 25.5 25.5 26 25 29 C24.5 26 24 25.5 21 25 C24 24.5 24.5 24 25 21 Z" {...stroke(color)} /></svg>
  ),
  Layers: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><rect x={9} y={4} width={17} height={21} rx={3} {...stroke(color)} /><path d="M6 8 V25 A3 3 0 0 0 9 28 H21" {...stroke(color)} /></svg>
  ),
  Mail: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><rect x={3} y={7} width={26} height={19} rx={4} {...stroke(color)} /><path d="M4 9 L16 18 L28 9" {...stroke(color)} /></svg>
  ),
  Instagram: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><rect x={4} y={4} width={24} height={24} rx={7} {...stroke(color)} /><circle cx={16} cy={16} r={5.5} {...stroke(color)} /><circle cx={23} cy={9} r={1.4} fill={color} /></svg>
  ),
  LinkedIn: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><rect x={4} y={4} width={24} height={24} rx={5} {...stroke(color)} /><path d="M10 14 V22 M10 10 V10.2 M15 22 V14 M15 17.5 C15 15 21 13 21 17.5 V22" {...stroke(color)} /></svg>
  ),
  Referral: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><circle cx={11} cy={11} r={4.5} {...stroke(color)} /><circle cx={22} cy={13} r={3.5} {...stroke(color)} /><path d="M3 26 C3 20 7 18 11 18 C15 18 19 20 19 26 M19 19.5 C20 18.6 21 18.3 22.5 18.3 C26 18.3 29 20 29 25" {...stroke(color)} /></svg>
  ),
  Calendar: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><rect x={4} y={6} width={24} height={22} rx={4} {...stroke(color)} /><path d="M4 13 H28 M11 3 V8 M21 3 V8" {...stroke(color)} /></svg>
  ),
  Bell: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><path d="M8 22 V14 A8 8 0 0 1 24 14 V22 L26 25 H6 Z M13 28 H19" {...stroke(color)} /></svg>
  ),
  Link: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><path d="M13 19 L19 13 M14 9 L17 6 A5 5 0 0 1 26 13 L23 16 M18 23 L15 26 A5 5 0 0 1 6 19 L9 16" {...stroke(color)} /></svg>
  ),
  Phone: ({ size = 48, color = C.blue }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><path d="M8 4 H12 L14 10 L11 12 C12.5 15.5 16.5 19.5 20 21 L22 18 L28 20 V24 A4 4 0 0 1 24 28 C14 28 4 18 4 8 A4 4 0 0 1 8 4 Z" {...stroke(color)} /></svg>
  ),
};

/* ---------- Repère bleu ---------- */
export type MarkerKey = [frame: number, x: number, y: number];

/** Point bleu qui guide le regard. Clés en coordonnées de scène ; « taps » = images de sélection (onde). */
export const Marker: React.FC<{ keys: MarkerKey[]; taps?: number[]; visibleFrom?: number; hideAt?: number }> = ({ keys, taps = [], visibleFrom = 0, hideAt }) => {
  const f = useCurrentFrame();
  let x = keys[0][1];
  let y = keys[0][2];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, x0, y0] = keys[i];
    const [f1, x1, y1] = keys[i + 1];
    if (f1 <= f0) {
      if (f >= f1) [x, y] = [x1, y1];
    } else if (f >= f0 && f <= f1) {
      x = tw(f, [f0, f1], [x0, x1], EASE_IN_OUT);
      y = tw(f, [f0, f1], [y0, y1], EASE_IN_OUT);
    } else if (f > f1) {
      x = x1;
      y = y1;
    }
  }
  const s = CFG.marker.size;
  const opacity = (f < visibleFrom ? 0 : 1) * (hideAt === undefined ? 1 : tw(f, [hideAt, hideAt + 8], [1, 0]));
  const press = taps.reduce((acc, t) => Math.max(acc, f >= t - 3 && f < t + 6 ? 1 - Math.abs(f - t) / 6 : 0), 0);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: STAGE, height: STAGE, pointerEvents: "none", opacity }}>
      {taps.map((t) => {
        const p = tw(f, [t, t + 16], [0, 1], Easing.out(Easing.quad));
        if (f < t || f > t + 16) return null;
        return <div key={t} style={{ position: "absolute", left: x - 40 * p, top: y - 40 * p, width: 80 * p, height: 80 * p, borderRadius: "50%", border: `3px solid ${C.blue}`, opacity: 1 - p, boxSizing: "border-box" }} />;
      })}
      <div style={{ position: "absolute", left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: "50%", background: C.blue, boxShadow: "0 6px 18px rgba(40,81,255,0.35)", transform: `scale(${1 - press * 0.3})` }} />
    </div>
  );
};

/* ---------- Sous-titres ---------- */
export const Captions: React.FC<{ offsetSeconds?: number }> = () => {
  const f = useCurrentFrame();
  const { captions, width } = useFormat();
  const t = f / CFG.video.fps;
  const cue = CFG.captions.find((c) => c.onScreen !== false && t >= c.start && t < c.end);
  if (!cue) return null;
  const local = t - cue.start;
  const a = Math.min(1, local / 0.12);
  const words = cue.text.split(" ");
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: captions.y, left: (width - captions.width) / 2, width: captions.width, height: captions.height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...font, maxWidth: captions.width, textAlign: "center", fontSize: captions.fontSize, fontWeight: 600, lineHeight: 1.25, color: C.ink, background: "rgba(245,247,251,0.96)", padding: "10px 26px", borderRadius: 18, opacity: a, transform: `translateY(${(1 - a) * 8}px)` }}>
          {words.map((w, i) => {
            const em = w.startsWith("*") || w.includes("*");
            const clean = w.replace(/\*/g, "");
            return (
              <span key={i} style={{ color: em ? C.blue : undefined }}>
                {clean}
                {i < words.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
