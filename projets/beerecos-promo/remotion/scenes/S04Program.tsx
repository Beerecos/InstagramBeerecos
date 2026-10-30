import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { EASE_IN_OUT, Marker, Stage, Titles, tw } from "../ui";
import { Row } from "./common";

/** Scène 4 — Le programme d'une réunion (2 heures) : cinq temps forts. */
const AT = [28, 41, 70, 92, 114];
const TOP = (i: number) => 20 + i * 175;
const MID = (i: number) => TOP(i) + 75;
const BADGE_X = 860;

export const S04Program: React.FC = () => {
  const f = useCurrentFrame();
  const line = tw(f, [AT[0], AT[4]], [0, 1], EASE_IN_OUT);
  return (
    <>
      <Titles items={[{ text: "2 heures, 5 temps forts.", from: 0 }]} accent={["5", "temps", "forts."]} />
      <Stage>
        <svg width={900} height={900} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d={`M ${BADGE_X} ${MID(0)} V ${MID(4)}`} stroke={C.blue} strokeWidth={4} strokeLinecap="round" fill="none" strokeDasharray={700} strokeDashoffset={700 * (1 - line)} />
        </svg>
        {CFG.source.program.map(([title, hint], i) => {
          const a = tw(f, [i * 4, i * 4 + 14], [0, 1]);
          return (
            <div key={title} style={{ opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
              <Row top={TOP(i)} height={150} on={tw(f, [AT[i], AT[i] + 8], [0, 1])} title={title} hint={hint} lead={String(i + 1)} />
            </div>
          );
        })}
        <Marker keys={[[0, 450, 450], ...AT.map((t, i) => [t, BADGE_X, MID(i)] as [number, number, number]), [212, BADGE_X, MID(4)], [236, 450, 450]]} />
      </Stage>
    </>
  );
};
