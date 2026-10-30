import type React from "react";
import { S02Reveal } from "./S02Reveal";
import { S03Studio } from "./S03Studio";
import { S04Campaigns } from "./S04Campaigns";
import { S05Followup } from "./S05Followup";
import { S06Invitation } from "./S06Invitation";
import { S07Prepare } from "./S07Prepare";
import { S08Attendance } from "./S08Attendance";
import { S09Benefit } from "./S09Benefit";

export const SCENES: Record<string, React.FC> = {
  s02: S02Reveal, s03: S03Studio, s04: S04Campaigns, s05: S05Followup,
  s06: S06Invitation, s07: S07Prepare, s08: S08Attendance, s09: S09Benefit,
};
