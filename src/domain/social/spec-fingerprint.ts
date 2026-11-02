// Repris tel quel de bee-marketing-agent `src/lib/reel-render-client.ts` (fonction pure).
// Le client de rendu (réseau, jeton Supabase) sera porté avec les routes API.
import type { StorySpec } from "./reel-story";

export function specFingerprint(spec: StorySpec): string {
  const { assets: _assets, ...content } = spec;
  void _assets;
  const stable = (v: unknown): string =>
    Array.isArray(v) ? `[${v.map(stable).join(",")}]`
      : v && typeof v === "object" ? `{${Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`
      : JSON.stringify(typeof v === "string" ? v.trim() : v);
  const text = stable(content);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
