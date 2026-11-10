import type { CaptionWord } from "./edit";
import type { Scene } from "./scenes";
import { checkTimeline, MIN_GAP_MS, type CustomAnimation } from "./suggest";
import { STANDARD_TEMPLATE, type AnimationTemplate } from "./template";
import { wordProps, type Look } from "./bee-styles";

/**
 * DYNAMIQUE « BEERECOS STANDARD V1 » (validée par Cédric le 2026-11-04) : toutes les vidéos suivent le même déroulé,
 * avec les mêmes 6 animations et les mêmes réglages. 100 % déterministe : tout texte vient de ce qui est dit (transcript),
 * un chiffre n'apparaît que s'il est prononcé, le mot-clé n'est repris que s'il est celui du Reel (actif dans le moteur
 * de DM). Le résultat est un brouillon : rien n'est rendu sans l'aperçu validé.
 */
export const STANDARD_V1 = {
  id: "standard-v1",
  /** Seules animations posées automatiquement (les autres restent disponibles à la main). */
  animations: ["titre-derriere", "onglet", "chiffre", "liste", "mot-cle", "logo-fin"] as const,
  overlayMs: 2500,
  ctaMs: 3000,
  closingMs: 2000,
  /** Écart minimal entre deux débuts d'animation. */
  minSpacingMs: 4000,
  /** Deux grands mots derrière la personne au plus (accroche et « à retenir »), jamais à la suite. */
  maxBehind: 2,
  hook: { position: "haut", couleur: "blanc", entree: "rebond" },
  takeaway: { position: "milieu", couleur: "bleu", entree: "verticale" },
  onglet: { variante: "blanc" },
} as const;

type Opts = {
  /** Fin de la vidéo (temps de la bande). */
  endMs: number;
  /** Mot-clé du Reel lié, seulement s'il est actif dans le moteur de DM. */
  keyword?: string | null;
  /** Détourage disponible à cet instant (sinon le grand mot passe en onglet). */
  matteAt?: (ms: number) => string | null;
  /** Mots gardés au montage (temps de chaque mot) : pour caler une animation sur le mot fort prononcé. */
  words?: CaptionWord[];
  /** « Mon modèle » de Cédric (template.ts) ; sans lui, le Standard BeeRecos v1. */
  template?: AnimationTemplate;
  /** BeeStyle (bee-styles.ts) : animations de l'accroche, des idées et du mot « à retenir » ; sans lui, des onglets. */
  look?: Look;
  /** Nom affiché dans les libellés (« Bee Dynamic · accroche ») ; sans lui, le nom du modèle. */
  styleName?: string;
};

/** Mots forts BeeRecos (sans accents) : ils passent avant tout autre mot de la phrase. */
const STRONG = new Set(["reseau", "reseaux", "recommandation", "recommandations", "recommander", "recommande", "business", "confiance",
  "club", "clubs", "client", "clients", "contacts", "message", "clair", "precision", "metier", "activite", "formation", "digitalisation",
  "invitation", "visite", "adhesion", "entrepreneurs", "opportunites", "ia"]);
/** Mots outils jamais affichés seuls. */
const STOP = new Set(["avec", "dans", "pour", "mais", "donc", "alors", "comme", "quand", "quoi", "quel", "quelle", "quelles", "quels", "cette",
  "ceci", "cela", "leur", "leurs", "notre", "votre", "vous", "nous", "elle", "elles", "sont", "etre", "avoir", "fait", "faire", "peut", "tout",
  "tous", "toute", "plus", "moins", "tres", "bien", "vraiment", "aussi", "encore", "deja", "peut-etre", "prochaine", "fois", "imagine", "sauras",
  "savent", "savent-ils", "connais", "connaissent", "explique", "demande", "presentes", "quelqu'un", "d'autre", "d'une", "qu'il"]);

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clean = (w: string) => w.replace(/[^\p{L}\p{N}%€'’-]/gu, "");
const wordsOf = (t: string) => t.split(/\s+/).map(clean).filter(Boolean);

type Timed = { text: string; key: string; startMs: number };
/** Mots de la scène avec leur temps (sinon les mots pivots seuls). */
function timedWords(scene: Scene, words?: CaptionWord[]): Timed[] {
  const src = words?.length ? words.filter((w) => w.startMs >= scene.startMs && w.startMs < scene.endMs) : scene.pivotWords.map((p) => ({ text: p.word, startMs: p.startMs, endMs: p.startMs }));
  return src.map((w) => ({ text: clean(w.text.trim()), key: fold(clean(w.text.trim())), startMs: w.startMs })).filter((w) => w.text);
}

/**
 * Mot fort de la scène, toujours un mot DIT : d'abord les mots BeeRecos (deux s'ils se suivent : « MESSAGE CLAIR »),
 * sinon le mot porteur le plus long (hors mots outils). Calé sur l'instant où il est prononcé.
 */
function strongWords(scene: Scene, words?: CaptionWord[]): { text: string; atMs: number } | null {
  const tw = timedWords(scene, words);
  const strongAt = tw.findIndex((w) => STRONG.has(w.key));
  if (strongAt >= 0) {
    const next = tw.slice(strongAt + 1, strongAt + 4).find((w) => STRONG.has(w.key));
    const text = next ? `${tw[strongAt].text} ${next.text}` : tw[strongAt].text;
    return { text: text.toUpperCase(), atMs: tw[strongAt].startMs };
  }
  const content = tw.filter((w) => w.key.length >= 5 && !STOP.has(w.key) && !/\d/.test(w.key));
  if (!content.length) return null;
  const best = content.reduce((a, b) => (b.key.length > a.key.length ? b : a));
  return { text: best.text.toUpperCase(), atMs: best.startMs };
}

const UNITS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11,
  douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };
/** Nombre dit en toutes lettres (« cinq cents », « deux mille ») : valeur et nombre de mots lus, sinon null. */
function numberWords(tokens: string[]): { value: number; used: number } | null {
  let total = 0, current = 0, used = 0;
  for (const t of tokens) {
    if (t in UNITS) current += UNITS[t];
    else if (t === "cent" || t === "cents") current = (current || 1) * 100;
    else if (t === "mille") { total += (current || 1) * 1000; current = 0; }
    else if (t !== "et") break;
    used++;
  }
  const value = total + current;
  // « un » ou « une » seuls sont des articles, pas des chiffres à montrer.
  return used && value >= 2 ? { value, used } : null;
}

/** Chiffre prononcé (en chiffres ou en lettres) et les mots qui le suivent (légende reprise mot pour mot). */
function spokenFigure(scene: Scene, words?: CaptionWord[]): { valeur: number; apres: string; legende: string; atMs: number } | null {
  const tw = timedWords(scene, words);
  const legendAfter = (i: number) => {
    const rest: string[] = [];
    for (const w of tw.slice(i)) { rest.push(w.text); if (/[.!?…,]$/.test(w.text) || rest.length === 4) break; }
    return rest.join(" ").replace(/[.!?…,]+$/, "");
  };
  for (let i = 0; i < tw.length; i++) {
    const digits = /^(\d+(?:[.,]\d+)?)(%|€)?$/.exec(tw[i].text.replace(/[.,]$/, ""));
    if (digits) {
      const legende = legendAfter(i + 1);
      if (legende) return { valeur: Number(digits[1].replace(",", ".")), apres: digits[2] ?? "", legende, atMs: tw[i].startMs };
    }
    const n = numberWords(tw.slice(i).map((w) => w.key.replace(/[.,!?…]$/, "")));
    if (n) {
      const legende = legendAfter(i + n.used);
      if (legende) return { valeur: n.value, apres: "", legende, atMs: tw[i].startMs };
    }
  }
  if (!words?.length) {
    const m = /(\d[\d\s]*(?:[.,]\d+)?)\s*(%|€)?\s*([^.!?…]*)/.exec(scene.text);
    const valeur = m ? Number(m[1].replace(/\s/g, "").replace(",", ".")) : NaN;
    const legende = m ? wordsOf(m[3]).slice(0, 4).join(" ") : "";
    if (m && Number.isFinite(valeur) && legende) return { valeur, apres: m[2] ?? "", legende, atMs: scene.startMs };
  }
  return null;
}

/** Étapes dites (« d'abord …, ensuite …, enfin … ») : 2 à 4 points de 5 mots au plus, sinon rien. */
function spokenSteps(scene: Scene): string[] {
  const parts = fold(scene.text).split(/\b(?:d'abord|premierement|deuxiemement|troisiemement|ensuite|puis|enfin|etape \d)\b/);
  if (parts.length < 3) return [];
  // Retrouver le texte d'origine (accents) en coupant aux mêmes positions.
  const original: string[] = [];
  let pos = 0;
  for (const p of parts) { original.push(scene.text.slice(pos, pos + p.length)); pos += p.length; pos += (fold(scene.text).slice(pos).match(/^(?:d'abord|premierement|deuxiemement|troisiemement|ensuite|puis|enfin|etape \d)/)?.[0].length ?? 0); }
  const items = original.slice(1).map((p) => wordsOf(p).slice(0, 5).join(" ")).filter((p) => p.length >= 3);
  return items.length >= 2 ? items.slice(0, 4) : [];
}

/**
 * Applique le Standard v1 aux scènes de la vidéo (transcript découpé par le Studio). Ordre de priorité : carte de fin,
 * mot-clé du CTA, accroche, « à retenir », chiffres, étapes, puis un onglet par idée forte ; chaque animation est posée
 * seulement si elle respecte l'écart minimal et ne chevauche rien.
 */
export function applyStandard(scenes: Scene[], opts: Opts): { custom: CustomAnimation[]; warnings: string[] } {
  const T = opts.template ?? STANDARD_TEMPLATE;
  const S = { ...STANDARD_V1, overlayMs: T.overlayMs, minSpacingMs: T.minSpacingMs, maxBehind: T.maxBehind, hook: T.hook, takeaway: T.takeaway };
  const on = (a: keyof AnimationTemplate["auto"]) => T.auto[a];
  const L = opts.styleName ?? T.name;
  // Sans BeeStyle : onglets, exactement comme avant.
  const word = (slot: keyof Look, text: string, atMs: number, label: string): CustomAnimation => {
    const name = opts.look?.[slot] ?? "onglet";
    return { name, fromMs: atMs, toMs: atMs + S.overlayMs, props: name === "onglet" ? { texte: text, ...S.onglet } : wordProps(name, text), label };
  };
  const warnings: string[] = [];
  const closingFrom = Math.max(0, opts.endMs - S.closingMs);
  const candidates: { priority: number; a: CustomAnimation; behind: boolean }[] = [];
  // Tout se termine avant la carte de fin (sauf elle-même).
  const add = (priority: number, a: CustomAnimation, behind = false) => candidates.push({ priority, a: a.name === "logo-fin" ? a : { ...a, toMs: Math.min(a.toMs, closingFrom - MIN_GAP_MS) }, behind });
  const ctaIndex = scenes.findIndex((s) => s.intent === "CTA");
  const content = scenes.filter((s) => s.intent !== "CTA");

  if (on("logo-fin") && opts.endMs > S.closingMs) add(0, { name: "logo-fin", fromMs: closingFrom, toMs: opts.endMs, props: { baseline: true }, label: `${L} · fin` });

  if (ctaIndex >= 0 && on("mot-cle")) {
    const cta = scenes[ctaIndex];
    const tw = timedWords(cta, opts.words);
    // Mot-clé du Reel lié ; sinon le mot dit juste après « Commente » (à activer comme mot-clé du post avant publication).
    const afterCommente = tw.findIndex((w) => w.key === "commente" || w.key === "commentez");
    const spoken = afterCommente >= 0 ? tw[afterCommente + 1] : undefined;
    const keyword = opts.keyword ?? (spoken ? spoken.text.replace(/[.,!?…]+$/, "").toUpperCase() : null);
    if (keyword) {
      const kw = fold(keyword);
      const said = tw.find((w) => w.key.replace(/[.,!?…]+$/, "") === kw) ?? cta.pivotWords.map((p) => ({ startMs: p.startMs, key: fold(clean(p.word)) })).find((p) => p.key === kw);
      const at = said?.startMs ?? cta.startMs;
      add(1, { name: "mot-cle", fromMs: at, toMs: at + S.ctaMs, props: { mot: keyword }, label: `${L} · mot-clé` });
      if (!opts.keyword) warnings.push(`Mot-clé dit dans la vidéo : « ${keyword} ». Mets-le comme mot-clé du post pour que le DM parte vraiment.`);
    } else warnings.push("Appel à l'action sans mot-clé : pastille « Commente MOT » non posée.");
  }

  const big = (scene: Scene, style: AnimationTemplate["hook"], priority: number, label: string, slot: keyof Look) => {
    const strong = strongWords(scene, opts.words);
    if (!strong) return;
    const { text, atMs } = strong;
    const behind = S.maxBehind > 0 && Boolean(opts.matteAt?.(atMs));
    if (!behind && !on("onglet") && S.maxBehind > 0) { warnings.push(`${label} : pas de détourage de la prise et onglets désactivés, « ${text} » n'est pas affiché.`); return; }
    const a: CustomAnimation = behind
      ? { name: "titre-derriere", fromMs: atMs, toMs: atMs + S.overlayMs, props: { texte: text, ...style }, label }
      : word(slot, text, atMs, label);
    if (!behind && S.maxBehind > 0) warnings.push(`${label} : pas de détourage de la prise, « ${text} » passe en onglet.`);
    add(priority, a, behind);
  };
  if (content[0]) big(content[0], S.hook, 2, `${L} · accroche`, "accroche");
  if (content.length > 2) big(content[content.length - 1], S.takeaway, 3, `${L} · à retenir`, "retenir");

  content.slice(1, -1).forEach((scene) => {
    const figure = spokenFigure(scene, opts.words);
    if (figure && on("chiffre")) return add(4, { name: "chiffre", fromMs: figure.atMs, toMs: figure.atMs + 3000, props: { valeur: figure.valeur, decimales: Number.isInteger(figure.valeur) ? 0 : 1, apres: figure.apres, legende: figure.legende }, label: `${L} · chiffre` });
    const steps = scene.intent === "LIST" && on("liste") ? spokenSteps(scene) : [];
    if (steps.length) return add(5, { name: "liste", fromMs: scene.startMs, toMs: Math.min(scene.endMs, scene.startMs + 1500 + steps.length * 1200), props: { items: steps }, label: `${L} · étapes` });
    const strong = strongWords(scene, opts.words);
    if (strong && on("onglet")) add(6, word("idee", strong.text, strong.atMs, `${L} · idée`));
  });

  const placed: { a: CustomAnimation; behind: boolean }[] = [];
  for (const c of [...candidates].sort((x, y) => x.priority - y.priority || x.a.fromMs - y.a.fromMs)) {
    if (c.a.toMs - c.a.fromMs < 800) continue;
    const tooClose = placed.some((p) => p.a.name !== "logo-fin" && c.a.name !== "logo-fin" && Math.abs(p.a.fromMs - c.a.fromMs) < S.minSpacingMs);
    if (tooClose) continue;
    if (c.behind && placed.filter((p) => p.behind).length >= S.maxBehind) continue;
    if (checkTimeline([...placed.map((p) => p.a), c.a]).length) continue;
    placed.push(c);
  }
  // Jamais deux grands mots à la suite : le second redevient un onglet.
  const ordered = placed.sort((x, y) => x.a.fromMs - y.a.fromMs);
  const dropped = new Set<number>();
  ordered.forEach((p, i) => {
    if (!p.behind || !ordered[i - 1]?.behind || dropped.has(i - 1)) return;
    // Onglets désactivés dans le modèle : le second grand mot n'est pas affiché plutôt que de devenir un onglet.
    if (!on("onglet")) { dropped.add(i); return; }
    p.behind = false; p.a = { ...word("retenir", String(p.a.props.texte), p.a.fromMs, p.a.label ?? `${L} · à retenir`), toMs: p.a.toMs };
  });
  return { custom: ordered.filter((_, i) => !dropped.has(i)).map((p) => p.a), warnings };
}
