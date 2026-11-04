/**
 * Visuels de carrousel BeeRecos (référence : carrousel STABILO BOSS validé, InspiBEEzness_01_STABILO_BeeRecos.pdf).
 * L'IA propose un plan (modèle de mise en page + textes courts + photo à utiliser) ; la charte est appliquée par le code
 * (format 1080 × 1350, Poppins, bleu #2851FF / noir / blanc, logo officiel, en-tête, pagination, signature).
 * Règles : 8 slides au plus, invitation finale obligatoire en dernier, aucune photo inventée.
 */
import { z } from "zod";
import { INSPI_CTA } from "./story-caption";

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
export const SLIDES_MAX = 8;
export const SERIES = "Les InspiBEEz'ness";

export const LAYOUTS = {
  couverture: "Couverture : grand titre sur 2 ou 3 lignes (un mot en bleu), sous-titre court, photo du produit en bas à droite.",
  "photo-bandeau": "Photo en haut, bandeau bleu en bas avec un titre blanc et une ou deux phrases.",
  affiche: "Affiche typographique blanche : grand titre, un mot surligné en bleu, une phrase, photo facultative.",
  date: "Date ou chiffre monumental en bleu, photo du produit, titre et une phrase.",
  "chiffre-bleu": "Page bleue : chiffre géant en blanc, quelques mots, une phrase.",
  "deux-photos": "Deux photos côte à côte avec une étiquette chacune (ex. « 2016 / PASTEL »), titre au-dessus.",
  "chiffre-noir": "Page noire : chiffre géant en bleu, un mot en blanc, une phrase (le résultat).",
  invitation: "Dernière slide obligatoire : photo de rencontre facultative, question, « Commente », INSPI en très grand.",
} as const;
export type Layout = keyof typeof LAYOUTS;
const LAYOUT_KEYS = Object.keys(LAYOUTS) as [Layout, ...Layout[]];

const short = (max: number) => z.string().trim().max(max).default("");

export const SlideSchema = z.object({
  layout: z.enum(LAYOUT_KEYS),
  title: short(90),
  /** Mot ou groupe de mots du titre mis en bleu (ou surligné sur l'affiche). */
  accent: short(40),
  text: short(220),
  /** Date ou chiffre monumental (« 1971 », « 1 000 », « 3 »). */
  number: short(12),
  /** Petit texte avant le chiffre (« Plus de »). */
  prefix: short(24),
  /** Photos : numéro de la photo fournie (1, 2, …) ou rien. */
  photo: z.number().int().min(1).max(20).nullable().default(null),
  photo2: z.number().int().min(1).max(20).nullable().default(null),
  label: short(30),
  label2: short(30),
  /** Pied de slide : source courte (« SOURCE : STABILO », « STABILO / MAI 2025 »). */
  source: short(40),
});
export type Slide = z.output<typeof SlideSchema>;

export const PlanSchema = z.object({ slides: z.array(SlideSchema).min(1) });

/** Dernière slide officielle (texte exact de l'invitation, découpé pour la mise en page). */
export const INVITATION: Slide = {
  layout: "invitation", title: "Tu veux, toi aussi, rencontrer des entrepreneurs inspirants ?", accent: "", text: "pour recevoir ton invitation à découvrir un club BeeRecos.",
  number: "INSPI", prefix: "Commente", photo: null, photo2: null, label: "", label2: "", source: "#MonReseauCestTonReseau",
};

/**
 * Plan final : au plus 8 slides, l'invitation officielle toujours en dernier (une seule), photos inexistantes retirées
 * (jamais inventées), mot en bleu gardé seulement s'il figure dans le titre.
 */
export function normalizePlan(slides: Slide[], photoCount: number): Slide[] {
  const photo = (n: number | null) => (n !== null && n >= 1 && n <= photoCount ? n : null);
  const content = slides.filter((s) => s.layout !== "invitation").slice(0, SLIDES_MAX - 1).map((s) => ({
    ...s,
    photo: photo(s.photo),
    photo2: photo(s.photo2),
    accent: s.accent && s.title.toLowerCase().includes(s.accent.toLowerCase()) ? s.accent : "",
  }));
  const invitationPhoto = photo(slides.find((s) => s.layout === "invitation")?.photo ?? null);
  return [...content, { ...INVITATION, photo: invitationPhoto }];
}

/** Lit le plan renvoyé par l'IA (JSON, éventuellement entouré de texte) ; erreur lisible sinon. */
export function parsePlan(text: string, photoCount: number): Slide[] {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("L'IA n'a pas renvoyé de plan lisible : relance la proposition.");
  let data: unknown;
  try { data = JSON.parse(text.slice(start, end + 1)); } catch { throw new Error("Plan de l'IA illisible : relance la proposition."); }
  const parsed = PlanSchema.safeParse(data);
  if (!parsed.success) throw new Error("Plan de l'IA incomplet : relance la proposition.");
  return normalizePlan(parsed.data.slides, photoCount);
}

/** Consigne envoyée à l'IA : direction artistique du prompt InspiBEEz'ness, réduite au plan des slides. */
export function planBrief(subject: string, facts: string, photos: string[]): string {
  const layouts = Object.entries(LAYOUTS).map(([k, v]) => `- ${k} : ${v}`).join("\n");
  const list = photos.length ? photos.map((p, i) => `photo ${i + 1} : ${p}`).join("\n") : "aucune photo fournie (compositions typographiques uniquement)";
  return `PLAN DE CARROUSEL — Les InspiBEEz'ness (BeeRecos)
Tu es le directeur artistique et le rédacteur éditorial des carrousels BeeRecos. Prépare le plan des slides ; la mise en page, la charte et le logo sont appliqués automatiquement.
Déroulé à adapter : 1 couverture qui intrigue ; 2 contexte ou besoin ; 3 déclic et solution ; 4 création ou tournant ; 5 lancement ; 6 évolution ; 7 résultat vérifié et daté ; 8 invitation (ajoutée automatiquement, ne l'écris pas). ${SLIDES_MAX - 1} slides de contenu au plus.
Une seule idée par slide. Titre de 3 à 8 mots, une ou deux phrases courtes au plus. Une date ou un chiffre peut suffire. Varie les modèles (pas deux fois le même d'affilée).
Utilise uniquement les faits fournis ; n'invente ni chiffre, ni date, ni scène. Attribue les anecdotes (« Selon STABILO, … »). Date les chiffres de vente. Mets la source courte en pied de slide (« SOURCE : … »).
Photos : n'utilise que les photos listées, par leur numéro ; sinon laisse photo à null. Une photo actuelle n'est jamais présentée comme une archive.
Modèles disponibles :
${layouts}
Réponds UNIQUEMENT par un objet JSON : {"slides":[{"layout":"…","title":"…","accent":"mot du titre en bleu","text":"…","number":"","prefix":"","photo":1,"photo2":null,"label":"","label2":"","source":"SOURCE : …"}]}

SUJET : ${subject.trim()}

FAITS FOURNIS (seule matière autorisée) :
${facts.trim()}

PHOTOS FOURNIES :
${list}`;
}

/** Taille de titre adaptée à sa longueur (le texte n'est jamais coupé : il passe plus petit). */
export function fitSize(text: string, base: number, comfortable: number, min: number): number {
  const n = [...text].length;
  if (n <= comfortable) return base;
  return Math.max(min, Math.round(base * Math.sqrt(comfortable / n)));
}

export const INVITATION_TEXT = INSPI_CTA;
