import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "../config";
import { Card, EASE_IN_OUT, Pill, Strong, Titles, tw } from "../ui";
import { Dot, Link, PhotoWindow, Person, Pt, lerpRect, useVisual } from "../kit";

/** Scène 3 — Pilier 1 : réseau d'apporteurs d'affaires. Vous → un membre → son contact : la recommandation circule. */
export const NODES = { vous: [0.27, 0.36], membre: [0.73, 0.5], contact: [0.32, 0.78] } as const;
/** Milieu du lien contact ↔ vous : point de raccord avec la scène 4. */
export const s03End = (at: (x: number, y: number) => Pt): Pt => {
  const a = at(...NODES.contact);
  const b = at(...NODES.vous);
  return [(a[0] + b[0]) / 2 - 70, (a[1] + b[1]) / 2];
};

const NodeCard: React.FC<{ p: Pt; label: string; a: number; on: number; v: boolean }> = ({ p, label, a, on, v }) => {
  const w = v ? 350 : 330;
  return (
    <Card active={on} style={{ left: p[0] - w / 2, top: p[1] - 50, width: w, height: 100, display: "flex", alignItems: "center", gap: 16, padding: "0 20px", opacity: a, transform: `scale(${0.85 + 0.15 * a})` }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: C.blueSoft, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Person size={40} />
      </div>
      <Strong style={{ fontSize: v ? 30 : 28 }}>{label}</Strong>
    </Card>
  );
};

export const S03Network: React.FC = () => {
  const f = useCurrentFrame();
  const { V, v, at, W, H } = useVisual();
  const shrink = tw(f, [0, 26], [0, 1], EASE_IN_OUT);
  const rect = lerpRect({ x: 0, y: 0, w: W, h: H }, V, shrink);
  const fadeOut = 1 - tw(f, [236, 258], [0, 1]);
  // Mouvement de caméra discret : la scène suit la mise en relation.
  const pan = tw(f, [40, 200], [0, 1], EASE_IN_OUT);
  const shift = (p: Pt): Pt => [p[0] + (v ? -20 : -24) * pan, p[1] + (v ? -30 : -16) * pan];
  const vous = shift(at(...NODES.vous));
  const membre = shift(at(...NODES.membre));
  const contact = shift(at(...NODES.contact));
  const l1 = tw(f, [47, 70], [0, 1]);
  const l2 = tw(f, [92, 116], [0, 1]);
  const l3 = tw(f, [150, 176], [0, 1]);
  const end = s03End(at);
  const top = (p: Pt): Pt => [p[0], p[1] - 52];
  return (
    <>
      <Titles
        items={[
          { text: "Réseau d'apporteurs d'affaires", from: 8, to: 70 },
          { text: "Rencontrer", from: 70, to: 122 },
          { text: "Recommander", from: 122, to: 176 },
          { text: "Développer", from: 176 },
        ]}
        accent={["Réseau", "Rencontrer", "Recommander", "Développer"]}
      />
      <div style={{ opacity: fadeOut }}>
        <PhotoWindow name="reunion" rect={rect} radius={36 * shrink} dim={0.25 + 0.2 * shrink} push={0.05 * tw(f, [0, 270], [0, 1])} tag={shrink > 0.9} />
      </div>
      <div style={{ opacity: fadeOut }}>
        <Link a={vous} b={membre} p={l1} />
        <Link a={membre} b={contact} p={l2} />
      </div>
      <Link a={contact} b={vous} p={l3} />
      <div style={{ opacity: fadeOut }}>
        <NodeCard p={vous} label="Vous" a={tw(f, [22, 34], [0, 1])} on={Math.max(l1 > 0.9 ? 1 : 0, l3 > 0.9 ? 1 : 0)} v={v} />
        <NodeCard p={membre} label="Un membre" a={tw(f, [30, 42], [0, 1])} on={l1 > 0.9 && l3 < 0.9 ? 1 : 0} v={v} />
        <NodeCard p={contact} label="Son contact" a={tw(f, [84, 96], [0, 1])} on={l2 > 0.9 ? 1 : 0} v={v} />
        <Pill tone="blue" style={{ position: "absolute", left: end[0] - (v ? 30 : 10), top: end[1] - 24, fontSize: v ? 26 : 24, opacity: tw(f, [170, 180], [0, 1]) * (1 - tw(f, [226, 236], [0, 1])) }}>
          Nouvelle opportunité
        </Pill>
      </div>
      <Dot keys={[[0, ...at(0.5, 0.5)], [36, ...top(vous)], [47, ...top(vous)], [70, ...top(membre)], [92, ...top(membre)], [116, ...top(contact)], [150, ...top(contact)], [176, ...top(vous)], [236, ...top(vous)], [262, ...end]]} />
    </>
  );
};
