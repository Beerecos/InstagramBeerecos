import type React from "react";
import { S02Brand } from "./S02Brand";
import { S03Network } from "./S03Network";
import { S04Value } from "./S04Value";
import { S05School } from "./S05School";
import { S06Digital } from "./S06Digital";
import { S07Pillars } from "./S07Pillars";
import { S08Invite } from "./S08Invite";

export const SCENES: Record<string, React.FC> = {
  s02: S02Brand, s03: S03Network, s04: S04Value, s05: S05School, s06: S06Digital, s07: S07Pillars, s08: S08Invite,
};
