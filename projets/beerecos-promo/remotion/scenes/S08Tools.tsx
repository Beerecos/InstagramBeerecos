import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Card, Check, Marker, Stage, Strong, Titles, font, tw } from "../ui";

/** Scène 8 — Digitalisation : les outils Bee (noms repris de beerecos.com) et leurs bénéfices. */
const { tools, toolBenefits } = CFG.source;
const POS = [[0, 30], [310, 30], [620, 30], [155, 280], [465, 280]];
const TILE = { w: 280, h: 220 };
const HL: Record<string, number> = { BeeCard: 64, BeePilot: 83 };
const BEN_AT = [119, 140, 163];
const BEN_TOP = 540;

export const S08Tools: React.FC = () => {
  const f = useCurrentFrame();
  const center = (name: string) => {
    const [x, y] = POS[tools.indexOf(name)];
    return [x + TILE.w - 30, y + 30] as [number, number];
  };
  return (
    <>
      <Titles items={[{ text: "Digitalisez votre activité.", from: 0 }]} accent={["Digitalisez"]} />
      <Stage>
        {tools.map((t, i) => {
          const [x, y] = POS[i];
          const a = tw(f, [i * 4, i * 4 + 14], [0, 1]);
          const on = HL[t] ? tw(f, [HL[t], HL[t] + 8], [0, 1]) : 0;
          return (
            <Card key={t} active={on} style={{ left: x, top: y, width: TILE.w, height: TILE.h, padding: 26, opacity: a, transform: `translateY(${(1 - a) * 26}px)` }}>
              <div style={{ width: 84, height: 84, borderRadius: 24, background: on > 0.5 ? C.blue : C.blueSoft, display: "flex", alignItems: "center", justifyContent: "center", ...font, fontSize: 38, fontWeight: 700, color: on > 0.5 ? C.white : C.blue }}>
                {t.replace("Bee", "")[0]}
              </div>
              <Strong style={{ fontSize: 34, marginTop: 34 }}>{t}</Strong>
            </Card>
          );
        })}
        <Card style={{ left: 0, top: BEN_TOP, width: 900, height: 330, padding: "34px 36px", opacity: tw(f, [104, 116], [0, 1]), display: "flex", flexDirection: "column", gap: 26 }}>
          {toolBenefits.map((b, i) => {
            const on = tw(f, [BEN_AT[i], BEN_AT[i] + 8], [0, 1]);
            return (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 20, opacity: 0.35 + 0.65 * on }}>
                <Check size={44} progress={on} color={on > 0.5 ? C.blue : C.grey} />
                <Strong style={{ fontSize: 32 }}>{b}</Strong>
              </div>
            );
          })}
        </Card>
        <Marker keys={[[0, 450, 450], [HL.BeeCard, ...center("BeeCard")], [HL.BeePilot, ...center("BeePilot")], [104, ...center("BeePilot")], ...BEN_AT.map((t, i) => [t, 860, BEN_TOP + 56 + i * 96] as [number, number, number]), [184, 860, BEN_TOP + 56 + 2 * 96], [206, 450, 450]]} />
      </Stage>
    </>
  );
};
