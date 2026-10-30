import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "../config";
import { Card, Check, EASE_IN_OUT, Label, Marker, Stage, Strong, Titles, font, tw } from "../ui";
import { Person } from "./common";

/** Scène 5 — Recommandation : chaque membre est l'apporteur d'affaires des autres. */
const ROLES = ["Artisan", "Commerçant", "Expert-comptable", "Agent immobilier", "Avocat", "Architecte"];
const R = 320;
const node = (i: number) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 3;
  return [450 + R * Math.cos(a), 450 + R * Math.sin(a)] as const;
};
const FROM = 2;
const TO = 5;

const Chip: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <Card active={0.6} style={{ left: x - 140, top: y - 44, width: 280, height: 88, display: "flex", alignItems: "center", gap: 14, padding: "0 20px", opacity }}>
    <Check size={36} />
    <Strong style={{ fontSize: 26 }}>Contact qualifié</Strong>
  </Card>
);

export const S05Recommend: React.FC = () => {
  const f = useCurrentFrame();
  const edges = tw(f, [4, 30], [0, 1], EASE_IN_OUT);
  const p1 = tw(f, [50, 92], [0, 1], EASE_IN_OUT);
  const p2 = tw(f, [108, 148], [0, 1], EASE_IN_OUT);
  const [ax, ay] = node(FROM);
  const [bx, by] = node(TO);
  const c1 = { x: ax + (450 - ax) * p1, y: ay + (450 - ay) * p1 };
  const c2 = { x: 450 + (bx - 450) * p2, y: 450 + (by - 450) * p2 };
  const chip1 = tw(f, [44, 52], [0, 1]) * (1 - tw(f, [96, 104], [0, 1]));
  const chip2 = tw(f, [104, 110], [0, 1]) * (1 - tw(f, [152, 162], [0, 1]));
  const lit = (i: number) => (i === FROM ? tw(f, [40, 48], [0, 1]) * (1 - tw(f, [96, 104], [0, 1])) : i === TO ? tw(f, [146, 154], [0, 1]) : 0);
  return (
    <>
      <Titles items={[{ text: "Recommandez. Soyez recommandé.", from: 0 }]} accent={["recommandé."]} />
      <Stage>
        <svg width={900} height={900} style={{ position: "absolute", left: 0, top: 0 }}>
          {ROLES.map((r, i) => {
            const [x, y] = node(i);
            return <line key={r} x1={450} y1={450} x2={450 + (x - 450) * edges} y2={450 + (y - 450) * edges} stroke={i === FROM || i === TO ? C.blue : C.line} strokeWidth={4} strokeLinecap="round" />;
          })}
        </svg>
        {ROLES.map((r, i) => {
          const [x, y] = node(i);
          const a = tw(f, [i * 3, i * 3 + 12], [0, 1]);
          const on = lit(i);
          return (
            <div key={r} style={{ position: "absolute", left: x - 90, top: y - 60, width: 180, display: "flex", flexDirection: "column", alignItems: "center", opacity: a }}>
              <div style={{ width: 110, height: 110, borderRadius: 55, boxSizing: "border-box", background: on > 0.5 ? C.blueSoft : C.white, border: `3px solid ${on > 0.5 ? C.blue : C.line}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 30px rgba(11,21,51,0.08)" }}>
                <Person size={54} color={on > 0.5 ? C.blue : "#9AA3B5"} />
              </div>
              <Label style={{ marginTop: 8, fontSize: 22, fontWeight: 600, color: C.black, textAlign: "center", lineHeight: 1.2 }}>{r}</Label>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 360, top: 360, width: 180, height: 180, borderRadius: 90, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", ...font, color: C.white, fontSize: 36, fontWeight: 600, opacity: tw(f, [0, 12], [0, 1]) }}>
          Vous
        </div>
        <Chip x={c1.x} y={c1.y} opacity={chip1} />
        <Chip x={c2.x} y={c2.y} opacity={chip2} />
        <Marker keys={[[0, 450, 450], [40, ax, ay - 70], [50, ax, ay - 70], [92, 450, 450 - 70], [108, 450, 450 - 70], [148, bx, by - 70], [158, bx, by - 70], [176, 450, 450]]} />
      </Stage>
    </>
  );
};
