export const BRAND_NAME = "BeeRecos";
export const PRODUCT_NAME = "BeeMarketing";

export type BrandIssue = { index: number; found: string; expected: typeof BRAND_NAME };

// Toute graphie de « beerecos » (insensible à la casse) qui n'est pas exactement « BeeRecos ».
// Les identifiants techniques collés à un autre mot (InstagramBeerecos, beerecos.com, @beerecos) sont ignorés.
const PATTERN = /(?<![\p{L}\p{N}_@./-])bee\s?recos(?![\p{L}\p{N}_]|\.[a-z])/giu;

export function checkBrandSpelling(text: string): BrandIssue[] {
  const issues: BrandIssue[] = [];
  for (const m of text.matchAll(PATTERN)) {
    if (m[0] !== BRAND_NAME) issues.push({ index: m.index ?? 0, found: m[0], expected: BRAND_NAME });
  }
  return issues;
}

export function fixBrandSpelling(text: string): string {
  return text.replace(PATTERN, BRAND_NAME);
}
