import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Card, ConceptTag, EASE_IN_OUT, Icon, Label, Marker, Pill, Stage, Strong, Titles, tw } from "../ui";
import { ACTION_X, CAMILLE_ROW_Y, ContactRow } from "./shared";

/** Scène 4 — Campagnes : quatre sources distinctes rejoignent un suivi commun ; chaque contact garde son origine. */
const { demo } = CFG;
const SOURCES = [
  { name: "Email", hint: `Campagne « ${demo.campaign.name} »`, icon: Icon.Mail, at: 10, provider: demo.campaign.provider },
  { name: "Instagram", hint: "Réels et messages", icon: Icon.Instagram, at: 25 },
  { name: "LinkedIn", hint: "Réseau professionnel", icon: Icon.LinkedIn, at: 50 },
  { name: "Parrainage adhérent", hint: "Invité par un membre", icon: Icon.Referral, at: 71 },
];
const SRC = { w: 430, h: 190, gx: 470, gy: 220, top: 40 };
const PANEL = { top: 500, rowY: (i: number) => 590 + i * 82 };
const CONTACTS = [
  { name: demo.contactOther.name, origin: "Email" },
  { name: demo.contactAbsent.name, origin: "Instagram" },
  { name: demo.contactOther2.name, origin: "LinkedIn" },
  { name: demo.contact.name, origin: demo.contact.origin },
];
const srcCenter = (i: number) => [SRC.gx * (i % 2) + SRC.w / 2, SRC.top + SRC.gy * Math.floor(i / 2) + SRC.h / 2] as const;

export const S04Campaigns: React.FC = () => {
  const f = useCurrentFrame();
  const focus = tw(f, [150, 166], [0, 1]);
  const move = tw(f, [168, 200], [0, 1], EASE_IN_OUT);
  const others = 1 - tw(f, [160, 176], [0, 1]);
  return (
    <>
      <ConceptTag />
      <Titles items={[{ text: "Activez vos campagnes.", from: 0 }]} accent={["campagnes"]} />
      <Stage>
        {SOURCES.map((s, i) => {
          const a = tw(f, [s.at - 6, s.at + 8], [0, 1]);
          const on = tw(f, [s.at, s.at + 8], [0, 1]) * tw(f, [s.at + 24, s.at + 34], [1, 0.4]);
          const IconC = s.icon;
          return (
            <Card key={s.name} active={on} style={{ left: SRC.gx * (i % 2), top: SRC.top + SRC.gy * Math.floor(i / 2), width: SRC.w, height: SRC.h, padding: "26px 28px", opacity: a * others, transform: `translateY(${(1 - a) * 26}px)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 70, height: 70, borderRadius: 20, background: C.blueSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconC size={42} />
                </div>
                <Strong style={{ fontSize: 30 }}>{s.name}</Strong>
              </div>
              <Label style={{ marginTop: 16, fontSize: 21, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.hint}</Label>
              {s.provider && <Pill tone="grey" style={{ position: "absolute", right: 22, top: 30, fontSize: 18, padding: "6px 14px" }}>{s.provider}</Pill>}
            </Card>
          );
        })}
        <Card style={{ left: 0, top: PANEL.top, width: 900, height: 400, opacity: tw(f, [84, 96], [0, 1]) * others }}>
          <Strong style={{ position: "absolute", left: 28, top: 22, fontSize: 26 }}>Suivi des contacts</Strong>
          <Label style={{ position: "absolute", right: 28, top: 26 }}>Origine</Label>
        </Card>
        {CONTACTS.map((c, i) => {
          const t0 = 96 + i * 9;
          const p = tw(f, [t0, t0 + 22], [0, 1], EASE_IN_OUT);
          const [sx, sy] = srcCenter(i);
          const x = (sx - 450) * (1 - p) * 0.6;
          const y = sy + (PANEL.rowY(i) - sy) * p;
          const isFocus = i === 3;
          const finalY = isFocus ? y + (CAMILLE_ROW_Y - y) * move : y;
          const originOn = tw(f, [112 + i * 6, 120 + i * 6], [0, 1]);
          return (
            <ContactRow
              key={c.name}
              name={c.name}
              origin={c.origin}
              y={finalY}
              highlight={isFocus ? focus : 0}
              style={{ transform: `translateX(${x}px) scale(${0.86 + 0.14 * p})`, opacity: tw(f, [t0, t0 + 6], [0, 1]) * (isFocus ? 1 : others), height: isFocus ? 72 + 12 * move : 72, marginTop: isFocus ? 6 * (1 - move) : 6, borderColor: isFocus && focus > 0.5 ? C.blue : originOn > 0.5 && f < 150 ? "#C9D4FF" : C.line }}
            />
          );
        })}
        <Marker
          keys={[[0, 450, 450], [10, ...srcCenter(0)], [25, ...srcCenter(1)], [50, ...srcCenter(2)], [71, ...srcCenter(3)], [123, ACTION_X, PANEL.rowY(3)], [168, ACTION_X, PANEL.rowY(3)], [200, ACTION_X, CAMILLE_ROW_Y]]}
          taps={[150]}
        />
      </Stage>
    </>
  );
};
