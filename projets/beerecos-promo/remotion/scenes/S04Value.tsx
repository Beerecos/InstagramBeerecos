import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "../config";
import { Card, Check, EASE_IN_OUT, Icon, Label, Pill, Strong, Titles, tw } from "../ui";
import { Dot, Link, Person, Pt, Rect, lerpRect, useVisual } from "../kit";
import { NODES, s03End } from "./S03Network";

/** Scène 4 — La valeur du réseau : le lien devient une carte « Mise en relation », puis une opportunité. Aucun montant. */
export const S04Value: React.FC = () => {
  const f = useCurrentFrame();
  const { V, v, at, center } = useVisual();
  const start = s03End(at);
  const a = at(...NODES.contact);
  const b = at(...NODES.vous);
  // Le lien de la scène 3 se transforme en carte.
  const grow = tw(f, [4, 30], [0, 1], EASE_IN_OUT);
  const card: Rect = v ? { x: V.x, y: V.y + 110, w: V.w, h: 300 } : { x: V.x, y: V.y + 50, w: V.w, h: 270 };
  const seed: Rect = { x: Math.min(a[0], b[0]) - 20, y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]) + 40, h: Math.abs(a[1] - b[1]) };
  const r = lerpRect(seed, card, grow);
  const check = tw(f, [42, 54], [0, 1]);
  const opp = tw(f, [66, 82], [0, 1]);
  const oppRect: Rect = v ? { x: V.x, y: V.y + 450, w: V.w, h: 220 } : { x: V.x, y: V.y + 360, w: V.w, h: 200 };
  const note = tw(f, [60, 72], [0, 1]);
  const out = 1 - tw(f, [150, 168], [0, 1]);
  const pA: Pt = [card.x + 120, card.y + card.h / 2 + 30];
  const pB: Pt = [card.x + card.w - 120, card.y + card.h / 2 + 30];
  return (
    <>
      <Titles items={[{ text: "Votre réseau a de la valeur.", from: 0, to: 172 }]} accent={["valeur."]} />
      <Link a={a} b={b} p={1} opacity={1 - grow} />
      <div style={{ opacity: out }}>
        <Card active={0.5} style={{ left: r.x, top: r.y, width: r.w, height: r.h, overflow: "hidden", opacity: tw(f, [2, 12], [0, 1]) }}>
          <div style={{ opacity: tw(f, [24, 36], [0, 1]) }}>
            <Strong style={{ position: "absolute", left: 36, top: 30, fontSize: v ? 38 : 34 }}>Mise en relation</Strong>
            <div style={{ position: "absolute", right: 30, top: 26, opacity: check }}>
              <Check size={46} progress={check} />
            </div>
          </div>
        </Card>
        {grow > 0.95 && (
          <>
            <Link a={pA} b={pB} p={tw(f, [30, 44], [0, 1])} />
            {[pA, pB].map((p, i) => (
              <div key={i} style={{ position: "absolute", left: p[0] - 50, top: p[1] - 50, width: 100, height: 100, borderRadius: 50, background: C.blueSoft, border: `3px solid ${C.blue}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", opacity: tw(f, [28, 38], [0, 1]) }}>
                <Person size={56} />
              </div>
            ))}
            <Label style={{ position: "absolute", left: pA[0] - 60, top: pA[1] + 58, width: 120, textAlign: "center", fontSize: 24, color: C.black, opacity: tw(f, [32, 42], [0, 1]) }}>Vous</Label>
            <Label style={{ position: "absolute", left: pB[0] - 100, top: pB[1] + 58, width: 200, textAlign: "center", fontSize: 24, color: C.black, opacity: tw(f, [32, 42], [0, 1]) }}>Un contact</Label>
          </>
        )}
        <Card style={{ left: oppRect.x, top: oppRect.y, width: oppRect.w, height: oppRect.h, display: "flex", alignItems: "center", gap: 26, padding: "0 36px", opacity: opp, transform: `translateY(${(1 - opp) * 40}px)` }}>
          <div style={{ width: 96, height: 96, borderRadius: 26, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Icon.Link size={56} color={C.white} />
          </div>
          <div>
            <Label style={{ fontSize: 24 }}>Opportunité</Label>
            <Strong style={{ fontSize: v ? 34 : 30 }}>Un projet à étudier ensemble</Strong>
          </div>
        </Card>
        <Pill tone="soft" style={{ position: "absolute", left: V.x, top: oppRect.y + oppRect.h + (v ? 40 : 30), fontSize: v ? 26 : 23, padding: "12px 24px", opacity: note }}>
          Rémunération possible selon les conditions du réseau
        </Pill>
      </div>
      <Dot keys={[[0, ...start], [26, (pA[0] + pB[0]) / 2, pA[1]], [56, (pA[0] + pB[0]) / 2, pA[1]], [80, oppRect.x + oppRect.w - 50, oppRect.y + oppRect.h / 2], [150, oppRect.x + oppRect.w - 50, oppRect.y + oppRect.h / 2], [176, ...center]]} />
    </>
  );
};
