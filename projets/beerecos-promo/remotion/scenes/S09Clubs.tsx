import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Button, Marker, Pill, Stage, Titles, tw } from "../ui";

/** Scène 9 — Plus de 40 clubs (villes réelles, liste beerecos.com) et l'appel à visiter un club. */
const BTN = { x: 200, y: 700, w: 500 };
const TAP = 108;

export const S09Clubs: React.FC = () => {
  const f = useCurrentFrame();
  const out = 1 - tw(f, [118, 134], [0, 1]);
  const btn = tw(f, [80, 92], [0, 1]);
  return (
    <>
      <Titles items={[{ text: CFG.source.clubsTitle, from: 0, to: 136 }]} accent={["40", "clubs"]} />
      <Stage>
        <div style={{ position: "absolute", left: 0, top: 40, width: 900, display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", opacity: out }}>
          {CFG.source.cities.map((c, i) => {
            const a = tw(f, [6 + i * 3, 16 + i * 3], [0, 1]);
            return (
              <Pill key={c} tone={i % 5 === 0 ? "blue" : "soft"} style={{ fontSize: 34, padding: "16px 30px", opacity: a, transform: `scale(${0.8 + 0.2 * a})` }}>
                {c}
              </Pill>
            );
          })}
        </div>
        <Button pressed={tw(f, [TAP - 3, TAP], [0, 1]) * (1 - tw(f, [TAP, TAP + 5], [0, 1]))} style={{ left: BTN.x, top: BTN.y, width: BTN.w, height: 96, fontSize: 34, opacity: btn * out, background: C.blue }}>
          Visiter un club
        </Button>
        <Marker keys={[[0, 450, 450], [70, 450, 450], [100, BTN.x + BTN.w - 50, BTN.y + 48], [114, BTN.x + BTN.w - 50, BTN.y + 48], [140, 450, 450]]} taps={[TAP]} />
      </Stage>
    </>
  );
};
