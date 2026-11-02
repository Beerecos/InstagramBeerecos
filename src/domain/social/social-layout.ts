// Moteur de composition (Lot b) — PUR, testable. Compose un slide en une IMAGE FINALE (SVG) :
// fond (photo réelle/IA assombrie ou dégradé bleu nuit) + textes (headline mot-clé en bleu, listes à
// icônes, pilule CTA) + LOGOS GRAVÉS dans leurs slots (depuis la bibliothèque de logos) + tagline
// manuscrite. La rasterisation SVG→PNG se fait côté navigateur (svg-raster.ts). Direction artistique
// = maquette validée (bleu nuit, texte blanc, accent bleu électrique). §55 : ici on GRAVE réellement
// textes/logos par-dessus le fond (couche RENDU) — le fond, lui, ne contient jamais de texte/logo.

import type { ComposedSlide } from "./social-publication";
import type { StyleMemory } from "./social-templates";
import { ICONS, iconForText, iconForRole, type IconName } from "./social-icons";

export type SlideAspect = "4:5" | "1:1" | "9:16";
export type ResolvedLogo = { slot: string; href: string };
export type RenderOptions = {
  aspect?: SlideAspect;
  memory: StyleMemory;
  logos?: ResolvedLogo[];       // logos résolus (href signé) à graver
  backgroundHref?: string | null; // URL/dataURL du fond (média réel ou fond IA) ; sinon dégradé
};

// Dimensions de base par aspect (le HD/UHD est géré à la rasterisation par mise à l'échelle).
export const ASPECT_DIMS: Record<SlideAspect, { w: number; h: number }> = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
};

// Normalise une clé de ratio d'export vers un aspect de rendu.
export function toAspect(ratio: string): SlideAspect {
  if (ratio.startsWith("9:16")) return "9:16";
  if (ratio.startsWith("1:1")) return "1:1";
  return "4:5";
}

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));
}

// Découpe gloutonne d'un texte en lignes d'au plus `maxChars` caractères (coupe aux espaces).
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function ov(slide: ComposedSlide, role: string): string | undefined {
  return slide.overlay.find((o) => o.role === role)?.text;
}

// Rend une icône (groupe SVG) à (x,y) mise à l'échelle `size`, couleur `color`.
function icon(name: IconName, x: number, y: number, size: number, color: string): string {
  const s = size / 24;
  return `<g transform="translate(${r(x)},${r(y)}) scale(${s.toFixed(4)})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;
}

const r = (n: number) => Math.round(n * 100) / 100;

// Une ligne de headline avec le mot-clé (`accent`) coloré en bleu (première occurrence).
function headlineLine(line: string, x: number, y: number, size: number, white: string, accent: string, accentWord?: string): string {
  const base = `x="${r(x)}" y="${r(y)}" font-family="Poppins, ui-sans-serif, system-ui, sans-serif" font-weight="800" font-size="${r(size)}" fill="${white}" letter-spacing="-0.5"`;
  if (accentWord) {
    const idx = line.toLowerCase().indexOf(accentWord.toLowerCase());
    if (idx >= 0) {
      const before = line.slice(0, idx), match = line.slice(idx, idx + accentWord.length), after = line.slice(idx + accentWord.length);
      return `<text ${base}>${escapeXml(before)}<tspan fill="${accent}">${escapeXml(match)}</tspan>${escapeXml(after)}</text>`;
    }
  }
  return `<text ${base}>${escapeXml(line)}</text>`;
}

/**
 * Compose un slide en une image finale (chaîne SVG autonome). Déterministe.
 */
export function renderSlideSvg(slide: ComposedSlide, opts: RenderOptions): string {
  const aspect = opts.aspect ?? toAspect(slide.ratio);
  const { w, h } = ASPECT_DIMS[aspect];
  const scale = w / 1080;
  const pad = Math.round(72 * scale);
  const navy = "#0d1b2a";
  const white = opts.memory.palette.white || "#FFFFFF";
  const blue = opts.memory.palette.primary || "#2851FF";

  // -------- Fond
  const layers: string[] = [];
  layers.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="${navy}"/>`);
  if (opts.backgroundHref) {
    layers.push(`<image href="${escapeXml(opts.backgroundHref)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`);
  } else {
    layers.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="url(#bgGrad)"/>`);
  }
  // Voile d'assombrissement pour la lisibilité (plus dense en bas).
  layers.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="url(#darken)"/>`);

  // -------- Logos gravés (rangée en haut à gauche ; logo_beerecos en premier)
  const logos = (opts.logos ?? []).filter((l) => l.href);
  const ordered = [...logos].sort((a, b) => (a.slot === "logo_beerecos" ? -1 : b.slot === "logo_beerecos" ? 1 : 0));
  const logoH = Math.round(66 * scale), logoBoxW = Math.round(150 * scale), gap = Math.round(24 * scale);
  ordered.slice(0, 3).forEach((l, i) => {
    const lx = pad + i * (logoBoxW + gap);
    layers.push(`<image href="${escapeXml(l.href)}" x="${lx}" y="${pad}" width="${logoBoxW}" height="${logoH}" preserveAspectRatio="xMinYMid meet"/>`);
  });

  // -------- Contenu (ancré en bas)
  const kicker = ov(slide, "label") || ov(slide, "zone");
  const accentWord = ov(slide, "accent");
  const cta = ov(slide, "cta");
  const link = ov(slide, "link");
  const baseline = ov(slide, "baseline");
  const tagline = ov(slide, "tagline_manuscrite");

  // Lignes d'info (date/heure/lieu) si présentes, sinon liste/paragraphe des `lines`.
  // On écarte les lignes qui redoublent le CTA/lien (gravés en pilule) ou la baseline/tagline.
  const infoRoles = ["date", "time", "location"] as const;
  const infoRows = slide.overlay.filter((o) => (infoRoles as readonly string[]).includes(o.role) && o.text.trim());
  const bodyLines = slide.lines.filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (tagline && t === tagline) return false;
    if (baseline && t === baseline) return false;
    if (cta && t.includes(cta)) return false;
    if (link && t.includes(link)) return false;
    return true;
  });
  const isList = infoRows.length === 0 && ["pourquoi", "reseau", "benefices"].includes(slide.role) && bodyLines.length >= 2;

  const headlineSize = Math.round((slide.headline.length > 42 ? 62 : 78) * scale);
  const headMax = Math.max(10, Math.floor((w - 2 * pad) / (headlineSize * 0.56)));
  const headLines = wrapText(slide.headline, headMax);
  const bodySize = Math.round(34 * scale), bodyLH = Math.round(56 * scale), iconSz = Math.round(30 * scale);
  const kickSize = Math.round(30 * scale);

  // Hauteurs des blocs pour l'ancrage bas.
  const gapBlock = Math.round(28 * scale);
  let contentH = 0;
  if (kicker) contentH += kickSize + Math.round(16 * scale);
  contentH += headLines.length * Math.round(headlineSize * 1.08);
  const rowsCount = infoRows.length || (isList ? bodyLines.length : 0);
  if (rowsCount) contentH += gapBlock + rowsCount * bodyLH;
  const paraLines = (!infoRows.length && !isList) ? bodyLines.flatMap((l) => wrapText(l, Math.floor((w - 2 * pad) / (bodySize * 0.54)))) : [];
  if (paraLines.length) contentH += gapBlock + paraLines.length * Math.round(bodySize * 1.4);
  if (baseline) contentH += gapBlock + Math.round(42 * scale);
  const ctaH = Math.round(84 * scale);
  if (cta) contentH += gapBlock + ctaH;
  const tagSize = Math.round(46 * scale);
  if (tagline) contentH += gapBlock + Math.round(tagSize * 1.2);

  const headerBottom = pad + logoH + Math.round(40 * scale);
  let y = Math.max(headerBottom + contentH, h - pad); // baseline du bas du bloc
  y = Math.min(y, h - pad);
  let cursor = y - contentH; // haut du bloc

  const parts: string[] = [];
  if (kicker) {
    cursor += kickSize;
    parts.push(`<text x="${pad}" y="${r(cursor)}" font-family="Poppins, sans-serif" font-weight="600" font-size="${kickSize}" fill="${blue}" letter-spacing="1.5">${escapeXml(kicker.toUpperCase())}</text>`);
    cursor += Math.round(16 * scale);
  }
  for (const hl of headLines) {
    cursor += Math.round(headlineSize * 0.86);
    parts.push(headlineLine(hl, pad, cursor, headlineSize, white, blue, accentWord));
    cursor += Math.round(headlineSize * 0.22);
  }
  if (infoRows.length) {
    cursor += gapBlock;
    for (const row of infoRows) {
      const ic = iconForRole(row.role) ?? "dot";
      parts.push(icon(ic, pad, cursor - iconSz * 0.8, iconSz, blue));
      parts.push(`<text x="${pad + iconSz + Math.round(18 * scale)}" y="${r(cursor)}" font-family="Poppins, sans-serif" font-weight="500" font-size="${bodySize}" fill="${white}">${escapeXml(row.text)}</text>`);
      cursor += bodyLH;
    }
  } else if (isList) {
    cursor += gapBlock;
    for (const line of bodyLines) {
      parts.push(icon(iconForText(line), pad, cursor - iconSz * 0.8, iconSz, blue));
      parts.push(`<text x="${pad + iconSz + Math.round(18 * scale)}" y="${r(cursor)}" font-family="Poppins, sans-serif" font-weight="500" font-size="${bodySize}" fill="${white}">${escapeXml(line)}</text>`);
      cursor += bodyLH;
    }
  } else if (paraLines.length) {
    cursor += gapBlock;
    for (const line of paraLines) {
      cursor += Math.round(bodySize * 0.9);
      parts.push(`<text x="${pad}" y="${r(cursor)}" font-family="Poppins, sans-serif" font-weight="400" font-size="${bodySize}" fill="${white}" opacity="0.92">${escapeXml(line)}</text>`);
      cursor += Math.round(bodySize * 0.5);
    }
  }
  if (baseline) {
    cursor += gapBlock + Math.round(30 * scale);
    parts.push(`<text x="${pad}" y="${r(cursor)}" font-family="Poppins, sans-serif" font-weight="700" font-size="${Math.round(40 * scale)}" fill="${blue}">${escapeXml(baseline)}</text>`);
    cursor += Math.round(12 * scale);
  }
  if (cta) {
    cursor += gapBlock;
    const ctaFont = Math.round(30 * scale);
    const label = cta.toUpperCase();
    const pillW = Math.round(label.length * ctaFont * 0.62 + 120 * scale);
    const arrowX = pad + pillW - Math.round(52 * scale);
    parts.push(`<rect x="${pad}" y="${r(cursor)}" width="${pillW}" height="${ctaH}" rx="${Math.round(ctaH / 2)}" fill="${blue}"/>`);
    parts.push(`<text x="${pad + Math.round(34 * scale)}" y="${r(cursor + ctaH * 0.63)}" font-family="Poppins, sans-serif" font-weight="700" font-size="${ctaFont}" fill="${white}" letter-spacing="0.5">${escapeXml(label)}</text>`);
    parts.push(icon("arrow", arrowX, cursor + ctaH / 2 - iconSz / 2, iconSz, white));
    cursor += ctaH;
  }
  if (tagline) {
    cursor += gapBlock + Math.round(tagSize * 0.7);
    parts.push(`<text x="${pad}" y="${r(cursor)}" font-family="Poppins, sans-serif" font-weight="300" font-size="${tagSize}" fill="${white}" opacity="0.95">${escapeXml(tagline)}</text>`);
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<defs>`,
    `<linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16233a"/><stop offset="1" stop-color="#0b1626"/></linearGradient>`,
    `<linearGradient id="darken" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${navy}" stop-opacity="0.30"/><stop offset="0.55" stop-color="${navy}" stop-opacity="0.55"/><stop offset="1" stop-color="${navy}" stop-opacity="0.94"/></linearGradient>`,
    `</defs>`,
    ...layers,
    ...parts,
    `</svg>`,
  ].join("");
}
