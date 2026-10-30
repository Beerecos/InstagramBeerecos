#!/usr/bin/env node
// Écrit le fichier SRT à partir des sous-titres de config/promo.json (calés sur la voix générée, transcription Whisper).
// Usage : node scripts/srt.mjs [sortie.srt]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config/promo.json"), "utf8"));
const out = resolve(process.argv[2] ?? join(root, "exports/BeeRecos_Promo_60s.srt"));
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = cfg.captions
  .map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text.replace(/\*/g, "")}\n`)
  .join("\n");
writeFileSync(out, srt);
console.log(`→ ${out} (${cfg.captions.length} répliques)`);
