import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { EASE_IN_OUT, Label, Strong, Titles, tw } from "../ui";
import { Dot, Pt, Rect, VideoWindow, useVisual } from "../kit";

/**
 * Scène 6 — Pilier 3 : digitalisation IA. Du geste (vidéo du site) à l'interface réelle des BeeTools :
 * BeeCard pour échanger ses coordonnées, BeePilot pour organiser son suivi (relances). Une action à la fois.
 */
const PHONE = { w: 601, h: 1002 }; // captures recadrées des écrans BeeCard et BeePilot

const ToolShot: React.FC<{ src: string; rect: Rect; a: number; name: string; usage: string; v: boolean; hl?: { y: number; on: number } }> = ({ src, rect, a, name, usage, v, hl }) => (
  <div style={{ opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 40, overflow: "hidden", background: "#EEF1F7", boxShadow: "0 30px 70px rgba(11,21,51,0.18)" }}>
      <Img src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: rect.w, height: (rect.w * PHONE.h) / PHONE.w }} />
      {hl && (
        <div style={{ position: "absolute", left: rect.w * 0.12, top: hl.y * (rect.w / PHONE.w) - 34, width: rect.w * 0.76, height: 68, borderRadius: 18, border: `4px solid ${C.blue}`, boxShadow: `0 0 0 8px rgba(40,81,255,0.18)`, opacity: hl.on }} />
      )}
    </div>
    <div style={{ position: "absolute", left: v ? rect.x : rect.x + rect.w + 40, top: v ? rect.y + rect.h + 22 : rect.y + rect.h / 2 - 50, width: v ? rect.w : 300 }}>
      <Strong style={{ fontSize: v ? 34 : 32, textAlign: v ? "center" : "left" }}>{name}</Strong>
      <Label style={{ fontSize: v ? 26 : 24, textAlign: v ? "center" : "left" }}>{usage}</Label>
    </div>
  </div>
);

export const S06Digital: React.FC = () => {
  const f = useCurrentFrame();
  const { V, v, center } = useVisual();
  const vidIn = tw(f, [0, 16], [0, 1]);
  // Raccord geste → interface : on s'approche de l'écran de l'ordinateur, puis l'interface prend le relais.
  const zoom = tw(f, [56, 92], [0, 1], EASE_IN_OUT);
  const vidOut = 1 - tw(f, [84, 98], [0, 1]);
  const shot: Rect = v ? { x: center[0] - 230, y: V.y + 20, w: 460, h: 700 } : { x: V.x + 120, y: V.y + 40, w: 380, h: 600 };
  const card = tw(f, [92, 108], [0, 1]) * (1 - tw(f, [168, 180], [0, 1]));
  const pilot = tw(f, [178, 194], [0, 1]) * (1 - tw(f, [254, 268], [0, 1]));
  const k = shot.w / PHONE.w;
  const ajouter: Pt = [shot.x + 180 * k, shot.y + 720 * k];
  const relances: Pt = [shot.x + 0.88 * shot.w - 30, shot.y + 520 * k];
  return (
    <>
      <Titles
        items={[
          { text: "Digitalisation IA", from: 0, to: 66 },
          { text: "Simplifier", from: 66, to: 100 },
          { text: "Organiser", from: 100, to: 130 },
          { text: "Gagner du temps", from: 130 },
        ]}
        accent={["IA", "Simplifier", "Organiser", "temps"]}
      />
      <div style={{ opacity: vidIn * vidOut }}>
        <VideoWindow name="outils" rect={V} zoom={1.04 + zoom * 1.1} focus={[400, 420]} tag={zoom < 0.3} />
      </div>
      <ToolShot src={CFG.media.beecard} rect={shot} a={card} name="BeeCard" usage="Échanger ses coordonnées" v={v} />
      <ToolShot src={CFG.media.beepilot} rect={shot} a={pilot} name="BeePilot" usage="Organiser son suivi" v={v} hl={{ y: 535, on: tw(f, [214, 222], [0, 1]) }} />
      <Dot keys={[[0, ...center], [56, ...center], [96, ...center], [120, ...ajouter], [160, ...ajouter], [200, ...relances], [252, ...relances], [268, ...center]]} taps={[128, 214]} />
    </>
  );
};
