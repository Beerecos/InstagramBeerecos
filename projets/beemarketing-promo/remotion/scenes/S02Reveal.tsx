import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Card, ConceptTag, EASE_IN_OUT, Icon, Marker, Stage, Strong, Titles, Label, font, tw } from "../ui";

/** Scène 2 — Révélation : logo, puis l'application qui relie contenus, campagnes et contacts. */
export const MARK_S02_END: [number, number] = [64, 304];

const NAV = ["Accueil", "Studio", "Campagnes", "Prospects", "Clubs"];
const TILES = [
  { label: "Contenus", value: "Studio", icon: Icon.Layers, at: 56 },
  { label: "Campagnes", value: "4 sources", icon: Icon.Mail, at: 81 },
  { label: "Contacts", value: "Suivi", icon: Icon.Referral, at: 103 },
];

export const S02Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const [cx, cy] = CFG.marker.introEnd;
  // Charte : le logo n'est animé qu'en opacité.
  const logo = tw(f, [4, 22], [0, 1]) * tw(f, [44, 56], [1, 0], EASE_IN_OUT);
  const app = tw(f, [44, 70], [0, 1]);
  const appScale = tw(f, [44, 80], [0.9, 1]);
  const studio = tw(f, [134, 142], [0, 1]);
  const link = tw(f, [56, 103], [0, 1], EASE_IN_OUT);
  return (
    <>
      <ConceptTag opacity={tw(f, [6, 20], [0, 1])} />
      <Titles items={[{ text: "Connectez vos actions.", from: 48 }]} accent={["Connectez"]} />
      <Stage>
        <Img src={staticFile("brand/beemarketing-logo.png")} style={{ position: "absolute", left: 90, top: 300, width: 720, opacity: logo }} />
        <div style={{ position: "absolute", inset: 0, opacity: app, transform: `scale(${appScale})`, transformOrigin: "450px 450px" }}>
          <Card style={{ left: 0, top: 60, width: 900, height: 780, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 250, background: C.surface, padding: "36px 28px", boxSizing: "border-box" }}>
              <Img src={staticFile("brand/beemarketing-symbol.png")} style={{ height: 52, marginBottom: 46 }} />
              {NAV.map((n, i) => {
                const on = n === "Studio" ? studio : 0;
                return (
                  <div key={n} style={{ ...font, fontSize: 26, fontWeight: 600, height: 64, marginBottom: 14, display: "flex", alignItems: "center", paddingLeft: 52, borderRadius: 16, color: on > 0.5 ? C.blue : i === 0 ? C.black : C.grey, background: `rgba(40,81,255,${0.1 * on})` }}>
                    {n}
                  </div>
                );
              })}
            </div>
            <div style={{ position: "absolute", left: 290, top: 40, right: 40 }}>
              <Label>Bonjour Cédric</Label>
              <Strong style={{ fontSize: 34, marginTop: 6 }}>Vos actions, reliées.</Strong>
            </div>
            <svg width={900} height={780} style={{ position: "absolute", left: 0, top: 0 }}>
              <path d="M 820 255 V 635" stroke={C.blue} strokeWidth={4} strokeLinecap="round" fill="none" strokeDasharray={380} strokeDashoffset={380 * (1 - link)} />
            </svg>
            {TILES.map((t, i) => {
              const on = tw(f, [t.at, t.at + 10], [0, 1]);
              const IconC = t.icon;
              return (
                <Card key={t.label} active={on} style={{ left: 290, top: 180 + i * 190, width: 570, height: 150, display: "flex", alignItems: "center", gap: 26, padding: "0 34px", opacity: 0.35 + 0.65 * on }}>
                  <div style={{ width: 82, height: 82, borderRadius: 22, background: C.blueSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconC size={46} />
                  </div>
                  <div>
                    <Strong>{t.label}</Strong>
                    <Label>{t.value}</Label>
                  </div>
                </Card>
              );
            })}
          </Card>
        </div>
        <Marker keys={[[0, cx, cy], [14, cx, 600], [44, cx, 600], [56, 820, 315], [81, 820, 505], [103, 820, 695], [110, 820, 695], [130, MARK_S02_END[0] + 40, MARK_S02_END[1]], [138, ...MARK_S02_END]]} taps={[136]} />
      </Stage>
    </>
  );
};
