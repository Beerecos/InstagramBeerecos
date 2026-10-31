import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { EASE_IN_OUT, Label, Strong, Titles, font, tw, useFormat } from "../ui";
import { Dot, IMAGES, Link, PhotoWindow, Pt, Rect, VideoWindow, cover, lerpRect, useVisual } from "../kit";

/** Scène 5 — Pilier 2 : BeeSchool. Le mot « Formation » passe derrière le formateur détouré, puis la ligne de progression. */
const SKILLS = [
  { label: "Prospecter", at: 142 },
  { label: "Vendre", at: 186 },
  { label: "S'organiser", at: 217 },
];

/** Marque BeeSchool provisoire (typographique, même famille que BeeRecos) : à remplacer par le logo officiel. */
const BeeSchoolMark: React.FC<{ a: number }> = ({ a }) => {
  const { title } = useFormat();
  const v = title.y > 100;
  return (
    <div style={{ position: "absolute", left: title.x, top: title.y, width: title.width, height: title.height, display: "flex", flexDirection: "column", justifyContent: "flex-end", opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
      <div style={{ ...font, fontSize: v ? 104 : 96, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>
        <span style={{ color: C.black }}>Bee</span>
        <span style={{ color: C.blue }}>School</span>
      </div>
      <Label style={{ fontSize: v ? 38 : 34, marginTop: 14, color: C.grey }}>L'école de formation BeeRecos</Label>
    </div>
  );
};

export const S05School: React.FC = () => {
  const f = useCurrentFrame();
  const { V, v, center } = useVisual();
  const enter = tw(f, [0, 20], [0, 1]);
  const small: Rect = v ? { x: V.x, y: V.y, w: V.w, h: 470 } : { x: V.x, y: V.y, w: V.w, h: 420 };
  const shrink = tw(f, [118, 140], [0, 1], EASE_IN_OUT);
  const rect = lerpRect(V, small, shrink);
  const word = tw(f, [6, 26], [0, 1]);
  const img = IMAGES.formateur;
  // Ligne de progression sous la photo.
  const lineY = v ? V.y + 700 : V.y + 590;
  const xs = [0.12, 0.5, 0.88].map((p) => V.x + V.w * p);
  const nodes: Pt[] = xs.map((x) => [x, lineY]);
  const prog = tw(f, [SKILLS[0].at - 6, SKILLS[2].at], [0, 1], EASE_IN_OUT);
  const lineIn = tw(f, [128, 142], [0, 1]);
  const out = 1 - tw(f, [252, 268], [0, 1]);
  return (
    <>
      <Titles items={[{ text: "École de formation", from: 0, to: 40 }]} accent={["formation"]} />
      <BeeSchoolMark a={tw(f, [40, 54], [0, 1]) * out} />
      <div style={{ opacity: enter * out, transform: `scale(${0.94 + 0.06 * enter})`, transformOrigin: `${center[0]}px ${center[1]}px` }}>
        <PhotoWindow name="formateur" rect={rect} push={0.06 * tw(f, [0, 270], [0, 1])} tag={false}>
          {(map) => {
            // Calque 1 : photo ; calque 2 : le mot ; calque 3 : formateur et public détourés (même cadrage).
            const c = cover(img, rect, 1.05 * (1 + 0.06 * tw(f, [0, 270], [0, 1])));
            const [, wy] = map(0, 205);
            // Le mot se termine juste derrière le formateur (x ≈ 980 px dans l'image) : seule la dernière lettre passe derrière lui.
            const [tx] = map(1010, 0);
            return (
              <>
                <div style={{ ...font, position: "absolute", right: Math.max(rect.w - tx, 24), top: wy - (v ? 90 : 95), textAlign: "right", whiteSpace: "nowrap", fontSize: v ? 140 : 150, fontWeight: 600, letterSpacing: "-0.03em", color: C.blue, opacity: word, transform: `translateY(${(1 - word) * 60}px)` }}>
                  Formation
                </div>
                <Img src={staticFile(CFG.media.formationSujet)} style={{ position: "absolute", left: -c.ox, top: -c.oy, width: c.iw, height: c.ih }} />
                <div style={{ ...font, position: "absolute", left: 22, bottom: 16, fontSize: 22, fontWeight: 500, color: "rgba(255,255,255,0.9)", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{CFG.labels.illustration}</div>
              </>
            );
          }}
        </PhotoWindow>
      </div>
      {f >= 128 && <div style={{ opacity: out }}><VideoWindow name="formation" rect={rect} from={0} opacity={tw(f, [130, 146], [0, 1])} /></div>}
      <div style={{ opacity: lineIn * out }}>
        <Link a={nodes[0]} b={nodes[2]} p={1} color={C.line} width={6} />
        <Link a={nodes[0]} b={nodes[2]} p={prog} />
        {SKILLS.map((s, i) => {
          const on = tw(f, [s.at, s.at + 8], [0, 1]);
          return (
            <React.Fragment key={s.label}>
              <div style={{ position: "absolute", left: nodes[i][0] - 22, top: lineY - 22, width: 44, height: 44, borderRadius: 22, boxSizing: "border-box", background: on > 0.5 ? C.blue : C.white, border: `4px solid ${on > 0.5 ? C.blue : C.line}` }} />
              <Strong style={{ position: "absolute", left: nodes[i][0] - 160, top: lineY + 44, width: 320, textAlign: "center", fontSize: v ? 40 : 36, fontWeight: on > 0.5 ? 600 : 400, color: on > 0.5 ? C.black : C.grey, opacity: 0.4 + 0.6 * on, transform: `translateY(${(1 - on) * 10}px)` }}>
                {s.label}
              </Strong>
            </React.Fragment>
          );
        })}
      </div>
      <Dot keys={[[0, ...center], [20, V.x + V.w - 54, V.y + 54], [128, V.x + V.w - 54, V.y + 54], [142, ...nodes[0]], [SKILLS[0].at, ...nodes[0]], [SKILLS[1].at, ...nodes[1]], [SKILLS[2].at, ...nodes[2]], [250, ...nodes[2]], [268, ...center]]} />
    </>
  );
};
