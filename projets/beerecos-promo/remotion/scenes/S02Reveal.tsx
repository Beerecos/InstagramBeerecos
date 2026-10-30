import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { EASE_IN_OUT, Icon, Marker, Stage, Titles, tw } from "../ui";
import { Row } from "./common";

/** Scène 2 — Révélation : logo BeeRecos, puis les trois piliers (réseau, formation, digitalisation). */
const ICONS = [Icon.Referral, Icon.Layers, Icon.Sparkle];
const AT = [69, 91, 106];
const TOP = (i: number) => 80 + i * 250;
const MID = (i: number) => TOP(i) + 100;

export const S02Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const [cx, cy] = CFG.marker.introEnd;
  // Charte : le logo n'est animé qu'en opacité.
  const logo = tw(f, [4, 22], [0, 1]) * tw(f, [44, 56], [1, 0], EASE_IN_OUT);
  const tiles = tw(f, [50, 66], [0, 1]);
  const link = tw(f, [AT[0], AT[2]], [0, 1], EASE_IN_OUT);
  return (
    <>
      <Titles items={[{ text: "Réseau. Formation. Digitalisation.", from: 50 }]} accent={["Digitalisation"]} />
      <Stage>
        <Img src={staticFile("brand/beerecos-logo-blue.svg")} style={{ position: "absolute", left: 300, top: 200, width: 300, opacity: logo }} />
        <svg width={900} height={900} style={{ position: "absolute", left: 0, top: 0, opacity: tiles }}>
          <path d={`M 820 ${MID(0)} V ${MID(2)}`} stroke={C.blue} strokeWidth={4} strokeLinecap="round" fill="none" strokeDasharray={500} strokeDashoffset={500 * (1 - link)} />
        </svg>
        {CFG.source.pillars.map((p, i) => {
          const IconC = ICONS[i];
          return (
            <div key={p.name} style={{ opacity: tiles, transform: `translateY(${(1 - tiles) * (30 + i * 15)}px)` }}>
              <Row top={TOP(i)} height={200} on={tw(f, [AT[i], AT[i] + 10], [0, 1])} title={p.name} hint={p.hint} lead={<IconC size={50} />} width={780} />
            </div>
          );
        })}
        <Marker keys={[[0, cx, cy], [14, cx, 600], [50, cx, 600], [AT[0], 820, MID(0)], [AT[1], 820, MID(1)], [AT[2], 820, MID(2)], [122, 820, MID(2)], [146, cx, cy]]} />
      </Stage>
    </>
  );
};
