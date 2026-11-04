"use client";
/**
 * Une slide de carrousel BeeRecos à taille réelle (1080 × 1350), d'après le carrousel STABILO validé : en-tête
 * « Les InspiBEEz'ness », pagination, logo officiel (bleu sur blanc, blanc sur bleu ou noir), marges de 60 px,
 * Poppins, bleu #2851FF / noir / blanc. Les textes et le logo sont rendus par la mise en page, jamais par une IA.
 */
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { SERIES, SLIDE_H, SLIDE_W, fitSize, type Slide } from "@/domain/instagram/carousel";

const BLUE = "#2851FF", BLACK = "#000000", WHITE = "#FFFFFF", LINE = "#DDE2EA", MUTED = "#667085", SOFT = "#EAEEFF";
const M = 60;

type Theme = "white" | "blue" | "black";
const themeOf = (s: Slide): Theme => (s.layout === "chiffre-bleu" ? "blue" : s.layout === "chiffre-noir" ? "black" : "white");

/** Titre avec le mot « accent » en bleu (ou surligné sur l'affiche). */
function Titled({ title, accent, color, accentColor, highlight }: { title: string; accent: string; color: string; accentColor: string; highlight?: boolean }) {
  const i = accent ? title.toLowerCase().indexOf(accent.toLowerCase()) : -1;
  if (i < 0) return <span style={{ color }}>{title}</span>;
  const mark: CSSProperties = highlight ? { color: accentColor, background: SOFT, padding: "0 14px" } : { color: accentColor };
  return <span style={{ color }}>{title.slice(0, i)}<span style={mark}>{title.slice(i, i + accent.length)}</span>{title.slice(i + accent.length)}</span>;
}

function Photo({ url, style, contain, gray }: { url?: string; style: CSSProperties; contain?: boolean; gray?: boolean }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- rendu exporté en image : balise img nécessaire
  return <img src={url} alt="" crossOrigin="anonymous" style={{ position: "absolute", objectFit: contain ? "contain" : "cover", filter: gray ? "grayscale(1)" : undefined, ...style }} />;
}

type Props = { slide: Slide; index: number; total: number; photos: Record<number, string> };

const CarouselSlide = forwardRef<HTMLDivElement, Props>(function CarouselSlide({ slide: s, index, total, photos }, ref) {
  const theme = themeOf(s);
  const fg = theme === "white" ? BLACK : WHITE;
  const bg = theme === "white" ? WHITE : theme === "blue" ? BLUE : BLACK;
  const p1 = s.photo ? photos[s.photo] : undefined, p2 = s.photo2 ? photos[s.photo2] : undefined;
  const page = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const logo = theme === "white" && s.layout !== "photo-bandeau" ? "/brand/beerecos-logo-horizontal-blue.svg" : "/brand/beerecos-logo-horizontal-white.svg";
  const footerRight = s.layout === "couverture" ? "Son histoire" : s.source;
  const footerColor = s.layout === "couverture" || s.layout === "invitation" ? BLUE : theme === "white" && s.layout !== "photo-bandeau" ? MUTED : "rgba(255,255,255,.85)";
  const abs = (style: CSSProperties, children: ReactNode, key?: string) => <div key={key} style={{ position: "absolute", ...style }}>{children}</div>;
  const body: CSSProperties = { fontSize: 38, lineHeight: 1.35, fontWeight: 400 };

  let content: ReactNode = null;
  switch (s.layout) {
    case "couverture": {
      const size = fitSize(s.title, 180, 22, 110);
      content = <>
        <Photo url={p1} contain style={{ right: -40, bottom: 140, width: 700, height: 820 }} />
        {abs({ left: M, top: 160, right: M, fontSize: size, lineHeight: 1.02, fontWeight: 400 }, <Titled title={s.title} accent={s.accent} color={BLACK} accentColor={BLUE} />)}
        {s.text ? abs({ left: M, bottom: 250, width: 460, ...body }, s.text) : null}
      </>;
      break;
    }
    case "photo-bandeau": {
      // Sans photo : composition typographique (grand bandeau bleu), jamais de cadre vide.
      const top = p1 ? 830 : 400;
      content = <>
        <Photo url={p1} style={{ left: 0, top: 140, width: SLIDE_W, height: 690 }} />
        {abs({ left: 0, top, width: SLIDE_W, bottom: 0, background: BLUE }, null)}
        {abs({ left: M, right: M, top: top + 40, fontSize: fitSize(s.title, p1 ? 96 : 130, 24, 64), lineHeight: 1.12, color: WHITE }, <Titled title={s.title} accent={s.accent} color={WHITE} accentColor={WHITE} />)}
        {s.text ? abs({ left: M, right: M, top: p1 ? 1090 : 900, ...body, color: WHITE }, s.text) : null}
      </>;
      break;
    }
    case "affiche":
      content = <>
        <Photo url={p1} contain style={{ right: -60, top: 560, width: 560, height: 640 }} />
        {abs({ left: M, right: M, top: 160, fontSize: fitSize(s.title, 150, 16, 90), lineHeight: 1.18 }, <Titled title={s.title} accent={s.accent} color={BLACK} accentColor={BLUE} highlight />)}
        {s.text ? abs({ left: M, bottom: 250, width: 460, ...body }, s.text) : null}
      </>;
      break;
    case "date":
      content = <>
        {abs({ left: M - 10, right: M, top: 140, fontSize: fitSize(s.number, 440, 4, 220), lineHeight: 1, color: BLUE, letterSpacing: -8 }, s.number)}
        <Photo url={p1} contain style={{ left: M, right: M, top: 620, height: 260, width: SLIDE_W - 2 * M }} />
        {abs({ left: M, top: 920, width: 520, fontSize: fitSize(s.title, 96, 14, 64), lineHeight: 1.1 }, <Titled title={s.title} accent={s.accent} color={BLACK} accentColor={BLUE} />)}
        {s.text ? abs({ left: 620, top: 930, right: M, fontSize: 34, lineHeight: 1.35 }, s.text) : null}
      </>;
      break;
    case "chiffre-bleu":
    case "chiffre-noir": {
      const blue = s.layout === "chiffre-bleu";
      content = <>
        {s.prefix ? abs({ left: M, top: 170, fontSize: 44, color: WHITE }, s.prefix) : null}
        {abs({ left: M - 10, right: M, top: 230, fontSize: fitSize(s.number, blue ? 380 : 620, blue ? 5 : 2, 200), lineHeight: 1, color: blue ? WHITE : BLUE, textAlign: blue ? "left" : "right", letterSpacing: -6 }, s.number)}
        {abs({ left: M, right: M, top: blue ? 680 : 900, fontSize: fitSize(s.title, blue ? 120 : 170, blue ? 16 : 9, 72), lineHeight: 1.05, color: WHITE }, <Titled title={s.title} accent={s.accent} color={WHITE} accentColor={blue ? WHITE : BLUE} />)}
        {s.text ? abs({ left: M, right: M, top: blue ? 1030 : 1140, ...body, color: WHITE }, s.text) : null}
      </>;
      break;
    }
    case "deux-photos":
      content = <>
        {abs({ left: M, right: M, top: 150, fontSize: fitSize(s.title, 110, 20, 72), lineHeight: 1.12 }, <Titled title={s.title} accent={s.accent} color={BLACK} accentColor={BLUE} />)}
        <Photo url={p1} style={{ left: 0, top: 480, width: 460, height: 640 }} />
        <Photo url={p2} contain style={{ left: 480, top: 450, width: 600, height: 700 }} />
        {p1 || p2 ? <>
          {s.label ? abs({ left: M, top: 1150, fontSize: 34, fontWeight: 500, color: BLUE, textTransform: "uppercase" }, s.label) : null}
          {s.label2 ? abs({ right: M, top: 1150, fontSize: 34, fontWeight: 500, color: BLUE, textTransform: "uppercase", textAlign: "right" }, s.label2) : null}
        </> : <>
          {/* Sans photo : les deux étiquettes deviennent la composition (dates en grand). */}
          {s.label ? abs({ left: M, right: M, top: 560, fontSize: fitSize(s.label, 96, 14, 56), lineHeight: 1.1, color: BLUE, borderTop: `2px solid ${LINE}`, paddingTop: 30 }, s.label) : null}
          {s.label2 ? abs({ left: M, right: M, top: 820, fontSize: fitSize(s.label2, 96, 14, 56), lineHeight: 1.1, color: BLACK, borderTop: `2px solid ${LINE}`, paddingTop: 30 }, s.label2) : null}
        </>}
      </>;
      break;
    case "invitation":
      content = <>
        <Photo url={p1} gray style={{ left: 0, top: 140, width: SLIDE_W, height: 340 }} />
        {abs({ left: M, right: M, top: p1 ? 520 : 200, fontSize: 56, lineHeight: 1.25 }, s.title)}
        {abs({ left: M, top: p1 ? 790 : 470, fontSize: 44 }, s.prefix)}
        {abs({ left: M - 10, right: M, top: p1 ? 850 : 540, fontSize: fitSize(`« ${s.number} »`, 230, 9, 140), lineHeight: 1, color: BLUE, fontWeight: 400, whiteSpace: "nowrap", letterSpacing: -4 }, `« ${s.number} »`)}
        {abs({ left: M, right: M, top: p1 ? 1120 : 840, fontSize: 40, lineHeight: 1.35 }, s.text)}
      </>;
      break;
  }

  return (
    <div ref={ref} data-testid="carousel-slide" style={{ position: "relative", width: SLIDE_W, height: SLIDE_H, overflow: "hidden", background: bg, color: fg, textAlign: "left", fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
      {content}
      {/* Repères communs : en-tête de série, pagination, filet. */}
      {abs({ left: M, top: 52, fontSize: 30, color: fg }, SERIES)}
      {abs({ right: M, top: 56, fontSize: 26, fontWeight: 500, color: fg }, page)}
      {abs({ left: M, right: M, top: 108, height: 2, background: theme === "white" ? LINE : "rgba(255,255,255,.25)" }, null)}
      {/* eslint-disable-next-line @next/next/no-img-element -- logo officiel intact, proportions conservées */}
      <img src={logo} alt="BeeRecos" style={{ position: "absolute", left: M, bottom: 44, width: 240, height: "auto" }} />
      {footerRight ? abs({ right: M, bottom: 58, fontSize: s.layout === "invitation" ? 30 : 24, fontWeight: 500, color: footerColor, textTransform: s.layout === "invitation" || s.layout === "couverture" ? "none" : "uppercase", letterSpacing: 1 }, footerRight) : null}
    </div>
  );
});

export default CarouselSlide;
