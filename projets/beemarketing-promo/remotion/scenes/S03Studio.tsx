import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CFG } from "../config";
import { Button, Card, Check, ConceptTag, EASE_IN_OUT, Icon, Label, Marker, Pill, Stage, Strong, Titles, font, tw } from "../ui";
import { MARK_S02_END } from "./S02Reveal";

/** Scène 3 — Studio : trois entrées, l'éditeur, l'ajustement du titre et la validation humaine. */
const ENTRIES = [
  { label: "Réel filmé", hint: "Importer un tournage", icon: Icon.Camera, at: 10 },
  { label: "Vidéo IA", hint: "Sans tournage", icon: Icon.Sparkle, at: 38 },
  { label: "Carrousel", hint: "Slides à faire défiler", icon: Icon.Layers, at: 66 },
];
const CARD = { x: 0, y: 190, w: 270, h: 400, gap: 45 };
const EDITOR = { x: 0, y: 40, w: 900, h: 820 };
const TAP_ENTRY = 88;
const TAP_VALIDATE = 142;

const lerpRect = (p: number, a: typeof EDITOR, b: typeof EDITOR) => ({
  x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p,
});

export const S03Studio: React.FC = () => {
  const f = useCurrentFrame();
  const { titleBefore, titleAfter } = CFG.demo.content;
  const open = tw(f, [92, 114], [0, 1], EASE_IN_OUT);
  const close = tw(f, [190, 220], [0, 1], EASE_IN_OUT);
  const inner = tw(f, [108, 120], [0, 1]);
  const rect = lerpRect(open, { x: CARD.x, y: CARD.y, w: CARD.w, h: CARD.h }, EDITOR);
  const cardsOut = tw(f, [90, 104], [1, 0]);
  // Ajustement du titre : effacement puis frappe de la nouvelle version.
  const del = Math.round(tw(f, [118, 126], [titleBefore.length, 0], (x) => x));
  const typed = Math.round(tw(f, [127, 139], [0, titleAfter.length], (x) => x));
  const title = f < 127 ? titleBefore.slice(0, del) : titleAfter.slice(0, typed);
  const caret = f >= 114 && f < 142 && Math.floor(f / 8) % 2 === 0;
  const valid = tw(f, [TAP_VALIDATE + 2, TAP_VALIDATE + 12], [0, 1]);
  const btnX = 640;
  const btnY = 700;
  return (
    <>
      <ConceptTag />
      <Titles items={[{ text: "Créez. Ajustez. Validez.", from: 0 }]} accent={["Validez"]} />
      <Stage>
        <Label style={{ position: "absolute", left: 0, top: 120, fontSize: 26, opacity: cardsOut * tw(f, [0, 10], [0, 1]) }}>Studio · Nouveau contenu</Label>
        {ENTRIES.map((e, i) => {
          const a = tw(f, [i * 5, i * 5 + 14], [0, 1]);
          const on = tw(f, [e.at, e.at + 8], [0, 1]) * (i === 0 ? 1 : tw(f, [e.at + 22, e.at + 30], [1, 0.25]));
          const IconC = e.icon;
          if (i === 0 && f >= 92) return null;
          return (
            <Card key={e.label} active={on} style={{ left: CARD.x + i * (CARD.w + CARD.gap), top: CARD.y, width: CARD.w, height: CARD.h, padding: 30, opacity: a * (i === 0 ? 1 : cardsOut), transform: `translateY(${(1 - a) * 30}px)` }}>
              <div style={{ width: 96, height: 96, borderRadius: 26, background: C.blueSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 150 }}>
                <IconC size={54} />
              </div>
              <Strong style={{ fontSize: 34 }}>{e.label}</Strong>
              <Label style={{ marginTop: 6 }}>{e.hint}</Label>
            </Card>
          );
        })}
        {f >= 92 && (
          <Card active={close > 0 ? 0 : 0.5} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: "hidden", opacity: 1 - tw(f, [222, 234], [0, 1]), transform: `scale(${1 - 0.8 * close})`, transformOrigin: `${450 - rect.x}px ${450 - rect.y}px` }}>
            <div style={{ position: "absolute", inset: 0, opacity: inner }}>
              <Label style={{ position: "absolute", left: 40, top: 36 }}>Aperçu</Label>
              <div style={{ position: "absolute", left: 40, top: 86, width: 300, height: 533, borderRadius: 32, background: C.blue, padding: 28, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ ...font, color: C.white, fontSize: 36, fontWeight: 600, lineHeight: 1.15 }}>{title || " "}</div>
                <div style={{ ...font, color: "rgba(255,255,255,0.75)", fontSize: 20, marginTop: 14 }}>Réel · 0:42</div>
              </div>
              <div style={{ position: "absolute", left: 380, top: 36, right: 40 }}>
                <Label>Réel filmé</Label>
                <Strong style={{ marginTop: 4 }}>Visite d'un club</Strong>
                <Label style={{ marginTop: 34 }}>Titre</Label>
                <div style={{ marginTop: 10, height: 120, borderRadius: 18, border: `2px solid ${f >= 114 && f < 142 ? C.blue : C.line}`, padding: "0 22px", display: "flex", alignItems: "center", ...font, fontSize: 30, fontWeight: 500, color: C.black }}>
                  {title}
                  <span style={{ display: "inline-block", width: 3, height: 38, marginLeft: 3, background: caret ? C.blue : "transparent" }} />
                </div>
                <div style={{ marginTop: 26, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Pill tone="grey">Rush importé</Pill>
                  <Pill tone="grey">Sous-titres</Pill>
                  <Pill tone="grey">9:16</Pill>
                </div>
                <Label style={{ marginTop: 40 }}>Validation humaine</Label>
              </div>
              <Button variant="ghost" style={{ left: 380, top: btnY, width: 240 }}>Autre version</Button>
              <Button pressed={tw(f, [TAP_VALIDATE - 3, TAP_VALIDATE], [0, 1]) * (1 - tw(f, [TAP_VALIDATE, TAP_VALIDATE + 5], [0, 1]))} style={{ left: btnX, top: btnY, width: 220, background: valid > 0.5 ? "#13867F" : C.blue }}>
                {valid > 0.5 ? <><Check size={30} color="#ffffff" mark="#13867F" progress={valid} /> Validé</> : "Valider"}
              </Button>
            </div>
          </Card>
        )}
        <Marker
          keys={[[0, ...MARK_S02_END], [12, 135, 460], [36, 450, 460], [62, 765, 460], [78, 765, 460], [86, 135, 460], [112, 135, 460], [118, 620, 300], [130, 620, 300], [140, btnX + 196, EDITOR.y + btnY + 40], [148, btnX + 196, EDITOR.y + btnY + 40], [160, btnX + 110, EDITOR.y + btnY + 120], [190, btnX + 110, EDITOR.y + btnY + 120], [220, 450, 450]]}
          taps={[TAP_ENTRY, TAP_VALIDATE]}
        />
      </Stage>
    </>
  );
};
