import type { Word } from "./slates";

/**
 * Transcription d'une session, quel que soit son export : mots `{text, start, end}` en secondes (ElevenLabs Scribe,
 * Whisper) ou `{text, startMs, endMs}` ; tableau seul ou objet `{words: […]}`. Les espaces et silences sont ignorés.
 */
export function parseTranscript(input: unknown): Word[] {
  const list = Array.isArray(input) ? input : (input as { words?: unknown })?.words;
  if (!Array.isArray(list)) throw new Error("Transcription illisible : une liste de mots avec leurs temps est attendue.");
  const words: Word[] = [];
  for (const w of list as Record<string, unknown>[]) {
    if (!w || typeof w.text !== "string" || !w.text.trim() || w.type === "spacing") continue;
    const startMs = typeof w.startMs === "number" ? w.startMs : typeof w.start === "number" ? w.start * 1000 : NaN;
    const endMs = typeof w.endMs === "number" ? w.endMs : typeof w.end === "number" ? w.end * 1000 : NaN;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) continue;
    words.push({ text: w.text, startMs: Math.round(startMs), endMs: Math.round(endMs) });
  }
  if (!words.length) throw new Error("Transcription vide : aucun mot horodaté.");
  return words.sort((a, b) => a.startMs - b.startMs);
}

/** « 1:02:03.4 », « 2:03.4 » ou « 123.4 » (secondes) → millisecondes ; null si illisible. */
export function parseClock(text: string): number | null {
  const parts = text.trim().replace(",", ".").split(":");
  if (!parts.length || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const s = parts.reduce((acc, p) => acc * 60 + Number(p), 0);
  return Math.round(s * 1000);
}
