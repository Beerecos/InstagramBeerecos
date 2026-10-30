import React from "react";
import { C } from "../config";
import { Card, Label, Strong, font } from "../ui";

/** Ligne surlignée au fil de la voix : carte, pictogramme, titre et précision. */
export const Row: React.FC<{
  top: number; height: number; on: number; title: string; hint?: string; lead: React.ReactNode; left?: number; width?: number; dim?: number;
}> = ({ top, height, on, title, hint, lead, left = 0, width = 900, dim = 0.45 }) => (
  <Card active={on} style={{ left, top, width, height, display: "flex", alignItems: "center", gap: 26, padding: "0 30px", opacity: dim + (1 - dim) * Math.max(on, 0) }}>
    <div style={{ width: 84, height: 84, flex: "none", borderRadius: 24, background: C.blueSoft, display: "flex", alignItems: "center", justifyContent: "center", ...font, color: C.blue, fontSize: 34, fontWeight: 700 }}>
      {lead}
    </div>
    <div style={{ minWidth: 0 }}>
      <Strong style={{ fontSize: 38 }}>{title}</Strong>
      {hint && <Label style={{ fontSize: 26, marginTop: 4, lineHeight: 1.3 }}>{hint}</Label>}
    </div>
  </Card>
);

/** Silhouette de membre (représentation graphique, aucune personne réelle). */
export const Person: React.FC<{ size?: number; color?: string }> = ({ size = 48, color = C.blue }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <circle cx={16} cy={11} r={5} fill="none" stroke={color} strokeWidth={2.4} />
    <path d="M6 27 C6 20 10 18 16 18 C22 18 26 20 26 27" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
  </svg>
);
