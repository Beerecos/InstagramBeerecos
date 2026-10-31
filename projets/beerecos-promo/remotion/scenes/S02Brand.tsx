import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, Titles, tw } from "../ui";
import { Dot, IMAGES, Link, PhotoWindow, Pt, Rect, lerpRect, useVisual } from "../kit";

/** Scène 2 — La marque : logo officiel, puis trois plans humains reliés par le fil bleu ; le dernier s'ouvre en plein cadre. */
const PLANS: (keyof typeof IMAGES)[] = ["accueil", "conversation", "reunion"];
const IN = [52, 66, 80];
const OPEN: [number, number] = [112, 140];

export const S02Brand: React.FC = () => {
  const f = useCurrentFrame();
  const { V, v, center, W, H } = useVisual();
  // Logo complet : apparition, puis montée sobre vers le haut de la zone (dessin intact, taille ≥ 150 px).
  const logoIn = tw(f, [0, 16], [0, 1]);
  const lift = tw(f, [38, 60], [0, 1], EASE_IN_OUT);
  const logoOut = 1 - tw(f, [104, 114], [0, 1]);
  const big = v ? 380 : 300;
  const small = v ? 190 : 160;
  const lw = big + (small - big) * lift;
  const lh = (lw * 752) / 705;
  const ly = center[1] - lh / 2 + (V.y + 10 - (center[1] - lh / 2)) * lift;
  // Trois fenêtres : empilées en 9:16, côte à côte en 16:9.
  const top = V.y + (v ? 240 : 230);
  const rects: Rect[] = PLANS.map((_, i) =>
    v ? { x: V.x, y: top + i * 238, w: V.w, h: 218 } : { x: V.x + i * 322, y: top, w: 300, h: 420 },
  );
  const open = tw(f, OPEN, [0, 1], EASE_IN_OUT);
  const full: Rect = { x: 0, y: 0, w: W, h: H };
  const mid = (r: Rect): Pt => (v ? [r.x + r.w - 40, r.y + r.h / 2] : [r.x + r.w / 2, r.y + r.h - 40]);
  return (
    <>
      <Titles items={[{ text: "Voici BeeRecos.", from: 0, to: 112 }]} accent={["BeeRecos"]} />
      <Img src={staticFile("brand/beerecos-logo-blue.svg")} style={{ position: "absolute", left: center[0] - lw / 2, top: ly, width: lw, height: lh, opacity: logoIn * logoOut }} />
      {PLANS.map((name, i) => {
        const a = tw(f, [IN[i], IN[i] + 12], [0, 1]);
        if (a <= 0) return null;
        const isLast = i === PLANS.length - 1;
        const r = isLast ? lerpRect(rects[i], full, open) : rects[i];
        const out = isLast ? 1 : 1 - tw(f, [OPEN[0], OPEN[0] + 10], [0, 1]);
        return (
          <div key={name} style={{ opacity: a * out, transform: `translateY(${(1 - a) * 30}px)` }}>
            <PhotoWindow name={name} rect={r} radius={36 * (1 - open * (isLast ? 1 : 0))} push={0.04 * tw(f, [IN[i], 150], [0, 1])} tag={!isLast || open < 0.5} />
          </div>
        );
      })}
      <Link a={mid(rects[0])} b={mid(rects[1])} p={tw(f, [70, 84], [0, 1])} opacity={1 - tw(f, [OPEN[0], OPEN[0] + 8], [0, 1])} />
      <Link a={mid(rects[1])} b={mid(rects[2])} p={tw(f, [86, 100], [0, 1])} opacity={1 - tw(f, [OPEN[0], OPEN[0] + 8], [0, 1])} />
      <Dot keys={[[0, ...center], [12, center[0], center[1] + ((big * 752) / 705) / 2 + 50], [40, center[0], center[1] + ((big * 752) / 705) / 2 + 50], [62, ...mid(rects[0])], [84, ...mid(rects[1])], [100, ...mid(rects[2])], [112, ...mid(rects[2])], [140, ...center]]} />
    </>
  );
};
