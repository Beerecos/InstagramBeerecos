import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { ConceptTag, EASE_IN_OUT, Icon, Label, Marker, Stage, Titles, tw } from "../ui";

/** Scène 9 — Bénéfice : le parcours complet réuni ; le repère termine sa course au centre. */
const NODES = [
  { label: "Contenu", icon: Icon.Layers, x: 90, y: 400 },
  { label: "Contact", icon: Icon.Referral, x: 270, y: 520 },
  { label: "Invitation", icon: Icon.Mail, x: 450, y: 400 },
  { label: "Rencontre", icon: Icon.Calendar, x: 630, y: 520 },
  { label: "Relation", icon: Icon.Phone, x: 810, y: 400 },
];
const path = NODES.map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`).join(" ");
const LEN = NODES.slice(1).reduce((acc, n, i) => acc + Math.hypot(n.x - NODES[i].x, n.y - NODES[i].y), 0);

export const S09Benefit: React.FC = () => {
  const f = useCurrentFrame();
  const draw = tw(f, [10, 66], [0, 1], EASE_IN_OUT);
  const out = 1 - tw(f, [78, 94], [0, 1]);
  const textOut = 1 - tw(f, [98, 112], [0, 1]);
  const [cx, cy] = CFG.marker.outroStart;
  return (
    <>
      <div style={{ opacity: textOut }}>
        <ConceptTag />
        <Titles items={[{ text: "Développez votre réseau.", from: 0 }]} accent={["réseau."]} />
      </div>
      <Stage>
        <svg width={900} height={900} style={{ position: "absolute", left: 0, top: 0, opacity: out }}>
          <path d={path} fill="none" stroke={C.blue} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - draw)} />
        </svg>
        {NODES.map((n, i) => {
          const a = tw(f, [4 + i * 12, 16 + i * 12], [0, 1]);
          const IconC = n.icon;
          return (
            <div key={n.label} style={{ position: "absolute", left: n.x - 70, top: n.y - 60, width: 140, display: "flex", flexDirection: "column", alignItems: "center", opacity: a * out, transform: `scale(${0.85 + 0.15 * a})` }}>
              <div style={{ width: 120, height: 120, borderRadius: 60, background: C.white, border: `3px solid ${C.blue}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 40px rgba(40,81,255,0.15)" }}>
                <IconC size={56} />
              </div>
              <Label style={{ marginTop: 14, fontSize: 24, fontWeight: 600, color: C.black }}>{n.label}</Label>
            </div>
          );
        })}
        <Marker keys={[[0, 68, 780], [10, NODES[0].x, NODES[0].y - 75], ...NODES.map((n, i) => [10 + (i * 56) / 4, n.x, n.y - 75] as [number, number, number]), [80, NODES[4].x, NODES[4].y - 75], [100, cx, cy]]} />
      </Stage>
    </>
  );
};
