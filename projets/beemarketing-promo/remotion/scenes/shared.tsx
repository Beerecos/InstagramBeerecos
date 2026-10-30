import React from "react";
import { C } from "../config";
import { Avatar, Label, Pill, Strong } from "../ui";

/** Positions partagées entre scènes pour des raccords exacts (coordonnées de scène 900×900). */
export const LIST = { top: 40, height: 470, rowY: [160, 250, 340, 430], rowH: 84 };
export const CAMILLE_ROW_Y = LIST.rowY[1];
export const ACTION_X = 856;

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("");

/** Ligne de contact : nom, origine et prochaine action. */
export const ContactRow: React.FC<{
  name: string; origin: string; action?: string; y: number; highlight?: number; actionOn?: number; style?: React.CSSProperties;
}> = ({ name, origin, action, y, highlight = 0, actionOn = 0, style }) => (
  <div
    style={{
      position: "absolute", left: 0, top: y - LIST.rowH / 2, width: 900, height: LIST.rowH, boxSizing: "border-box",
      display: "flex", alignItems: "center", gap: 18, padding: "0 24px", borderRadius: 20,
      background: C.white, border: `2px solid ${highlight > 0.5 ? C.blue : C.line}`,
      boxShadow: `0 0 0 ${highlight * 6}px rgba(40,81,255,0.12)`, ...style,
    }}
  >
    <Avatar initials={initials(name)} size={54} />
    <Strong style={{ fontSize: 27, width: 250 }}>{name}</Strong>
    <Label style={{ width: 250, fontSize: 22 }}>{origin}</Label>
    {action && (
      <Pill tone={actionOn > 0.5 ? "blue" : "soft"} style={{ marginLeft: "auto", minWidth: 150, justifyContent: "center" }}>
        {action}
      </Pill>
    )}
  </div>
);
