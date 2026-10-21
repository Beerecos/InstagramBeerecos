import { z } from "zod";
import { formatIssue } from "./edit.ts";
import { LOGO_HEIGHT, LOGO_WIDTH } from "./reel.ts";
import { SAFE, SAFE_BLOCK, STRIKE_CSS, blurIn, countUp, escapeHtml, fadeIn, fadeOut, slideIn, strikeThrough } from "./fx.ts";

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
};

export const defineAnimation = <P extends z.ZodType>(def: AnimationDef<P>) => def as unknown as AnimationDef;

const text = (max: number) => z.string().trim().min(1).max(max);

export const KIT_ANIMATIONS: Record<string, AnimationDef> = {
  titre: defineAnimation({
    label: "Titre",
    description: "Titre court en haut de l'image, qui passe du flou au net puis s'efface. Pour l'accroche ou un changement d'idée.",
    lengthMs: 2500,
    props: z.strictObject({ texte: text(80), detail: z.string().trim().max(120).optional() }),
    example: { texte: "Une recommandation, ça vaut combien ?" },
    css: `
      .anim-titre { ${SAFE_BLOCK} top: ${SAFE.top}px; display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
      .anim-titre h2 { margin: 0; padding: 18px 28px; border-radius: 24px; background: #000000; color: #ffffff; font-size: 76px; font-weight: 600; line-height: 1.1; }
      .anim-titre p { margin: 0; padding: 10px 22px; border-radius: 16px; background: #ffffff; color: #000000; font-size: 40px; font-weight: 300; }`,
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
      .anim-mot-cle .hint { margin: 0; color: #ffffff; font-size: 48px; font-weight: 600; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6); }
      .anim-mot-cle .kw { margin: 0; padding: 18px 48px; border-radius: 28px; background: #2851FF; color: #ffffff; font-size: 120px; font-weight: 700; letter-spacing: 4px; }`,
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
    example: { valeur: 120, apres: "%", legende: "de recommandations en plus" },
    css: `
      .anim-chiffre { ${SAFE_BLOCK} top: 300px; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
      .anim-chiffre .num { margin: 0; padding: 10px 34px; border-radius: 28px; background: #2851FF; color: #ffffff; font-size: 170px; font-weight: 700; line-height: 1.05; font-variant-numeric: tabular-nums; }
      .anim-chiffre .leg { margin: 0; padding: 10px 22px; border-radius: 16px; background: #ffffff; color: #000000; font-size: 44px; font-weight: 600; }`,
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
      .anim-liste h3 { margin: 0; padding: 12px 26px; border-radius: 20px; background: #000000; color: #ffffff; font-size: 56px; font-weight: 600; }
      .anim-liste li { list-style: none; display: flex; align-items: center; gap: 18px; padding: 14px 26px; border-radius: 20px; background: #ffffff; color: #000000; font-size: 46px; font-weight: 600; }
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
      .anim-barre .old { margin: 0; padding: 14px 26px; border-radius: 20px; background: #000000; color: rgba(255, 255, 255, 0.7); font-size: 56px; font-weight: 600; }
      .anim-barre .strike { ${STRIKE_CSS} }
      .anim-barre .new { margin: 0; padding: 14px 26px; border-radius: 20px; background: #2851FF; color: #ffffff; font-size: 60px; font-weight: 700; }`,
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim-barre"><p id="${ctx.id}-o" class="old"><span id="${ctx.id}-x" class="strike" style="background-image: linear-gradient(${ctx.accent}, ${ctx.accent})">${escapeHtml(p.texte)}</span></p>${
        p.remplacement ? `<p id="${ctx.id}-n" class="new">${escapeHtml(p.remplacement)}</p>` : ""
      }</div>`,
      tweens: [blurIn(`${ctx.id}-o`, ctx.start), strikeThrough(`${ctx.id}-x`, ctx.start + 0.6), ...(p.remplacement ? [blurIn(`${ctx.id}-n`, ctx.start + 1.1)] : []), fadeOut(ctx.id, ctx)],
    }),
  }),

  "logo-fin": defineAnimation({
    label: "Logo BeeRecos de fin",
    description: "Plein écran bleu BeeRecos avec le logo officiel blanc et une phrase facultative. Pour clore la vidéo (dernières secondes).",
    lengthMs: 2000,
    props: z.strictObject({ texte: z.string().trim().max(60).optional() }),
    example: { texte: "Rejoins un club BeeRecos" },
    css: `
      .anim-logo-fin { position: absolute; inset: 0; background: #2851FF; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 48px; padding: ${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px; box-sizing: border-box; }
      .anim-logo-fin img { display: block; width: ${LOGO_WIDTH}px; height: ${LOGO_HEIGHT}px; }
      .anim-logo-fin p { margin: 0; color: #ffffff; font-size: 56px; font-weight: 600; text-align: center; }`,
    // Logo officiel, blanc sur bleu, jamais déformé : seule son opacité est animée (brandguide).
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim-logo-fin"><img id="${ctx.id}-logo" src="${(ctx.assetBase ?? ".").replace(/\/$/, "")}/brand/beerecos-logo-white.svg" alt="BeeRecos" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" />${
        p.texte ? `<p id="${ctx.id}-t">${escapeHtml(p.texte)}</p>` : ""
      }</div>`,
      tweens: [fadeIn(ctx.id, ctx.start, 0.3), fadeIn(`${ctx.id}-logo`, ctx.start + 0.2, 0.6), ...(p.texte ? [blurIn(`${ctx.id}-t`, ctx.start + 0.6)] : [])],
    }),
  }),
};

/** Bandeau d'erreur (barrière d'erreur). */
export const ERROR_CSS = `
      .anim-erreur { ${SAFE_BLOCK} top: ${SAFE.top}px; padding: 20px 28px; border-radius: 16px; background: #D93025; color: #ffffff; font-size: 36px; font-weight: 600; line-height: 1.3; }`;

/**
 * Rend une instance avec une « barrière d'erreur » : nom inconnu, réglages invalides ou exception
 * donnent un bandeau rouge lisible à l'aperçu, au lieu de faire échouer toute la composition.
 */
export function renderAnimation(name: string, rawProps: unknown, ctx: AnimationContext, registry: Record<string, AnimationDef> = KIT_ANIMATIONS): AnimationOutput & { error?: string } {
  const banner = (msg: string): AnimationOutput & { error: string } => ({ html: `<div id="${ctx.id}" class="anim-erreur">${escapeHtml(msg)}</div>`, tweens: [], error: msg });
  const def = Object.hasOwn(registry, name) ? registry[name] : undefined;
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
  const ctx = { id: "zz9", start: 1, duration: def.lengthMs / 1000, accent: "#693BFC" };
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
