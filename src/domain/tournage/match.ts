/**
 * Association d'un segment ou d'un fichier aux 72 scripts : par numéro annoncé (V12, reel-12-…), sinon par
 * ressemblance de titre. Une proposition n'est jamais présentée comme certaine si deux scripts se ressemblent.
 */
import { plain } from "./slates";

export type CatalogueEntry = { reelId: string; title: string };
export type Match = { reelId: string | null; confidence: "numero" | "titre" | "incertain" | "aucun"; candidates: string[] };

const STOP = new Set(["le", "la", "les", "un", "une", "des", "de", "du", "et", "a", "au", "aux", "en", "ton", "ta", "tes", "ce", "c", "l", "d", "que", "qui", "pour", "est"]);
const bag = (t: string) => new Set(plain(t).split(" ").filter((w) => w.length > 1 && !STOP.has(w)));
export function similarity(a: string, b: string): number {
  const A = bag(a), B = bag(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / (A.size + B.size - common);
}

/** « V7 », « v07 », « reel-07-… » → « V07 » (format des identifiants du catalogue). */
export function reelIdFromText(text: string): string | null {
  const m = /(?:^|[^a-z0-9])(?:v|reel[-_ ]?)0*(\d{1,2})(?![0-9])/i.exec(text.normalize("NFD"));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 99 ? `V${String(n).padStart(2, "0")}` : null;
}

export function matchCatalogue(input: { n?: number; label: string }, catalogue: CatalogueEntry[]): Match {
  const byId = new Map(catalogue.map((c) => [c.reelId, c]));
  const fromNumber = input.n ? `V${String(input.n).padStart(2, "0")}` : reelIdFromText(input.label);
  if (fromNumber && byId.has(fromNumber)) return { reelId: fromNumber, confidence: "numero", candidates: [fromNumber] };
  const ranked = catalogue.map((c) => ({ id: c.reelId, s: similarity(input.label, c.title) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!ranked.length) return { reelId: null, confidence: "aucun", candidates: [] };
  const [best, second] = ranked;
  const close = second && best.s - second.s < 0.15;
  if (best.s < 0.3 || close) return { reelId: null, confidence: "incertain", candidates: ranked.slice(0, 3).map((x) => x.id) };
  return { reelId: best.id, confidence: "titre", candidates: ranked.slice(0, 3).map((x) => x.id) };
}
