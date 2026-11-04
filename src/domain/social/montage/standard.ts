import type { Scene } from "./scenes";
import { checkTimeline, MIN_GAP_MS, type CustomAnimation } from "./suggest";

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
};

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clean = (w: string) => w.replace(/[^\p{L}\p{N}%€'’-]/gu, "");
const wordsOf = (t: string) => t.split(/\s+/).map(clean).filter(Boolean);

/** Mot fort de la scène (mot pivot BeeRecos), sinon ses premiers mots : jamais un texte qui n'a pas été dit. */
function strongWords(scene: Scene, max: number): { text: string; atMs: number } {
  const pivot = scene.pivotWords[0];
  if (pivot) return { text: pivot.word.toUpperCase(), atMs: pivot.startMs };
  return { text: wordsOf(scene.text).slice(0, max).join(" ").toUpperCase(), atMs: scene.startMs };
}

/** Chiffre prononcé dans la scène et les mots qui le suivent (légende reprise mot pour mot). */
function spokenFigure(scene: Scene): { valeur: number; apres: string; legende: string } | null {
  const m = /(\d[\d\s]*(?:[.,]\d+)?)\s*(%|€)?\s*([^.!?…]*)/.exec(scene.text);
  if (!m) return null;
  const valeur = Number(m[1].replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(valeur)) return null;
  const legende = wordsOf(m[3]).slice(0, 5).join(" ");
  return legende ? { valeur, apres: m[2] ?? "", legende } : null;
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
  const S = STANDARD_V1;
  const warnings: string[] = [];
  const closingFrom = Math.max(0, opts.endMs - S.closingMs);
  const candidates: { priority: number; a: CustomAnimation; behind: boolean }[] = [];
  // Tout se termine avant la carte de fin (sauf elle-même).
  const add = (priority: number, a: CustomAnimation, behind = false) => candidates.push({ priority, a: a.name === "logo-fin" ? a : { ...a, toMs: Math.min(a.toMs, closingFrom - MIN_GAP_MS) }, behind });
  const ctaIndex = scenes.findIndex((s) => s.intent === "CTA");
  const content = scenes.filter((s) => s.intent !== "CTA");

  if (opts.endMs > S.closingMs) add(0, { name: "logo-fin", fromMs: closingFrom, toMs: opts.endMs, props: { baseline: true }, label: "Standard v1 · fin" });

  if (ctaIndex >= 0 && opts.keyword) {
    const cta = scenes[ctaIndex];
    const kw = fold(opts.keyword);
    const said = cta.pivotWords.find((p) => fold(clean(p.word)) === kw);
    add(1, { name: "mot-cle", fromMs: said?.startMs ?? cta.startMs, toMs: (said?.startMs ?? cta.startMs) + S.ctaMs, props: { mot: opts.keyword }, label: "Standard v1 · mot-clé" });
  } else if (ctaIndex >= 0) warnings.push("Appel à l'action sans mot-clé lié au Reel : pastille « Commente MOT » non posée (choisis le mot-clé actif dans le moteur de DM).");

  const big = (scene: Scene, style: typeof S.hook | typeof S.takeaway, priority: number, label: string) => {
    const { text, atMs } = strongWords(scene, 3);
    if (!text) return;
    const behind = Boolean(opts.matteAt?.(atMs));
    const a: CustomAnimation = behind
      ? { name: "titre-derriere", fromMs: atMs, toMs: atMs + S.overlayMs, props: { texte: text, ...style }, label }
      : { name: "onglet", fromMs: atMs, toMs: atMs + S.overlayMs, props: { texte: text, ...S.onglet }, label };
    if (!behind) warnings.push(`${label} : pas de détourage de la prise, « ${text} » passe en onglet.`);
    add(priority, a, behind);
  };
  if (content[0]) big(content[0], S.hook, 2, "Standard v1 · accroche");
  if (content.length > 2) big(content[content.length - 1], S.takeaway, 3, "Standard v1 · à retenir");

  content.slice(1, -1).forEach((scene) => {
    const figure = (scene.intent === "STAT" || scene.intent === "PROOF") ? spokenFigure(scene) : null;
    if (figure) return add(4, { name: "chiffre", fromMs: scene.startMs, toMs: scene.startMs + 3000, props: { valeur: figure.valeur, decimales: Number.isInteger(figure.valeur) ? 0 : 1, apres: figure.apres, legende: figure.legende }, label: "Standard v1 · chiffre" });
    const steps = scene.intent === "LIST" ? spokenSteps(scene) : [];
    if (steps.length) return add(5, { name: "liste", fromMs: scene.startMs, toMs: Math.min(scene.endMs, scene.startMs + 1500 + steps.length * 1200), props: { items: steps }, label: "Standard v1 · étapes" });
    const pivot = scene.pivotWords[0];
    if (pivot) add(6, { name: "onglet", fromMs: pivot.startMs, toMs: pivot.startMs + S.overlayMs, props: { texte: pivot.word.toUpperCase(), ...S.onglet }, label: "Standard v1 · idée" });
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
  ordered.forEach((p, i) => {
    if (p.behind && ordered[i - 1]?.behind) { p.behind = false; p.a = { ...p.a, name: "onglet", props: { texte: String(p.a.props.texte), ...S.onglet } }; }
  });
  return { custom: ordered.map((p) => p.a), warnings };
}
