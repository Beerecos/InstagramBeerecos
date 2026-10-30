import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Avatar, Button, Card, ConceptTag, Label, Marker, Pill, Stage, Strong, Titles, tw } from "../ui";
import { ACTION_X, CAMILLE_ROW_Y, ContactRow, LIST, initials } from "./shared";

/** Scène 5 — Suivi : qui contacter, qui inviter, qui relancer ; puis la fiche du contact suivi. */
const { demo } = CFG;
const ROWS = [
  { name: demo.contactOther2.name, origin: "LinkedIn", action: "Contacter", at: 57 },
  { name: demo.contact.name, origin: demo.contact.origin, action: "Inviter", at: 81 },
  { name: demo.contactOther.name, origin: "Email", action: "Relancer", at: 100 },
  { name: demo.contactAbsent.name, origin: "Instagram", action: "Inviter", at: 999 },
];
export const INVITE_BTN = { x: 650, y: 790, w: 210 };
export const MARK_S05_END: [number, number] = [INVITE_BTN.x + INVITE_BTN.w - 26, INVITE_BTN.y + 40];
const TAP = 165;

export const S05Followup: React.FC = () => {
  const f = useCurrentFrame();
  const list = tw(f, [0, 14], [0, 1]);
  const dim = tw(f, [112, 126], [1, 0.35]);
  const sheet = tw(f, [116, 136], [0, 1]);
  const fields = [
    ["Origine", demo.contact.origin],
    ["Invitant", `${demo.contact.inviter} · adhérent`],
    ["Statut", demo.contact.status],
    ["Prochaine action", demo.contact.nextAction],
  ];
  return (
    <>
      <ConceptTag />
      <Titles items={[{ text: "La bonne prochaine action.", from: 0 }]} accent={["prochaine", "action"]} />
      <Stage>
        <Card style={{ left: 0, top: LIST.top, width: 900, height: LIST.height, opacity: list * dim, background: C.surface, border: "none", boxShadow: "none" }}>
          <Strong style={{ position: "absolute", left: 24, top: 20, fontSize: 26 }}>Prospects</Strong>
          <Label style={{ position: "absolute", right: 24, top: 24 }}>Prochaine action</Label>
        </Card>
        {ROWS.map((r, i) => {
          const on = tw(f, [r.at, r.at + 8], [0, 1]);
          const isCamille = r.name === demo.contact.name;
          return (
            <ContactRow
              key={r.name}
              name={r.name}
              origin={r.origin}
              action={r.action}
              y={LIST.rowY[i]}
              actionOn={on}
              highlight={isCamille ? Math.max(1 - tw(f, [0, 12], [0, 1]), on) : 0}
              style={{ opacity: (isCamille ? 1 : tw(f, [4 + i * 3, 16 + i * 3], [0, 1])) * (isCamille ? 1 : dim) }}
            />
          );
        })}
        <Card active={0.4} style={{ left: 0, top: 540, width: 900, height: 360, padding: "28px 32px", opacity: sheet, transform: `translateY(${(1 - sheet) * 40}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Avatar initials={initials(demo.contact.name)} size={76} />
            <div>
              <Strong style={{ fontSize: 32 }}>{demo.contact.name}</Strong>
              <Label>{demo.contact.role}</Label>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 14, columnGap: 20, marginTop: 22, width: 560 }}>
            {fields.map(([k, v]) => (
              <div key={k}>
                <Label style={{ fontSize: 19 }}>{k}</Label>
                <Strong style={{ fontSize: 23, color: k === "Prochaine action" ? C.blue : C.black }}>{v}</Strong>
              </div>
            ))}
          </div>
          <Pill tone="green" style={{ position: "absolute", right: 32, top: 40 }}>Qualifiée</Pill>
        </Card>
        <Button pressed={tw(f, [TAP - 3, TAP], [0, 1]) * (1 - tw(f, [TAP, TAP + 5], [0, 1]))} style={{ left: INVITE_BTN.x, top: INVITE_BTN.y, width: INVITE_BTN.w, opacity: sheet }}>
          Inviter
        </Button>
        <Marker
          keys={[[0, ACTION_X, CAMILLE_ROW_Y], [12, ACTION_X, CAMILLE_ROW_Y], [57, ACTION_X, LIST.rowY[0]], [81, ACTION_X, LIST.rowY[1]], [100, ACTION_X, LIST.rowY[2]], [112, ACTION_X, LIST.rowY[2]], [150, ...MARK_S05_END]]}
          taps={[TAP]}
        />
      </Stage>
    </>
  );
};
