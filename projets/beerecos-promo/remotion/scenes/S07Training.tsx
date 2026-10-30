import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Card, Check, Label, Marker, Stage, Strong, Titles, tw } from "../ui";

/** Scène 7 — Formation : intégrée aux réunions, organisme certifié Qualiopi, programme 2026. */
const { training } = CFG.source;
const MOD_TOP = (i: number) => 330 + i * 180;
const BADGE_AT = 124;

export const S07Training: React.FC = () => {
  const f = useCurrentFrame();
  const badge = tw(f, [BADGE_AT, BADGE_AT + 10], [0, 1]);
  const prog = tw(f, [4, 18], [0, 1]);
  return (
    <>
      <Titles items={[{ text: "Formez-vous à chaque réunion.", from: 0 }]} accent={["chaque", "réunion."]} />
      <Stage>
        <Card active={badge} style={{ left: 0, top: 30, width: 900, height: 130, display: "flex", alignItems: "center", gap: 20, padding: "0 32px", opacity: 0.4 + 0.6 * badge }}>
          <Check size={52} color={badge > 0.5 ? C.blue : C.grey} progress={0.3 + 0.7 * badge} />
          <Strong style={{ fontSize: 30 }}>{training.badge}</Strong>
        </Card>
        <Label style={{ position: "absolute", left: 4, top: 200, fontSize: 28, fontWeight: 600, color: C.blue, opacity: prog }}>{training.program}</Label>
        {training.modules.map((m, i) => {
          const at = 30 + i * 18;
          const a = tw(f, [at, at + 12], [0, 1]);
          const [code, ...rest] = m.split(" · ");
          return (
            <Card key={m} active={tw(f, [at + 6, at + 14], [0, 1]) * (1 - tw(f, [at + 34, at + 44], [0, 0.6]))} style={{ left: 0, top: MOD_TOP(i), width: 900, height: 150, padding: "24px 32px", opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
              <Label style={{ fontSize: 22, color: C.blue, fontWeight: 600 }}>Module {code.replace("M", "")}</Label>
              <Strong style={{ fontSize: 28, marginTop: 4 }}>{rest.join(" · ")}</Strong>
            </Card>
          );
        })}
        <Marker keys={[[0, 450, 450], [30, 860, MOD_TOP(0) + 40], [48, 860, MOD_TOP(1) + 40], [66, 860, MOD_TOP(2) + 40], [104, 860, MOD_TOP(2) + 40], [BADGE_AT, 860, 95], [150, 860, 95], [174, 450, 450]]} />
      </Stage>
    </>
  );
};
