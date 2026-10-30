import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Avatar, Card, Check, ConceptTag, Icon, Label, Marker, Pill, Stage, Strong, Titles, font, tw } from "../ui";
import { GUESTS, GuestTable, MARK_S07_END } from "./S07Prepare";
import { initials } from "./shared";

/** Scène 8 — Jour J : l'animateur saisit la présence. Présent → lien d'adhésion ; absent → nouvelle invitation. */
const { demo, urls } = CFG;
const TAP_PRESENT = 20;
const TAP_ABSENT = 110;
const PANEL = { x: 0, y: 410, w: 900, h: 300 };
const HUMAN = { x: 0, y: 740, w: 900, h: 140 };
const BTN = { present: 648, absent: 800 };

const Toggle: React.FC<{ label: string; on: number; tone: "green" | "grey"; pressed?: number }> = ({ label, on, tone, pressed = 0 }) => (
  <div style={{ ...font, width: 140, height: 60, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 22, fontWeight: 600, boxSizing: "border-box", transform: `scale(${1 - 0.06 * pressed})`, border: `2px solid ${on > 0.5 ? (tone === "green" ? "#13867F" : C.grey) : C.line}`, background: on > 0.5 ? (tone === "green" ? "#E3F7F5" : C.surface) : C.white, color: on > 0.5 ? (tone === "green" ? "#13867F" : C.black) : C.grey }}>
    {label}
  </div>
);

export const S08Attendance: React.FC = () => {
  const f = useCurrentFrame();
  const press = (t: number) => tw(f, [t - 3, t], [0, 1]) * (1 - tw(f, [t, t + 5], [0, 1]));
  const present = tw(f, [TAP_PRESENT, TAP_PRESENT + 4], [0, 1]);
  const absent = tw(f, [TAP_ABSENT, TAP_ABSENT + 4], [0, 1]);
  const panelA = tw(f, [36, 52], [0, 1]) * (1 - tw(f, [112, 122], [0, 1]));
  const linkSent = tw(f, [62, 72], [0, 1]);
  const panelB = tw(f, [120, 136], [0, 1]);
  const proposal = tw(f, [140, 150], [0, 1]);
  const human = tw(f, [166, 182], [0, 1]);
  return (
    <>
      <ConceptTag />
      <Titles items={[{ text: "Présent → lien d'adhésion", from: 0, to: 114 }, { text: "Absent → nouvelle invitation", from: 114 }]} accent={["Présent", "Absent"]} />
      <Stage>
        <GuestTable
          title="Jour J · Réunion du jeudi"
          status={(i) => (
            <>
              <Toggle label="Présent" tone="green" on={i === 0 ? present : 0} pressed={i === 0 ? press(TAP_PRESENT) : 0} />
              <Toggle label="Absent" tone="grey" on={i === 1 ? absent : 0} pressed={i === 1 ? press(TAP_ABSENT) : 0} />
            </>
          )}
        />
        {/* Cas principal : présente → lien d'adhésion envoyé, adhésion encore à conclure. */}
        <Card active={0.4} style={{ left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, opacity: panelA, padding: "28px 32px", transform: `translateY(${(1 - panelA) * 30}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Avatar initials={initials(demo.contact.name)} size={64} />
            <Strong style={{ fontSize: 30 }}>{demo.contact.name}</Strong>
            <Pill tone="green" style={{ marginLeft: "auto" }}><Check size={24} color="#13867F" /> Présente</Pill>
          </div>
          <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 16, opacity: linkSent }}>
            <Icon.Link size={40} />
            <Strong style={{ fontSize: 26 }}>Lien d'adhésion envoyé</Strong>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 12, opacity: linkSent }}>
            <Pill tone="soft">{urls.adhesionDisplay}</Pill>
            <Pill tone="grey">Adhésion : en attente</Pill>
          </div>
        </Card>
        {/* Cas alternatif : absent → proposition de la réunion suivante, même contact. */}
        <Card active={0.4} style={{ left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, opacity: panelB, padding: "28px 32px", transform: `translateY(${(1 - panelB) * 30}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Avatar initials={initials(demo.contactAbsent.name)} size={64} tone={C.grey} />
            <Strong style={{ fontSize: 30 }}>{demo.contactAbsent.name}</Strong>
            <Pill tone="grey" style={{ marginLeft: "auto" }}>Absent</Pill>
          </div>
          <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 16, opacity: proposal }}>
            <Icon.Calendar size={40} />
            <Strong style={{ fontSize: 26 }}>Nouvelle invitation proposée</Strong>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 12, opacity: proposal }}>
            <Pill tone="soft">{demo.nextMeeting}</Pill>
            <Pill tone="grey">Même contact, historique conservé</Pill>
          </div>
        </Card>
        {/* La relation commerciale reste humaine. */}
        <Card style={{ left: HUMAN.x, top: HUMAN.y, width: HUMAN.w, height: HUMAN.h, opacity: human, transform: `translateY(${(1 - human) * 30}px)`, display: "flex", alignItems: "center", gap: 22, padding: "0 30px", background: C.blueSoft, border: "none" }}>
          <div style={{ width: 76, height: 76, borderRadius: 38, background: C.white, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Phone size={40} /></div>
          <div>
            <Strong style={{ fontSize: 26 }}>{demo.contact.inviter} rappelle {demo.contact.name.split(" ")[0]}</Strong>
            <Label style={{ fontSize: 21 }}>Échange commercial et adhésion : décision humaine.</Label>
          </div>
        </Card>
        <Marker
          keys={[[0, ...MARK_S07_END], [16, BTN.present + 56, GUESTS.rowY[0]], [36, BTN.present + 56, GUESTS.rowY[0]], [62, 60, PANEL.y + 140], [96, 60, PANEL.y + 140], [106, BTN.absent + 56, GUESTS.rowY[1]], [126, BTN.absent + 56, GUESTS.rowY[1]], [150, 60, PANEL.y + 140], [166, 60, PANEL.y + 140], [184, 68, HUMAN.y + HUMAN.h / 2]]}
          taps={[TAP_PRESENT, TAP_ABSENT]}
        />
      </Stage>
    </>
  );
};
