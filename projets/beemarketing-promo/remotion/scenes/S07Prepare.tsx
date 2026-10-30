import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Card, Check, ConceptTag, EASE_IN_OUT, Icon, Label, Marker, Pill, Stage, Strong, Titles, font, tw } from "../ui";
import { MARK_S06_END, REG } from "./S06Invitation";
import { initials } from "./shared";
import { Avatar } from "../ui";

/** Scène 7 — Préparer la rencontre : confirmation, calendrier, rappel J−2, puis tableau de l'animateur. */
const { demo } = CFG;
export const GUESTS = { x: 0, y: 40, w: 900, h: 330, rowY: [190, 290] };
export const GUEST_ROWS = [
  { name: demo.contact.name, origin: `Invitée par ${demo.contact.inviter}` },
  { name: demo.contactAbsent.name, origin: "Origine : Instagram" },
];
const CAL = { x: 0, y: 250, w: 900, h: 420 };
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
export const MARK_S07_END: [number, number] = [704, GUESTS.rowY[0]];

export const GuestTable: React.FC<{ opacity?: number; status?: (i: number) => React.ReactNode; title?: string }> = ({ opacity = 1, status, title = "Invités · Réunion du jeudi" }) => (
  <Card style={{ left: GUESTS.x, top: GUESTS.y, width: GUESTS.w, height: GUESTS.h, opacity, padding: "26px 30px" }}>
    <Label>Vue animateur</Label>
    <Strong style={{ fontSize: 30 }}>{title}</Strong>
    {GUEST_ROWS.map((g, i) => (
      <div key={g.name} style={{ position: "absolute", left: 30, right: 30, top: GUESTS.rowY[i] - GUESTS.y - 40, height: 80, display: "flex", alignItems: "center", gap: 18, borderTop: `2px solid ${C.line}` }}>
        <Avatar initials={initials(g.name)} size={52} />
        <div style={{ width: 330 }}>
          <Strong style={{ fontSize: 26 }}>{g.name}</Strong>
          <Label style={{ fontSize: 19 }}>{g.origin}</Label>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>{status?.(i)}</div>
      </div>
    ))}
  </Card>
);

export const S07Prepare: React.FC = () => {
  const f = useCurrentFrame();
  const reg = 1 - tw(f, [36, 46], [0, 1]);
  const check = tw(f, [6, 16], [0, 1]);
  const cal = tw(f, [38, 52], [0, 1]) * (1 - tw(f, [122, 134], [0, 1]));
  const event = tw(f, [50, 62], [0, 1]);
  const remind = tw(f, [72, 86], [0, 1]) * (1 - tw(f, [120, 130], [0, 1]));
  const table = tw(f, [126, 142], [0, 1]);
  return (
    <>
      <ConceptTag />
      <Titles items={[{ text: "Confirmation", from: 0, to: 38 }, { text: "Calendrier", from: 38, to: 74 }, { text: "Rappel J−2", from: 74 }]} accent={["Confirmation", "Calendrier", "J−2"]} />
      <Stage>
        {/* Carte d'inscription reprise de la scène 6, confirmée. */}
        <Card active={0.5} style={{ left: REG.x, top: REG.y, width: REG.w, height: REG.h, padding: "34px 38px", opacity: reg, transform: `scale(${1 - 0.06 * (1 - reg)})` }}>
          <Label>Inscription</Label>
          <Strong style={{ fontSize: 38, marginTop: 4 }}>{demo.contact.name}</Strong>
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <Strong style={{ fontSize: 26, fontWeight: 500 }}>{demo.club}</Strong>
            <Strong style={{ fontSize: 26, fontWeight: 500 }}>{demo.meeting}</Strong>
          </div>
          <Pill tone="green" style={{ marginTop: 26, opacity: check }}><Check size={26} color="#13867F" progress={check} /> Inscription confirmée</Pill>
          <div style={{ position: "absolute", right: 34, top: 30 }}><Check size={44} /></div>
        </Card>
        {/* Calendrier : l'inscription devient un événement. */}
        <Card style={{ left: CAL.x, top: CAL.y, width: CAL.w, height: CAL.h, opacity: cal, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Icon.Calendar size={40} />
            <Strong style={{ fontSize: 28 }}>Agenda</Strong>
            <Pill tone="green" style={{ marginLeft: "auto", opacity: event }}>Ajouté au calendrier</Pill>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 24 }}>
            {DAYS.map((d) => (
              <div key={d} style={{ height: 270, borderRadius: 16, background: C.surface, padding: 12, boxSizing: "border-box" }}>
                <Label style={{ fontSize: 20, textAlign: "center" }}>{d}</Label>
                {d === "Jeu" && (
                  <div style={{ marginTop: 14, height: 120, borderRadius: 12, background: C.blue, padding: 10, boxSizing: "border-box", opacity: event, transform: `scale(${0.8 + 0.2 * event})`, ...font, color: C.white, fontSize: 18, fontWeight: 600, lineHeight: 1.25 }}>
                    8 h 00 Réunion BeeRecos
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
        {/* Rappel à J−2. */}
        <Card active={0.4} style={{ left: 40, top: 60, width: 820, height: 150, opacity: remind, transform: `translateY(${(1 - remind) * -40}px)`, display: "flex", alignItems: "center", gap: 22, padding: "0 30px" }}>
          <div style={{ width: 80, height: 80, borderRadius: 22, background: C.blueSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Bell size={44} /></div>
          <div>
            <Label>Rappel · J−2</Label>
            <Strong style={{ fontSize: 28 }}>Votre réunion a lieu dans 2 jours.</Strong>
          </div>
        </Card>
        <GuestTable opacity={table} status={() => <Pill tone="green">Confirmé</Pill>} />
        <Marker keys={[[0, ...MARK_S06_END], [36, ...MARK_S06_END], [56, 621, CAL.y + 200], [72, 621, CAL.y + 200], [86, 780, 135], [120, 780, 135], [150, ...MARK_S07_END]]} taps={[8, 60]} />
      </Stage>
    </>
  );
};
