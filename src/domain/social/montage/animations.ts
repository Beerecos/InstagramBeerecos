import { z } from "zod";
import { formatIssue } from "./edit";
import { ALERT, BASELINE, CAPTION_DEFAULTS, COLORS, END_BASELINE_GAP, END_LOGO, END_LOGO_WIDTH } from "./brand";
import { SAFE, SAFE_BLOCK, STRIKE_CSS, blurIn, countUp, escapeHtml, fadeIn, fadeOut, slideIn, strikeThrough } from "./fx";

/**
 * Animations du kit BeeRecos, posées dans `custom[]` d'un edit.json : `nom → définition`.
 * Une animation ne produit que du HTML (déjà échappé), son CSS (préfixé `.anim-<nom>`) et des tweens GSAP sur la
 * timeline principale, en secondes du montage. Une erreur n'arrête jamais la vidéo : un bandeau rouge la remplace.
 * Les animations créées pour toi vivent à part, dans `mes-animations/` (elles gagnent à nom égal).
 */

export type AnimationContext = {
  /** Préfixe d'identifiant unique de l'instance (ex. « a3 ») : tout id produit commence par lui. */
  id: string;
  /** Début et durée dans le montage, en secondes. */
  start: number;
  duration: number;
  /** Couleur d'accent de la vidéo (un seul accent, STYLE.md). */
  accent: string;
  /** Où trouver les ressources (logo, polices) ; par défaut « . ». */
  assetBase?: string;
  /** Adresse d'un média de la bibliothèque (image) ; par défaut le fichier à côté de la composition. */
  media?: (file: string) => string;
};

export type AnimationOutput = { html: string; tweens: string[] };

export type AnimationDef<P extends z.ZodType = z.ZodType> = {
  label: string;
  /** Ce que fait l'animation et quand l'utiliser : c'est ce que lit Claude pour choisir. */
  description: string;
  /** Durée conseillée, en ms. */
  lengthMs: number;
  props: P;
  /** Réglages d'exemple : servent au catalogue, à l'aperçu isolé et aux tests. */
  example: z.input<P>;
  /** Styles, chaque règle préfixée par `.anim-<nom>` ; injectés une fois si l'animation est utilisée. */
  css: string;
  render: (ctx: AnimationContext, props: z.infer<P>) => AnimationOutput;
  /**
   * Titre DERRIÈRE le sujet (lot S5) : posé sous le détourage de la prise, qui passe devant lui pendant l'animation.
   * Exige le détourage de la prise (matte.ts) ; sans lui, l'animation est refusée.
   */
  behind?: boolean;
};

export const defineAnimation = <P extends z.ZodType>(def: AnimationDef<P>) => def as unknown as AnimationDef;

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * Titre en une ligne jusqu'à 12 signes, en deux lignes coupées à l'espace le plus proche du milieu jusqu'à 28 signes,
 * au-delà en trois lignes équilibrées (textes à l'écran des 72 Reels, lot S7 : 48 signes au plus).
 */
export function titleLines(texte: string): string[] {
  const t = texte.replace(/\s+/g, " ").trim();
  if (t.length <= 12 || !t.includes(" ")) return [t];
  const spaces = [...t.matchAll(/ /g)].map((m) => m.index ?? 0);
  if (t.length > 28 && spaces.length >= 2) {
    let best: string[] = [];
    for (let a = 0; a < spaces.length; a++) for (let b = a + 1; b < spaces.length; b++) {
      const lines = [t.slice(0, spaces[a]), t.slice(spaces[a] + 1, spaces[b]), t.slice(spaces[b] + 1)];
      if (!best.length || Math.max(...lines.map((l) => l.length)) < Math.max(...best.map((l) => l.length))) best = lines;
    }
    return best;
  }
  const cut = spaces.reduce((best, i) => (Math.abs(i - t.length / 2) < Math.abs(best - t.length / 2) ? i : best), spaces[0]);
  return [t.slice(0, cut), t.slice(cut + 1)];
}

export const KIT_ANIMATIONS: Record<string, AnimationDef> = {
  titre: defineAnimation({
    label: "Titre",
    description: "Titre court en haut de l'image, qui passe du flou au net puis s'efface. Pour l'accroche ou un changement d'idée.",
    lengthMs: 2500,
    props: z.strictObject({ texte: text(80), detail: z.string().trim().max(120).optional() }),
    example: { texte: "Une recommandation, ça vaut combien ?" },
    css: `
      .anim-titre { ${SAFE_BLOCK} top: ${SAFE.top}px; display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
      .anim-titre h2 { margin: 0; padding: 18px 28px; border-radius: 24px; background: ${COLORS.black}; color: ${COLORS.white}; font-size: 76px; font-weight: 600; line-height: 1.1; }
      .anim-titre p { margin: 0; padding: 10px 22px; border-radius: 16px; background: ${COLORS.white}; color: ${COLORS.black}; font-size: 40px; font-weight: 300; }`,
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim-titre"><h2 id="${ctx.id}-t">${escapeHtml(p.texte)}</h2>${p.detail ? `<p id="${ctx.id}-d">${escapeHtml(p.detail)}</p>` : ""}</div>`,
      tweens: [blurIn(`${ctx.id}-t`, ctx.start + 0.05), ...(p.detail ? [fadeIn(`${ctx.id}-d`, ctx.start + 0.4, 0.5)] : []), fadeOut(ctx.id, ctx)],
    }),
  }),

  "mot-cle": defineAnimation({
    label: "Mot-clé à commenter",
    description: "Pastille du mot à écrire en commentaire (CTA « commente MOT → DM »). Pour la fin de la vidéo.",
    lengthMs: 3000,
    props: z.strictObject({ mot: z.string().trim().regex(/^[A-ZÀ-Ý0-9]{2,20}$/, "mot-clé en majuscules, sans espace") }),
    example: { mot: "CLUB" },
    css: `
      .anim-mot-cle { ${SAFE_BLOCK} top: 520px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .anim-mot-cle .hint { margin: 0; color: ${COLORS.white}; font-size: 48px; font-weight: 600; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6); }
      .anim-mot-cle .kw { margin: 0; padding: 18px 48px; border-radius: 28px; background: ${COLORS.blue}; color: ${COLORS.white}; font-size: 120px; font-weight: 700; letter-spacing: 4px; }`,
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim-mot-cle"><p class="hint">Commente</p><p id="${ctx.id}-k" class="kw">${escapeHtml(p.mot)}</p></div>`,
      tweens: [fadeIn(ctx.id, ctx.start, 0.3), blurIn(`${ctx.id}-k`, ctx.start + 0.1, { y: 0, blur: 12, duration: 0.7 }), fadeOut(ctx.id, ctx)],
    }),
  }),

  chiffre: defineAnimation({
    label: "Chiffre qui compte",
    description: "Grand chiffre qui défile jusqu'à sa valeur, avec une légende. Pour une preuve chiffrée DITE dans la vidéo (jamais inventée).",
    lengthMs: 3000,
    props: z.strictObject({
      valeur: z.number().finite().min(-1e9).max(1e9),
      decimales: z.number().int().min(0).max(2).default(0),
      avant: z.string().trim().max(4).default(""),
      apres: z.string().trim().max(6).default(""),
      legende: text(60),
    }),
    // Exemple neutre (catalogue, aperçu, affiche) : jamais une statistique qui pourrait se lire comme un fait BeeRecos.
    example: { valeur: 12, legende: "Exemple : chiffre dit dans la vidéo" },
    css: `
      .anim-chiffre { ${SAFE_BLOCK} top: 300px; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
      .anim-chiffre .num { margin: 0; padding: 10px 34px; border-radius: 28px; background: ${COLORS.blue}; color: ${COLORS.white}; font-size: 170px; font-weight: 700; line-height: 1.05; font-variant-numeric: tabular-nums; }
      .anim-chiffre .leg { margin: 0; padding: 10px 22px; border-radius: 16px; background: ${COLORS.white}; color: ${COLORS.black}; font-size: 44px; font-weight: 600; }`,
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim-chiffre"><p id="${ctx.id}-n" class="num">${escapeHtml(p.avant)}<span id="${ctx.id}-v">0</span>${escapeHtml(p.apres)}</p><p id="${ctx.id}-l" class="leg">${escapeHtml(p.legende)}</p></div>`,
      tweens: [
        blurIn(`${ctx.id}-n`, ctx.start, { y: 30 }),
        ...countUp(`${ctx.id}-v`, { to: p.valeur, at: ctx.start + 0.1, duration: Math.min(1.4, Math.max(0.4, ctx.duration - 1)), decimals: p.decimales }),
        fadeIn(`${ctx.id}-l`, ctx.start + 0.5),
        fadeOut(ctx.id, ctx),
      ],
    }),
  }),

  liste: defineAnimation({
    label: "Liste à puces",
    description: "Deux à quatre points courts qui arrivent un par un sous un titre facultatif. Pour résumer des étapes ou des bénéfices énoncés.",
    lengthMs: 4000,
    props: z.strictObject({ titre: z.string().trim().max(60).optional(), items: z.array(text(40)).min(2).max(4) }),
    example: { titre: "Ce qui change :", items: ["On sait qui recommande", "On sait ce que ça rapporte", "On remercie celui qui apporte"] },
    css: `
      .anim-liste { ${SAFE_BLOCK} top: ${SAFE.top}px; display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
      .anim-liste h3 { margin: 0; padding: 12px 26px; border-radius: 20px; background: ${COLORS.black}; color: ${COLORS.white}; font-size: 56px; font-weight: 600; }
      .anim-liste li { list-style: none; display: flex; align-items: center; gap: 18px; padding: 14px 26px; border-radius: 20px; background: ${COLORS.white}; color: ${COLORS.black}; font-size: 46px; font-weight: 600; }
      .anim-liste ul { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
      .anim-liste .dot { flex: none; width: 18px; height: 18px; border-radius: 50%; }`,
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim-liste">${p.titre ? `<h3 id="${ctx.id}-t">${escapeHtml(p.titre)}</h3>` : ""}<ul>${p.items
        .map((it, j) => `<li id="${ctx.id}-i${j}"><span class="dot" style="background: ${ctx.accent}"></span>${escapeHtml(it)}</li>`)
        .join("")}</ul></div>`,
      tweens: [
        ...(p.titre ? [blurIn(`${ctx.id}-t`, ctx.start)] : []),
        // Les points se répartissent sur la première moitié du clip pour laisser le temps de lire le dernier.
        ...p.items.map((_, j) => slideIn(`${ctx.id}-i${j}`, ctx.start + (p.titre ? 0.4 : 0.1) + (j * Math.max(0.25, ctx.duration * 0.5)) / p.items.length)),
        fadeOut(ctx.id, ctx),
      ],
    }),
  }),

  barre: defineAnimation({
    label: "Idée barrée",
    description: "Une idée reçue se fait barrer, puis la bonne réponse apparaît dessous. Pour un contraste « pas X, mais Y ».",
    lengthMs: 3000,
    props: z.strictObject({ texte: text(50), remplacement: z.string().trim().max(50).optional() }),
    example: { texte: "Le bouche-à-oreille au hasard", remplacement: "Un réseau qui recommande" },
    css: `
      .anim-barre { ${SAFE_BLOCK} top: ${SAFE.top}px; display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
      .anim-barre .old { margin: 0; padding: 14px 26px; border-radius: 20px; background: ${COLORS.black}; color: rgba(255, 255, 255, 0.7); font-size: 56px; font-weight: 600; }
      .anim-barre .strike { ${STRIKE_CSS} }
      .anim-barre .new { margin: 0; padding: 14px 26px; border-radius: 20px; background: ${COLORS.blue}; color: ${COLORS.white}; font-size: 60px; font-weight: 700; }`,
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim-barre"><p id="${ctx.id}-o" class="old"><span id="${ctx.id}-x" class="strike" style="background-image: linear-gradient(${ctx.accent}, ${ctx.accent})">${escapeHtml(p.texte)}</span></p>${
        p.remplacement ? `<p id="${ctx.id}-n" class="new">${escapeHtml(p.remplacement)}</p>` : ""
      }</div>`,
      tweens: [blurIn(`${ctx.id}-o`, ctx.start), strikeThrough(`${ctx.id}-x`, ctx.start + 0.6), ...(p.remplacement ? [blurIn(`${ctx.id}-n`, ctx.start + 1.1)] : []), fadeOut(ctx.id, ctx)],
    }),
  }),

  onglet: defineAnimation({
    label: "Onglet (cartouche)",
    description: "Cartouche court à angles arrondis, bleu texte blanc ou blanc texte noir avec accent bleu : un mot-clé, une étape ou une précision. Pour une image sans personnage détourable ou une information complémentaire ; une idée par onglet, à distance du visage, du logo et des sous-titres.",
    lengthMs: 2500,
    props: z.strictObject({
      texte: text(48),
      variante: z.enum(["bleu", "blanc"]).default("bleu"),
      /** Coin haut gauche, en px du canevas 1080 × 1920 : dans les zones de sécurité et au-dessus de la zone des sous-titres. */
      x: z.number().int().min(SAFE.left, `doit être à ${SAFE.left} px au moins (zone de sécurité)`).max(700, "doit être à 700 px au plus").default(SAFE.left),
      y: z.number().int().min(SAFE.top, `doit être à ${SAFE.top} px au moins (zone de sécurité)`).max(CAPTION_DEFAULTS.top - 140, `doit être à ${CAPTION_DEFAULTS.top - 140} px au plus (zone des sous-titres reste libre)`).default(760),
    }),
    example: { texte: "Étape 1 : la réunion de club", variante: "bleu" },
    css: `
      .anim-onglet { position: absolute; max-width: calc(${1080 - SAFE.right}px - var(--x)); box-sizing: border-box; padding: 16px 28px; border-radius: 18px; font-size: 48px; font-weight: 600; line-height: 1.15; }
      .anim-onglet.bleu { background: ${COLORS.blue}; color: ${COLORS.white}; }
      .anim-onglet.blanc { background: ${COLORS.white}; color: ${COLORS.black}; border-left: 12px solid ${COLORS.blue}; }`,
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim-onglet ${p.variante}" style="--x: ${p.x}px; left: ${p.x}px; top: ${p.y}px">${escapeHtml(p.texte)}</div>`,
      tweens: [slideIn(ctx.id, ctx.start), fadeOut(ctx.id, ctx)],
    }),
  }),

  image: defineAnimation({
    label: "Image de la bibliothèque",
    description: "Image importée dans la bibliothèque du Studio (avec sa licence), en encart dans les zones de sécurité ou en plein écran, avec une légende facultative. Pour montrer ce dont parle la voix (lieu, produit, capture).",
    lengthMs: 3000,
    props: z.strictObject({
      fichier: z.string().regex(/^[\w.-]+\.(png|jpe?g|webp)$/i, "nom d'une image de la bibliothèque (.png, .jpg, .webp)"),
      mode: z.enum(["encart", "plein"]).default("encart"),
      legende: z.string().trim().max(60).optional(),
    }),
    example: { fichier: "exemple-1a2b3c4d.jpg", mode: "encart", legende: "La réunion du club" },
    css: `
      .anim-image { position: absolute; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
      .anim-image.encart { left: ${SAFE.left}px; right: ${SAFE.right}px; top: ${SAFE.top + 40}px; }
      .anim-image.encart img { display: block; max-width: 100%; max-height: 860px; border-radius: 28px; object-fit: cover; }
      .anim-image.plein { inset: 0; }
      .anim-image.plein img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .anim-image p { margin: 0; padding: 10px 22px; border-radius: 16px; background: ${COLORS.white}; color: ${COLORS.black}; font-size: 44px; font-weight: 600; }
      .anim-image.plein p { position: absolute; left: ${SAFE.left}px; top: ${SAFE.top}px; }`,
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim-image ${p.mode}"><img id="${ctx.id}-img" src="${escapeHtml(ctx.media ? ctx.media(p.fichier) : `./${p.fichier}`)}" alt="" />${
        p.legende ? `<p id="${ctx.id}-l">${escapeHtml(p.legende)}</p>` : ""
      }</div>`,
      tweens: [fadeIn(ctx.id, ctx.start, 0.4), ...(p.legende ? [blurIn(`${ctx.id}-l`, ctx.start + 0.3)] : []), fadeOut(ctx.id, ctx)],
    }),
  }),

  "titre-derriere": defineAnimation({
    label: "Titre derrière le sujet",
    description: "Grand mot (1 à 3 mots, Poppins Bold, bleu, blanc ou noir selon le décor) posé DERRIÈRE la personne filmée : sa silhouette passe devant les lettres, le décor reste intact. Apparaît au moment où le mot est prononcé, réservé aux moments forts (RÉSEAU, CONFIANCE, TON RÉSEAU). Exige le détourage de la prise.",
    lengthMs: 2500,
    behind: true,
    // Consigne de Cédric (2026-11-04, « grands mots derrière le personnage ») : 1 à 3 mots, Poppins Bold, bleu, blanc
    // ou noir selon le décor, entrées validées (rebond, verticale, latérale, deux temps pour une expression) puis
    // stabilisation. « flou » reste l'entrée par défaut pour que les montages déjà enregistrés se rejouent à l'identique.
    props: z.strictObject({
      texte: text(48),
      position: z.enum(["haut", "milieu"]).default("haut"),
      couleur: z.enum(["blanc", "bleu", "noir"]).default("blanc"),
      entree: z.enum(["flou", "rebond", "verticale", "laterale"]).default("flou"),
    }),
    example: { texte: "Ton réseau", entree: "rebond" },
    css: `
      .anim-titre-derriere { position: absolute; left: ${SAFE.left}px; right: ${SAFE.left}px; display: flex; flex-direction: column; align-items: center; }
      .anim-titre-derriere p { margin: 0; font-weight: 700; line-height: 0.95; letter-spacing: -2px; text-align: center; text-transform: uppercase; white-space: nowrap; text-shadow: 0 6px 32px rgba(0, 0, 0, 0.35); }`,
    render: (ctx, p) => {
      const lines = titleLines(p.texte);
      // Corps calé sur la ligne la plus longue (Poppins 700 en capitales ≈ 0,68 em par signe), 260 px au plus.
      const size = Math.min(260, Math.floor((1080 - 2 * SAFE.left) / (0.68 * Math.max(...lines.map((l) => l.length)))));
      // « haut » : derrière le haut de la tête d'un plan face caméra vertical ; « milieu » : derrière les épaules.
      const top = p.position === "haut" ? 520 : 860;
      const color = p.couleur === "bleu" ? ctx.accent : p.couleur === "noir" ? COLORS.black : COLORS.white;
      // Ombre portée seulement sous un texte clair : sur un mot noir, elle salirait le décor.
      const shadow = p.couleur === "noir" ? "none" : "0 6px 32px rgba(0, 0, 0, 0.35)";
      const line = (i: number) => `#${ctx.id}-l${i}`;
      // Expression sur plusieurs lignes : apparition en deux temps (une ligne, puis la suivante), puis le mot reste stable.
      const at = (i: number) => (ctx.start + 0.05 + i * (p.entree === "flou" ? 0.12 : 0.3)).toFixed(2);
      const enter = (i: number) => {
        if (p.entree === "rebond") return `tl.from("${line(i)}", { scale: 0.55, opacity: 0, duration: 0.45, ease: "back.out(1.6)", transformOrigin: "50% 60%" }, ${at(i)});`;
        if (p.entree === "verticale") return `tl.from("${line(i)}", { y: 120, opacity: 0, duration: 0.4, ease: "power3.out" }, ${at(i)});`;
        if (p.entree === "laterale") return `tl.from("${line(i)}", { x: i % 2 ? 160 : -160, opacity: 0, duration: 0.4, ease: "power3.out" }, ${at(i)});`;
        return blurIn(`${ctx.id}-l${i}`, ctx.start + 0.05 + i * 0.12, { y: 80, blur: 14, duration: 0.7 });
      };
      return {
        html: `<div id="${ctx.id}" class="anim-titre-derriere" style="top: ${top}px">${lines.map((l, i) => `<p id="${ctx.id}-l${i}" style="font-size: ${size}px; color: ${color}${p.couleur === "noir" ? `; text-shadow: ${shadow}` : ""}">${escapeHtml(l)}</p>`).join("")}</div>`,
        tweens: [...lines.map((_, i) => enter(i)), fadeOut(ctx.id, ctx)],
      };
    },
  }),

  "logo-fin": defineAnimation({
    label: "Logo BeeRecos de fin",
    description: "Plein écran blanc avec le logo officiel horizontal (BeeRecos bleu et noir) et, par défaut, la baseline #MonReseauCestTonReseau manuscrite dessous, au centre, plus une phrase facultative en bas de l'écran. Pour clore la vidéo (dernières secondes).",
    lengthMs: 2000,
    props: z.strictObject({ texte: z.string().trim().max(60).optional(), baseline: z.boolean().default(true) }),
    example: { texte: "Rejoins un club BeeRecos", baseline: true },
    css: `
      .anim-logo-fin { position: absolute; inset: 0; background: ${COLORS.white}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: ${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px; box-sizing: border-box; }
      .anim-logo-fin img { display: block; width: ${END_LOGO_WIDTH}px; }
      .anim-logo-fin .baseline { margin-top: ${END_BASELINE_GAP}px; }
      .anim-logo-fin p { position: absolute; left: ${SAFE.right}px; right: ${SAFE.right}px; bottom: ${SAFE.bottom + 40}px; margin: 0; color: ${COLORS.black}; font-size: 48px; font-weight: 600; line-height: 1.3; text-align: center; }`,
    // Logo et baseline officiels fournis par Cédric (fichiers intacts), jamais déformés : seule leur opacité est animée.
    render: (ctx, p) => {
      const base = (ctx.assetBase ?? ".").replace(/\/$/, "");
      const img = (id: string, f: { file: string; ratio: number }, alt: string, cls = "") =>
        `<img id="${ctx.id}-${id}"${cls ? ` class="${cls}"` : ""} src="${base}/${f.file}" alt="${alt}" width="${END_LOGO_WIDTH}" height="${Math.round(END_LOGO_WIDTH * f.ratio)}" />`;
      return {
        html: `<div id="${ctx.id}" class="anim-logo-fin">${img("logo", END_LOGO.plain, "BeeRecos")}${p.baseline ? img("b", END_LOGO.baseline, BASELINE, "baseline") : ""}${
          p.texte ? `<p id="${ctx.id}-t">${escapeHtml(p.texte)}</p>` : ""
        }</div>`,
        tweens: [fadeIn(ctx.id, ctx.start, 0.3), fadeIn(`${ctx.id}-logo`, ctx.start + 0.2, 0.6), ...(p.baseline ? [fadeIn(`${ctx.id}-b`, ctx.start + 0.5, 0.5)] : []), ...(p.texte ? [blurIn(`${ctx.id}-t`, ctx.start + 0.7)] : [])],
      };
    },
  }),
};

/** Bandeau d'erreur (barrière d'erreur). */
export const ERROR_CSS = `
      .anim-erreur { ${SAFE_BLOCK} top: ${SAFE.top}px; padding: 20px 28px; border-radius: 16px; background: ${ALERT}; color: ${COLORS.white}; font-size: 36px; font-weight: 600; line-height: 1.3; }`;

/**
 * Rend une instance avec une « barrière d'erreur » : nom inconnu, réglages invalides ou exception
 * donnent un bandeau rouge lisible à l'aperçu, au lieu de faire échouer toute la composition.
 */
export function renderAnimation(name: string, rawProps: unknown, ctx: AnimationContext, registry: Record<string, AnimationDef> = KIT_ANIMATIONS): AnimationOutput & { error?: string } {
  const banner = (msg: string): AnimationOutput & { error: string } => ({ html: `<div id="${ctx.id}" class="anim-erreur">${escapeHtml(msg)}</div>`, tweens: [], error: msg });
  const def = Object.prototype.hasOwnProperty.call(registry, name) ? registry[name] : undefined;
  if (!def) return banner(`Animation « ${name} » introuvable`);
  const props = def.props.safeParse(rawProps, { reportInput: true });
  if (!props.success) return banner(`Animation « ${name} » : ${props.error.issues.map((i) => formatIssue(i).replace(/^• /, "")).join(" ; ")}`);
  try {
    return def.render(ctx, props.data);
  } catch (e) {
    return banner(`Animation « ${name} » : ${e instanceof Error ? e.message : "erreur inconnue"}`);
  }
}

/**
 * Contrôle d'une animation (kit ou mes-animations) avant de l'utiliser : fiche complète, exemple valide,
 * identifiants préfixés par l'instance, tweens limités à ses propres éléments, CSS préfixé, aucun script.
 */
export function checkAnimation(name: string, def: AnimationDef): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9-]+$/.test(name)) errors.push(`nom « ${name} » : minuscules, chiffres et tirets uniquement`);
  if (!def.label?.trim()) errors.push("label manquant");
  if (!def.description || def.description.length < 30) errors.push("description trop courte (dire ce que fait l'animation et quand l'utiliser)");
  if (!(def.lengthMs >= 500 && def.lengthMs <= 15000)) errors.push("lengthMs doit être entre 500 et 15000");
  const ctx = { id: "zz9", start: 1, duration: def.lengthMs / 1000, accent: COLORS.blue };
  const out = renderAnimation(name, def.example, ctx, { [name]: def });
  if (out.error) return [...errors, `l'exemple ne passe pas : ${out.error}`];
  if (/<script|\son\w+=|javascript:/i.test(out.html)) errors.push("le HTML ne doit contenir ni script ni attribut on…=");
  for (const [, id] of out.html.matchAll(/\sid="([^"]*)"/g)) if (id !== ctx.id && !id.startsWith(`${ctx.id}-`)) errors.push(`id « ${id} » : doit commencer par ctx.id`);
  if (!out.html.includes(`id="${ctx.id}"`)) errors.push("l'élément racine doit avoir id={ctx.id}");
  for (const t of out.tweens) {
    if (!/^tl\.(to|from|fromTo|set)\("#/.test(t)) errors.push(`tween hors gabarit : ${t.slice(0, 60)}`);
    for (const [, target] of t.matchAll(/\("#([^"]+)"/g)) if (target !== ctx.id && !target.startsWith(`${ctx.id}-`)) errors.push(`tween sur « #${target} » : seulement ses propres éléments`);
  }
  for (const rule of def.css.split("}").map((r) => r.trim()).filter(Boolean)) {
    const selector = rule.split("{")[0].trim();
    if (!selector.split(",").every((s) => s.trim().startsWith(`.anim-${name}`))) errors.push(`CSS « ${selector} » : chaque règle commence par .anim-${name}`);
  }
  return errors;
}
