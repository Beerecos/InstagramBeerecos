import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "../config";
import { EASE_IN_OUT, Pill, font, tw, useFormat } from "../ui";
import { Dot, IMAGES, Link, PhotoWindow, Pt, Rect, lerpRect, useVisual } from "../kit";

/** Scène 7 — Les trois piliers réunis autour du collectif. « Rencontrer. Apprendre. Avancer. » */
const PILLARS: { label: string; img: keyof typeof IMAGES; at: number }[] = [
  { label: "Réseau", img: "conversation", at: 15 },
  { label: "Formation", img: "formateur", at: 45 },
  { label: "Digitalisation IA", img: "outils", at: 76 },
];
const WORDS = ["Rencontrer.", "Apprendre.", "Avancer."];
const JOIN: [number, number] = [100, 128];

export const S07Pillars: React.FC = () => {
  const f = useCurrentFrame();
  const { V, v, center } = useVisual();
  const { title } = useFormat();
  const join = tw(f, JOIN, [0, 1], EASE_IN_OUT);
  const R = v ? 300 : 250;
  // Trois fenêtres rondes en triangle autour du centre, qui convergent puis cèdent la place à l'image collective.
  const pos = (i: number): Pt => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    return [center[0] + R * Math.cos(a) * 1.15, center[1] + R * Math.sin(a) * 0.95];
  };
  const D = v ? 300 : 250;
  const collective = tw(f, [112, 134], [0, 1]);
  const push = tw(f, [112, 210], [0, 1]);
  const chipsOut = 1 - tw(f, [168, 182], [0, 1]);
  return (
    <>
      <div style={{ position: "absolute", left: title.x, top: title.y, width: title.width, height: title.height, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        {WORDS.map((w, i) => {
          const a = tw(f, [PILLARS[i].at, PILLARS[i].at + 10], [0, 1]);
          return (
            <div key={w} style={{ ...font, fontSize: v ? 76 : 76, lineHeight: 1.08, fontWeight: i === 2 ? 600 : 400, color: i === 2 ? C.blue : C.black, opacity: a, transform: `translateX(${(1 - a) * -30}px)` }}>
              {w}
            </div>
          );
        })}
      </div>
      <PhotoWindow name="reunion" rect={V} push={0.07 * push} opacity={collective} />
      {[0, 1].map((i) => (
        <Link key={i} a={pos(i)} b={pos(i + 1)} p={tw(f, [PILLARS[i + 1].at, PILLARS[i + 1].at + 14], [0, 1])} opacity={1 - join} />
      ))}
      <Link a={pos(2)} b={pos(0)} p={tw(f, [86, 100], [0, 1])} opacity={1 - join} />
      {PILLARS.map((p, i) => {
        const a = tw(f, [p.at, p.at + 12], [0, 1]);
        const r0: Rect = { x: pos(i)[0] - D / 2, y: pos(i)[1] - D / 2, w: D, h: D };
        const r = lerpRect(r0, { x: center[0] - D / 4, y: center[1] - D / 4, w: D / 2, h: D / 2 }, join);
        return (
          <div key={p.label} style={{ opacity: a * (1 - collective), transform: `scale(${0.85 + 0.15 * a})`, transformOrigin: `${pos(i)[0]}px ${pos(i)[1]}px` }}>
            <PhotoWindow name={p.img} rect={r} radius={D / 2} tag={false} />
          </div>
        );
      })}
      {/* Les trois repères, posés sur l'image collective. */}
      <div style={{ position: "absolute", left: V.x, top: V.y + V.h - (v ? 120 : 100), width: V.w, display: "flex", justifyContent: "center", gap: 14, opacity: chipsOut }}>
        {PILLARS.map((p, i) => {
          const a = tw(f, [130 + i * 6, 140 + i * 6], [0, 1]);
          return (
            <Pill key={p.label} tone="blue" style={{ fontSize: v ? 30 : 28, padding: "14px 26px", opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
              {p.label}
            </Pill>
          );
        })}
      </div>
      <Dot keys={[[0, ...center], [12, ...pos(0)], [PILLARS[1].at, ...pos(0)], [PILLARS[1].at + 14, ...pos(1)], [PILLARS[2].at, ...pos(1)], [PILLARS[2].at + 14, ...pos(2)], [86, ...pos(2)], [100, ...pos(0)], [JOIN[1], ...center]]} />
    </>
  );
};
