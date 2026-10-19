import { normalize } from "./text";
import type { BrandMemory, Deliverable } from "./types";

const BRANDS = ["BeeRecos", "BeeMarketing", "BeeSchool", "BeeBot", "BeeLead"] as const;

/** Contrôles déterministes du Brand Guardian : casse des marques et mots interdits de la mémoire de marque. */
export function brandIssues(deliverables: Deliverable[], memory: Pick<BrandMemory, "forbiddenWords">): string[] {
  const issues: string[] = [];
  for (const d of deliverables) {
    const text = `${d.title}\n${d.content}`;
    for (const brand of BRANDS) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}_@./-])${brand.slice(0, 3)}\\s?${brand.slice(3)}(?![\\p{L}\\p{N}_]|\\.[a-z])`, "giu");
      for (const m of text.matchAll(re)) if (m[0] !== brand) issues.push(`« ${d.title} » : « ${m[0]} » doit s'écrire « ${brand} ».`);
    }
    const n = normalize(text);
    for (const w of memory.forbiddenWords) {
      if (w.trim() && n.includes(normalize(w.trim()))) issues.push(`« ${d.title} » contient le mot interdit « ${w} ».`);
    }
  }
  return [...new Set(issues)];
}
