import { z } from "zod";
import { escapeHtml } from "./reel.ts";
import { formatIssue } from "./edit.ts";

/**
 * Registre des animations posées dans `custom[]` d'un edit.json : `nom → définition`.
 * Une animation ne produit que du HTML (déjà échappé) et des tweens GSAP sur la timeline principale,
 * en temps du montage (secondes). Une erreur n'arrête jamais la vidéo : un bandeau rouge la remplace.
 */

export type AnimationContext = {
  /** Préfixe d'identifiant unique de l'instance (ex. « a3 »). */
  id: string;
  /** Début et durée dans le montage, en secondes. */
  start: number;
  duration: number;
  /** Couleur d'accent de la vidéo. */
  accent: string;
};

export type AnimationOutput = { html: string; tweens: string[] };

export type AnimationDef<P extends z.ZodType = z.ZodType> = {
  label: string;
  description: string;
  /** Durée conseillée, pour le studio et pour Claude. */
  lengthMs: number;
  props: P;
  render: (ctx: AnimationContext, props: z.infer<P>) => AnimationOutput;
};

const define = <P extends z.ZodType>(def: AnimationDef<P>) => def as unknown as AnimationDef;

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Sortie terminée juste avant la fin du clip : la fenêtre de visibilité est [début, fin). */
const exitAt = (ctx: AnimationContext, d = 0.3) => r2(Math.max(ctx.start, ctx.start + ctx.duration - d - 0.05));

export const KIT_ANIMATIONS: Record<string, AnimationDef> = {
  titre: define({
    label: "Titre",
    description: "Titre court en haut de l'image, qui passe du flou au net puis s'efface. Pour l'accroche ou un changement d'idée.",
    lengthMs: 2500,
    props: z.strictObject({ texte: z.string().trim().min(1).max(80), detail: z.string().trim().max(120).optional() }),
    render: (ctx, p) => ({
      html: [
        `<div id="${ctx.id}" class="anim anim-titre">`,
        `<h2 id="${ctx.id}-t">${escapeHtml(p.texte)}</h2>`,
        p.detail ? `<p id="${ctx.id}-d">${escapeHtml(p.detail)}</p>` : "",
        `</div>`,
      ].join(""),
      tweens: [
        `tl.fromTo("#${ctx.id}-t", { y: 40, opacity: 0, filter: "blur(10px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }, ${r2(ctx.start + 0.05)});`,
        p.detail ? `tl.fromTo("#${ctx.id}-d", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.inOut" }, ${r2(ctx.start + 0.4)});` : "",
        `tl.to("#${ctx.id}", { opacity: 0, duration: 0.3, ease: "power2.in" }, ${exitAt(ctx)});`,
      ].filter(Boolean),
    }),
  }),
  "mot-cle": define({
    label: "Mot-clé à commenter",
    description: "Pastille du mot à écrire en commentaire (CTA « commente MOT → DM »). Pour la fin de la vidéo.",
    lengthMs: 3000,
    props: z.strictObject({ mot: z.string().trim().regex(/^[A-ZÀ-Ý0-9]{2,20}$/, "mot-clé en majuscules, sans espace") }),
    render: (ctx, p) => ({
      html: `<div id="${ctx.id}" class="anim anim-mot-cle"><p class="hint">Commente</p><p id="${ctx.id}-k" class="kw">${escapeHtml(p.mot)}</p></div>`,
      tweens: [
        `tl.fromTo("#${ctx.id}", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, ${r2(ctx.start)});`,
        `tl.fromTo("#${ctx.id}-k", { scale: 0.9, filter: "blur(12px)" }, { scale: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, ${r2(ctx.start + 0.1)});`,
        `tl.to("#${ctx.id}", { opacity: 0, duration: 0.3, ease: "power2.in" }, ${exitAt(ctx)});`,
      ],
    }),
  }),
};

/** Styles des animations du kit, injectés une fois dans la composition. */
export const KIT_ANIMATION_CSS = `
      .anim { position: absolute; left: 90px; right: 170px; }
      .anim-titre { top: 260px; display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
      .anim-titre h2 { margin: 0; padding: 18px 28px; border-radius: 24px; background: #000000; color: #ffffff; font-size: 76px; font-weight: 600; line-height: 1.1; }
      .anim-titre p { margin: 0; padding: 10px 22px; border-radius: 16px; background: #ffffff; color: #000000; font-size: 40px; font-weight: 300; }
      .anim-mot-cle { top: 520px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .anim-mot-cle .hint { margin: 0; color: #ffffff; font-size: 48px; font-weight: 600; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6); }
      .anim-mot-cle .kw { margin: 0; padding: 18px 48px; border-radius: 28px; background: #2851FF; color: #ffffff; font-size: 120px; font-weight: 700; letter-spacing: 4px; }
      .anim-erreur { top: 260px; padding: 20px 28px; border-radius: 16px; background: #D93025; color: #ffffff; font-size: 36px; font-weight: 600; line-height: 1.3; }`;

/**
 * Rend une instance avec une « barrière d'erreur » : nom inconnu, réglages invalides ou exception
 * donnent un bandeau rouge lisible à l'aperçu, au lieu de faire échouer toute la composition.
 */
export function renderAnimation(name: string, rawProps: unknown, ctx: AnimationContext, registry: Record<string, AnimationDef> = KIT_ANIMATIONS): AnimationOutput & { error?: string } {
  const banner = (msg: string): AnimationOutput & { error: string } => ({ html: `<div id="${ctx.id}" class="anim anim-erreur">${escapeHtml(msg)}</div>`, tweens: [], error: msg });
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
