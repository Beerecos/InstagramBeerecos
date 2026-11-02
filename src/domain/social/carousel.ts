import { COLORS } from "./reel-story/brand";
import { FORBIDDEN_PATTERNS } from "./reel-story/facts";

/**
 * Studio de carrousels BeeRecos — modèle de données, formats et contrôles mesurés (pur, testé).
 * Charte 2026 : Poppins seule (Caveat pour la baseline), bleu #2851FF, noir et blanc ; logos officiels jamais redessinés.
 * Design des slides repris des maquettes fournies par Cédric le 2026-10-22 (fond blanc ou bleu, logo officiel, baseline
 * manuscrite sur chaque slide, bulle du mot-clé en fin, carte d'étapes) ; violet et turquoise retirés comme pour les vidéos. Les images restent dans le navigateur (data URL) ; rien n'est envoyé à un serveur.
 */

export type CarouselFormat = { key: "ig34" | "li45" | "sq" | "story"; label: string; width: number; height: number };
/** Dimensions logiques de mise en page (px CSS) ; l'export double la résolution (×2) : 2160 px de large. */
export const FORMATS: CarouselFormat[] = [
  { key: "ig34", label: "IG 3:4", width: 1080, height: 1440 },
  { key: "li45", label: "LI 4:5", width: 1080, height: 1350 },
  { key: "sq", label: "1:1", width: 1080, height: 1080 },
  { key: "story", label: "9:16", width: 1080, height: 1920 },
];
export const EXPORT_SCALE = 2;

export type SlideType = "cover" | "bignum" | "numbered" | "plain" | "card" | "outro";
export const SLIDE_TYPES: { key: SlideType; label: string }[] = [
  { key: "cover", label: "Couverture" }, { key: "bignum", label: "Grand chiffre" }, { key: "numbered", label: "Numérotée" },
  { key: "plain", label: "Libre" }, { key: "card", label: "Carte d'étapes" }, { key: "outro", label: "Fin" },
];

/** Fond sans image : couleurs de la charte uniquement. */
export const BACKGROUNDS = [
  { key: "blue", label: "Bleu", color: COLORS.blue, dark: true },
  { key: "black", label: "Noir", color: "#1A1A1A", dark: true },
  { key: "white", label: "Blanc", color: COLORS.white, dark: false },
] as const;
export type BackgroundKey = (typeof BACKGROUNDS)[number]["key"];
/** Couleurs de texte autorisées selon le fond : bleu, noir et blanc seulement, toujours lisibles sur ce fond. */
export const INK = "#1A1A1A";
export function accentsFor(s: Pick<Slide, "img" | "background">): string[] {
  if (s.img || s.background === "black") return [COLORS.white, COLORS.blue];
  if (s.background === "blue") return [COLORS.white];
  return [COLORS.blue, INK];
}
/** Couleur effectivement utilisée : la couleur choisie si elle est permise sur ce fond, sinon la première permise. */
export const safeColor = (s: Pick<Slide, "img" | "background">, color: string) => (accentsFor(s).includes(color) ? color : accentsFor(s)[0]);

export type Slide = {
  id: string;
  img: string | null; imgScale: number; imgPosX: number; imgPosY: number;
  type: SlideType; textPos: "top" | "center" | "bottom";
  kicker: string; num: string; title: string; body: string;
  /** Signature en bas de chaque slide : la baseline exacte s'affiche avec le fichier officiel manuscrit ; vide = aucune. */
  sig: string;
  bignum: string; bigsuffix: string; toplabel: string;
  /** Carte d'étapes : titre, sous-titre, pastille et étapes cochées (une par ligne). */
  cardTitle: string; cardSub: string; cardPill: string; items: string;
  accent: string; labelColor: string; background: BackgroundKey; scrim: "bottom" | "full" | "none";
};
export type Carousel = { format: CarouselFormat["key"]; keyword: string; caption: string; slides: Slide[] };

export const BASELINE = "#MonReseauCestTonReseau";
/** Seule la baseline exacte est composée en écriture manuscrite Caveat Medium (décision du 2026-10-21). */
export const isBaseline = (text: string) => text.trim() === BASELINE;
/** Baseline mal écrite (espaces, accents, casse, ponctuation) : « #Mon réseau c'est ton réseau. » est signalé. */
export const looksLikeBaseline = (text: string) => !isBaseline(text) && /monr[ée]seauc['’]?estt?onr[ée]seau/i.test(text.normalize("NFC").replace(/[\s.#!]/g, ""));

/**
 * Onglet (cartouche) du surtitre : bleu texte blanc sur fond clair ; blanc texte noir avec accent bleu sur fond bleu,
 * sombre ou photo (le bleu disparaîtrait sur le bleu).
 */
export const tabStyle = (dark: boolean) =>
  dark ? { background: COLORS.white, color: "#000000", accent: COLORS.blue } : { background: COLORS.blue, color: COLORS.white, accent: null };
let seq = 0;
const uid = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newSlide(type: SlideType = "plain", patch: Partial<Slide> = {}): Slide {
  const background: BackgroundKey = type === "cover" ? "blue" : "white";
  const white = background === "white";
  return {
    id: uid(), img: null, imgScale: 100, imgPosX: 50, imgPosY: 50, type, textPos: "top",
    kicker: "", num: "", title: "", body: "", sig: BASELINE, bignum: "", bigsuffix: "", toplabel: "",
    cardTitle: "", cardSub: "", cardPill: "", items: "",
    accent: white ? COLORS.blue : COLORS.white, labelColor: white ? INK : COLORS.white, background, scrim: "bottom", ...patch,
  };
}

/** Carrousel de départ : structure seulement (aucun chiffre ni promesse) ; textes à remplacer. */
export function starterCarousel(): Carousel {
  return {
    format: "ig34", keyword: "CLUB",
    caption: "Commente CLUB pour recevoir le lien de visite.\n\n#BeeRecos #MonReseauCestTonReseau",
    slides: [
      // Maquettes du 2026-10-22 ; textes repris des faits vérifiés (signature de marque, étapes du Reel « Recommandation »).
      newSlide("cover", { title: "Un réseau\nd’affaires\ndigitalisé." }),
      newSlide("card", {
        title: "RÉCIPROQUE.", body: "Le réseau te\nrecommande *aussi.*",
        cardTitle: "Mise en relation", cardSub: "Toi → Le pro", cardPill: "Réciproque", items: "Enregistrée\nQualifiée\nRéciproque",
      }),
      newSlide("outro", { title: "COMMENTE", body: "pour recevoir\n*le lien de visite.*", accent: INK }),
    ],
  };
}

/** Découpe « texte *mot* texte » en segments, le mot entre astérisques étant mis en valeur. */
export function emphasis(text: string): { text: string; em: boolean }[] {
  const out: { text: string; em: boolean }[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), em: false });
    out.push({ text: m[1], em: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), em: false });
  return out;
}

export const isDark = (s: Slide) => Boolean(s.img) || BACKGROUNDS.find((b) => b.key === s.background)?.dark !== false;
const words = (s: string) => s.replace(/[*\n]/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
export const slideText = (s: Slide) => [s.kicker, s.title, s.body, s.toplabel, ...(s.type === "card" ? [s.cardTitle, s.cardSub, s.cardPill, s.items] : []), s.type === "outro" ? s.sig : ""].filter(Boolean).join(" ");
/** Étapes de la carte, une par ligne (lignes vides ignorées), 5 au plus. */
export const cardItems = (s: Pick<Slide, "items">) => s.items.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 5);

export type CarouselCheck = { key: string; label: string; ok: boolean; level: "bloquant" | "à vérifier"; proof: string };

/**
 * Contrôles mesurés avant export (même principe que les Reels : oui / non, preuve à l'appui).
 * Un chiffre n'est pas interdit en soi dans un carrousel, mais il exige une source : signalé « à vérifier ».
 */
export function carouselChecks(c: Carousel): CarouselCheck[] {
  const checks: CarouselCheck[] = [];
  const add = (key: string, label: string, ok: boolean, proof: string, level: CarouselCheck["level"] = "bloquant") => checks.push({ key, label, ok, level, proof });
  const cover = c.slides[0];
  add("slides", "1 à 10 visuels", c.slides.length >= 1 && c.slides.length <= 10, `${c.slides.length} slide(s)`);
  if (cover) add("couverture", "Couverture ≤ 12 mots", words(slideText(cover)) <= 12, `${words(slideText(cover))} mots`);
  const heavy = c.slides.slice(1).map((s, i) => ({ i: i + 2, n: words(slideText(s)) })).filter((x) => x.n > 25);
  add("slides_mots", "Slides ≤ 25 mots", heavy.length === 0, heavy.length ? heavy.map((x) => `slide ${x.i} : ${x.n} mots`).join(", ") : "toutes conformes");
  const empty = c.slides.map((s, i) => ({ i: i + 1, s })).filter(({ s }) => !s.title.trim() && !(s.type === "bignum" && s.bignum.trim()));
  add("titres", "Un titre par slide", empty.length === 0, empty.length ? `sans titre : slide ${empty.map((x) => x.i).join(", ")}` : "conforme");
  const all = [...c.slides.map(slideText), c.caption];
  const misspelt = [...new Set(all.flatMap((t) => [...t.matchAll(/bee\s?recos/gi)].map((m) => m[0])).filter((m) => m !== "BeeRecos" && m !== "BEERECOS"))];
  add("marque", "« BeeRecos » bien écrit", misspelt.length === 0, misspelt.length ? misspelt.join(", ") : "conforme");
  const textual = FORBIDDEN_PATTERNS.filter((f) => !f.re.test("0"));
  const hits = textual.filter((f) => all.some((t) => f.re.test(t.replace(/#\w+/g, ""))));
  add("interdits", "Aucune affirmation interdite", hits.length === 0, hits.length ? hits.map((h) => h.reason).join(" ; ") : "aucune");
  const figures = c.slides.map((s, i) => ({ i: i + 1, t: [slideText(s), s.bignum, s.bigsuffix].join(" ") })).filter((x) => /\d/.test(x.t));
  add("chiffres", "Chiffres sourcés", figures.length === 0, figures.length ? `chiffre en slide ${figures.map((x) => x.i).join(", ")} : source et date exigées (sinon DONNÉE MANQUANTE)` : "aucun chiffre", "à vérifier");
  const kw = c.keyword.trim().toUpperCase();
  const last = c.slides[c.slides.length - 1];
  // La slide de fin affiche le mot-clé dans sa bulle : il suffit qu'elle soit la dernière et qu'un mot-clé soit défini.
  add("cta_fin", "Dernière slide = appel à commenter", Boolean(kw && last && last.type === "outro"), last?.type === "outro" ? `bulle « ${kw || "mot-clé absent"} »` : "la dernière slide n'est pas une slide de fin");
  const badSig = c.slides.map((s, i) => ({ i: i + 1, s })).filter(({ s }) => looksLikeBaseline(s.sig));
  add("baseline", "Baseline exacte #MonReseauCestTonReseau", badSig.length === 0, badSig.length ? `à corriger en slide ${badSig.map((x) => x.i).join(", ")} : une ligne, sans espace, accent ni point` : "conforme");
  add("cta_legende", "Légende avec le mot-clé", Boolean(kw) && new RegExp(`comment\\w*\\s+[«"“]?\\s*${kw}`, "i").test(c.caption), c.caption ? "vérifié dans la légende" : "légende vide");
  return checks;
}

const STORAGE_KEY = "beerecos.carousel.v1";
export function loadDraft(): Carousel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Carousel;
    if (!Array.isArray(c.slides) || !c.slides.length || !FORMATS.some((f) => f.key === c.format)) return null;
    // Ancienne slide de fin « Commente *CLUB* » : le mot-clé est désormais dans la bulle, le titre garde le verbe.
    const kw = (c.keyword ?? "").toUpperCase();
    const outroTitle = (s: Slide) => (s.type === "outro" && kw && new RegExp(`^\\s*commente\\s*\\*?\\s*${kw}\\s*\\*?\\s*$`, "i").test(s.title) ? { title: "COMMENTE" } : {});
    return { ...c, slides: c.slides.map((s) => ({ ...newSlide(s.type), ...s, ...outroTitle(s) })) };
  } catch { return null; }
}
/** Brouillon local. Si le navigateur refuse (images trop lourdes), le texte est gardé sans les images. */
export function saveDraft(c: Carousel): "ok" | "sans-images" | "impossible" {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); return "ok"; } catch { /* quota */ }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...c, slides: c.slides.map((s) => ({ ...s, img: null })) })); return "sans-images"; } catch { return "impossible"; }
}

export const fileName = (i: number) => `beerecos_carrousel_slide_${String(i + 1).padStart(2, "0")}.png`;
