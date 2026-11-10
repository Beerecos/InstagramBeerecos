import type { CaptionWord } from "./edit";

/**
 * Le nom de la marque mal transcrit (demande de Cédric, 2026-11-10 : « dans les sous-titres c'est écrit Biroco sauf que
 * c'est BeeRecos »). Correction déterministe des variantes entendues par la transcription : Biroco, Birecos, Beerecos,
 * Bérécos… et « Bee recos » en deux mots. La ponctuation autour du mot est gardée.
 */
export const BRAND = "BeeRecos";
const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ONE = /^b(?:i|ee|e|ie|ea|y)rr?[eo]?[ck]+os?$/;
const FIRST = /^(?:bee|bi|be|b)$/;
const SECOND = /^r[eo]?[ck]+os?$/;

function split(text: string) {
  const m = text.match(/^([«"“'(\s]*)(.*?)([»"”')\s.,!?;:…-]*)$/u);
  return m ? { pre: m[1], core: m[2], post: m[3] } : { pre: "", core: text, post: "" };
}

/** Mots corrigés (mêmes temps) ; « Bee recos » devient un seul mot du début du premier à la fin du second. */
export function fixBrandWords(words: CaptionWord[]): CaptionWord[] {
  const out: CaptionWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const a = split(w.text);
    if (ONE.test(fold(a.core))) { out.push({ ...w, text: `${a.pre}${BRAND}${a.post}` }); continue; }
    const next = words[i + 1];
    if (next && !a.post.trim() && FIRST.test(fold(a.core))) {
      const b = split(next.text);
      if (SECOND.test(fold(b.core))) { out.push({ ...w, text: `${a.pre}${BRAND}${b.post}`, endMs: next.endMs }); i++; continue; }
    }
    out.push(w);
  }
  return out;
}
