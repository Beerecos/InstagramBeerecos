import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { CFG } from "../config";
import { Pill, Titles, tw, useFormat } from "../ui";
import { Dot, Pt, Rect, useVisual } from "../kit";

/**
 * Scène 8 — L'invitation : extrait réel du site de référence (section « BeeRecos près de chez vous »),
 * recadré sans barre d'adresse ni domaine ni QR code ; l'adresse publique est affichée à part.
 */
const CAP = { w: 1466, h: 788 };

export const S08Invite: React.FC = () => {
  const f = useCurrentFrame();
  const { V, v, center } = useVisual();
  const { title } = useFormat();
  const cap = tw(f, [0, 16], [0, 1]);
  const url = tw(f, [64, 74], [0, 1]);
  const bump = tw(f, [8, 14], [0, 1]) * (1 - tw(f, [14, 24], [0, 1]));
  // 9:16 : on recadre la capture sur le titre et le bouton ; 16:9 : capture entière.
  const r: Rect = v ? { x: V.x, y: V.y + 60, w: V.w, h: 560 } : { x: V.x, y: V.y + 40, w: V.w, h: (V.w * CAP.h) / CAP.w };
  const scale = v ? 560 / CAP.h : V.w / CAP.w;
  const push = 1 + 0.04 * tw(f, [0, 150], [0, 1]);
  const pill: Pt = [center[0], r.y + r.h + (v ? 140 : 110)];
  const pw = v ? 420 : 360;
  return (
    <>
      {/* Bref mouvement d'attention sur « Découvrez ». */}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + 0.035 * bump})`, transformOrigin: `${title.x}px ${title.y + title.height}px` }}>
        <Titles items={[{ text: "Découvrez un club près de chez vous.", from: 0 }]} accent={["Découvrez"]} />
      </div>
      <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: 32, overflow: "hidden", opacity: cap, transform: `translateY(${(1 - cap) * 40}px)`, boxShadow: "0 30px 70px rgba(11,21,51,0.2)" }}>
        <Img src={staticFile(CFG.media.presDeChezVous)} style={{ position: "absolute", left: 0, top: 0, width: CAP.w * scale * push, height: CAP.h * scale * push, transformOrigin: "0 0" }} />
      </div>
      <Pill tone="blue" style={{ position: "absolute", left: pill[0] - pw / 2, top: pill[1] - 44, width: pw, height: 88, justifyContent: "center", fontSize: v ? 44 : 38, padding: 0, opacity: url, transform: `scale(${0.9 + 0.1 * url})` }}>
        {CFG.urls.displayDomain}
      </Pill>
      <Dot keys={[[0, ...center], [24, r.x + r.w - 40, r.y + 40], [56, r.x + r.w - 40, r.y + 40], [72, pill[0] + pw / 2 + 36, pill[1]], [126, pill[0] + pw / 2 + 36, pill[1]], [148, ...center]]} />
    </>
  );
};
