import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Card, Label, Marker, Pill, Stage, Strong, Titles, tw } from "../ui";
import { Person } from "./common";

/** Scène 3 — Le club : deux réunions par mois, de 10 h à 12 h, 30 à 50 membres. */
const { club } = CFG.source;
const PILLS = [
  { text: club.meetings, left: 34, width: 300, at: 10 },
  { text: club.hours, left: 350, width: 220, at: 48 },
  { text: club.members, left: 586, width: 280, at: 84 },
];
const COLS = 8;
const ROWS = 5;
const SIZE = 72;
const GAP_X = (900 - COLS * SIZE) / (COLS - 1);
const GRID_TOP = 390;

export const S03Club: React.FC = () => {
  const f = useCurrentFrame();
  const card = tw(f, [0, 14], [0, 1]);
  return (
    <>
      <Titles items={[{ text: "Votre club, deux fois par mois.", from: 0 }]} accent={["mois"]} />
      <Stage>
        <Card style={{ left: 0, top: 30, width: 900, height: 300, padding: "30px 34px", opacity: card }}>
          <Label style={{ fontSize: 24 }}>Club d'affaires BeeRecos</Label>
          <Strong style={{ fontSize: 40, marginTop: 4 }}>Votre club</Strong>
          {PILLS.map((p) => {
            const a = tw(f, [p.at, p.at + 8], [0, 1]);
            return (
              <Pill key={p.text} tone={a > 0.5 ? "blue" : "grey"} style={{ position: "absolute", left: p.left, top: 190, width: p.width, justifyContent: "center", fontSize: 25, padding: "14px 0", opacity: 0.35 + 0.65 * a }}>
                {p.text}
              </Pill>
            );
          })}
        </Card>
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          const t = 84 + ((c + r * 3) % 14) * 3;
          const a = tw(f, [t, t + 10], [0, 1]);
          const fill = tw(f, [117 + r * 4, 130 + r * 4], [0, 1]);
          return (
            <div key={i} style={{ position: "absolute", left: c * (SIZE + GAP_X), top: GRID_TOP + r * (SIZE + 30), width: SIZE, height: SIZE, borderRadius: SIZE / 2, boxSizing: "border-box", border: `2.5px solid ${fill > 0.5 ? C.blue : C.line}`, background: fill > 0.5 ? C.blueSoft : C.white, display: "flex", alignItems: "center", justifyContent: "center", opacity: a, transform: `scale(${0.7 + 0.3 * a})` }}>
              <Person size={38} color={fill > 0.5 ? C.blue : "#9AA3B5"} />
            </div>
          );
        })}
        <Marker keys={[[0, 450, 450], [PILLS[0].at, 184, 245], [PILLS[1].at, 460, 245], [PILLS[2].at, 726, 245], [120, 450, GRID_TOP + 2 * (SIZE + 30) + SIZE / 2], [210, 450, GRID_TOP + 2 * (SIZE + 30) + SIZE / 2], [234, 450, 450]]} />
      </Stage>
    </>
  );
};
