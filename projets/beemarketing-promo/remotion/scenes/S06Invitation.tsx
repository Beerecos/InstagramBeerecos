import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Avatar, Button, Card, Check, ConceptTag, Label, Marker, Pill, Stage, Strong, Titles, font, tw } from "../ui";
import { MARK_S05_END } from "./S05Followup";
import { initials } from "./shared";

/** Scène 6 — Invitation : choix du club et de la date, l'invitant reste identifié, puis carte d'inscription. */
const { demo } = CFG;
const FORM = { x: 0, y: 20, w: 900, h: 860 };
const FIELD_Y = { invite: 120, club: 270, date: 420, inviter: 570 };
const SUBMIT = { x: 40, y: 740, w: 820 };
export const REG = { x: 120, y: 260, w: 660, h: 380 };
export const MARK_S06_END: [number, number] = [REG.x + REG.w - 56, REG.y + 52];
const TAP_CLUB_OPEN = 30;
const TAP_CLUB = 46;
const TAP_DATE = 63;
const TAP_SUBMIT = 134;

const Field: React.FC<{ label: string; y: number; active?: number; children: React.ReactNode }> = ({ label, y, active = 0, children }) => (
  <div style={{ position: "absolute", left: 40, top: y, width: 820 }}>
    <Label style={{ fontSize: 21 }}>{label}</Label>
    <div style={{ marginTop: 8, height: 84, borderRadius: 18, border: `2px solid ${active > 0.5 ? C.blue : C.line}`, boxShadow: `0 0 0 ${active * 5}px rgba(40,81,255,0.12)`, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", ...font, fontSize: 27, fontWeight: 500, color: C.black }}>
      {children}
    </div>
  </div>
);

export const S06Invitation: React.FC = () => {
  const f = useCurrentFrame();
  const form = tw(f, [0, 14], [0, 1]) * (1 - tw(f, [142, 156], [0, 1]));
  const reg = tw(f, [148, 166], [0, 1]);
  const dropdown = tw(f, [TAP_CLUB_OPEN + 1, TAP_CLUB_OPEN + 8], [0, 1]) * (1 - tw(f, [TAP_CLUB + 1, TAP_CLUB + 7], [0, 1]));
  const clubChosen = f >= TAP_CLUB;
  const dateChosen = f >= TAP_DATE;
  const inviterOn = tw(f, [82, 92], [0, 1]) * (1 - tw(f, [124, 132], [0, 1]));
  const dot = (y: number) => FORM.y + y + 30 + 8 + 42;
  return (
    <>
      <ConceptTag />
      <Titles items={[{ text: "Une invitation. Une\u00a0rencontre.", from: 0 }]} accent={["rencontre"]} />
      <Stage>
        <Card style={{ left: FORM.x, top: FORM.y, width: FORM.w, height: FORM.h, opacity: form, transform: `scale(${0.96 + 0.04 * tw(f, [0, 14], [0, 1])})` }}>
          <Strong style={{ position: "absolute", left: 40, top: 32, fontSize: 32 }}>Invitation à une réunion</Strong>
          <Field label="Invité" y={FIELD_Y.invite}>
            <Avatar initials={initials(demo.contact.name)} size={48} />
            {demo.contact.name}
          </Field>
          <Field label="Club" y={FIELD_Y.club} active={f >= TAP_CLUB_OPEN && f < TAP_CLUB + 14 ? 1 : 0}>
            <span style={{ color: clubChosen ? C.black : C.grey }}>{clubChosen ? demo.club : "Choisir un club"}</span>
          </Field>
          <Field label="Date de réunion" y={FIELD_Y.date} active={f >= TAP_DATE - 2 && f < TAP_DATE + 14 ? 1 : 0}>
            <Pill tone={dateChosen ? "blue" : "grey"}>{demo.meeting}</Pill>
            <Pill tone="grey">Réunion suivante</Pill>
          </Field>
          <Field label="Invité par" y={FIELD_Y.inviter} active={inviterOn}>
            <Avatar initials={initials(demo.contact.inviter)} size={48} />
            {demo.contact.inviter}
            <Pill tone="soft" style={{ marginLeft: "auto" }}>Adhérent · invitant</Pill>
          </Field>
          <Button pressed={tw(f, [TAP_SUBMIT - 3, TAP_SUBMIT], [0, 1]) * (1 - tw(f, [TAP_SUBMIT, TAP_SUBMIT + 5], [0, 1]))} style={{ left: SUBMIT.x, top: SUBMIT.y, width: SUBMIT.w, height: 80 }}>
            Confirmer l'inscription
          </Button>
          {/* Liste déroulante des clubs (données de démonstration). */}
          <div style={{ position: "absolute", left: 40, top: FIELD_Y.club + 130, width: 820, opacity: dropdown, transform: `translateY(${(1 - dropdown) * -10}px)`, background: C.white, borderRadius: 18, border: `2px solid ${C.line}`, boxShadow: "0 20px 50px rgba(11,21,51,0.12)", overflow: "hidden" }}>
            {[demo.club, "Club démo · Biarritz"].map((c, i) => (
              <div key={c} style={{ ...font, height: 74, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 26, fontWeight: 500, background: i === 0 ? C.blueSoft : C.white, color: i === 0 ? C.blue : C.black }}>{c}</div>
            ))}
          </div>
        </Card>
        <Card active={0.5} style={{ left: REG.x, top: REG.y, width: REG.w, height: REG.h, padding: "34px 38px", opacity: reg, transform: `scale(${0.9 + 0.1 * reg})` }}>
          <Label>Inscription</Label>
          <Strong style={{ fontSize: 38, marginTop: 4 }}>{demo.contact.name}</Strong>
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <Strong style={{ fontSize: 26, fontWeight: 500 }}>{demo.club}</Strong>
            <Strong style={{ fontSize: 26, fontWeight: 500 }}>{demo.meeting}</Strong>
            <Label style={{ fontSize: 24, color: C.blue, fontWeight: 600 }}>Invitée par {demo.contact.inviter}</Label>
          </div>
          <div style={{ position: "absolute", right: 34, top: 30, opacity: tw(f, [170, 178], [0, 1]) }}>
            <Check size={44} progress={tw(f, [170, 180], [0, 1])} />
          </div>
        </Card>
        <Marker
          keys={[[0, ...MARK_S05_END], [24, 780, dot(FIELD_Y.club)], [40, 300, FIELD_Y.club + 20 + 130 + 37], [56, 300, FIELD_Y.club + 20 + 130 + 37], [60, 180, dot(FIELD_Y.date)], [76, 180, dot(FIELD_Y.date)], [88, 780, dot(FIELD_Y.inviter)], [120, 780, dot(FIELD_Y.inviter)], [130, 450, FORM.y + SUBMIT.y + 40], [150, 450, FORM.y + SUBMIT.y + 40], [172, ...MARK_S06_END]]}
          taps={[TAP_CLUB_OPEN, TAP_CLUB, TAP_DATE, TAP_SUBMIT]}
        />
      </Stage>
    </>
  );
};
