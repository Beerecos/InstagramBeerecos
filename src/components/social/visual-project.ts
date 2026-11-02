import { FORMATS, type Carousel } from "@/domain/social/carousel";

export function restoreVisual(value: unknown): Carousel {
  if (!value || typeof value !== "object") throw new Error("Composition visuelle absente.");
  const c = value as Carousel & { aspect?: Carousel["format"] };
  const format = c.aspect ?? c.format;
  if (!FORMATS.some((f) => f.key === format) || !Array.isArray(c.slides) || c.slides.length < 1 || c.slides.length > 10 ||
      c.slides.some((s) => !s || typeof s.id !== "string" || typeof s.title !== "string")) {
    throw new Error("Cette composition nécessite son éditeur métier d’origine.");
  }
  return { format, keyword: c.keyword ?? "", caption: c.caption ?? "", slides: c.slides };
}


/** The resume target is separate from the board filter and the source channel. */
export function visualPostChannel(value: string | null): "instagram" | "linkedin" | undefined {
  return value === "instagram" || value === "linkedin" ? value : undefined;
}
