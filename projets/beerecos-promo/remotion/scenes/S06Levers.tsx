import React from "react";
import { useCurrentFrame } from "remotion";
import { CFG } from "../config";
import { Icon, Marker, Stage, Titles, tw } from "../ui";
import { Row } from "./common";

/** Scène 6 — Monétiser son réseau : apporteur d'affaires, ambassadeur, animateur. */
const ICONS = [Icon.Link, Icon.Referral, Icon.Sparkle];
const AT = [10, 39, 65];
const TOP = (i: number) => 40 + i * 290;
const MID = (i: number) => TOP(i) + 125;

export const S06Levers: React.FC = () => {
  const f = useCurrentFrame();
  const all = tw(f, [89, 97], [0, 1]);
  return (
    <>
      <Titles items={[{ text: "Monétisez votre réseau.", from: 0 }]} accent={["Monétisez"]} />
      <Stage>
        {CFG.source.levers.map(([title, hint], i) => {
          const a = tw(f, [i * 5, i * 5 + 14], [0, 1]);
          const IconC = ICONS[i];
          const on = Math.max(tw(f, [AT[i], AT[i] + 8], [0, 1]) * (i === 2 ? 1 : tw(f, [AT[i + 1], AT[i + 1] + 8], [1, 0.5])), all);
          return (
            <div key={title} style={{ opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
              <Row top={TOP(i)} height={250} on={on} title={title} hint={hint} lead={<IconC size={50} />} width={900} />
            </div>
          );
        })}
        <Marker keys={[[0, 450, 450], ...AT.map((t, i) => [t, 860, MID(i)] as [number, number, number]), [150, 860, MID(2)], [174, 450, 450]]} />
      </Stage>
    </>
  );
};
