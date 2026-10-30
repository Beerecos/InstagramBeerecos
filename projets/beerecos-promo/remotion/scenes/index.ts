import type React from "react";
import { S02Reveal } from "./S02Reveal";
import { S03Club } from "./S03Club";
import { S04Program } from "./S04Program";
import { S05Recommend } from "./S05Recommend";
import { S06Levers } from "./S06Levers";
import { S07Training } from "./S07Training";
import { S08Tools } from "./S08Tools";
import { S09Clubs } from "./S09Clubs";

export const SCENES: Record<string, React.FC> = {
  s02: S02Reveal, s03: S03Club, s04: S04Program, s05: S05Recommend,
  s06: S06Levers, s07: S07Training, s08: S08Tools, s09: S09Clubs,
};
