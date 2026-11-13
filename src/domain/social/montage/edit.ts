import { DIRECTOR_INTENSITIES } from "./director";
import { CAPTION_MODES } from "./caption-modes";
import { z } from "zod";

/**
 * Montage d'une vidéo tournée, décrit par un seul fichier `<projet>.edit.json` (source de vérité).
 * Règle d'or : TOUS les temps sont en millisecondes de la prise d'origine, jamais du temps monté.
 * Recouper un silence ne décale donc aucune animation : chaque instant reste ancré sur un mot prononcé.
 * Plusieurs prises (lot S3 bis) : elles sont posées bout à bout sur une « bande de prises » (prise 1 de 0 à d1,
 * prise 2 de d1 à d1 + d2…) et tous les temps sont ceux de cette bande ; un morceau ne chevauche jamais deux prises.
 */

const ms = z.number().int("nombre entier de millisecondes attendu").min(0, "doit être positif ou nul");
/** Nom de fichier simple, à côté du fichier edit.json : aucun chemin, aucun caractère spécial. */
const fileName = (ext: RegExp, kind: string) =>
  z.string().regex(/^[\w.-]+$/, "nom de fichier simple attendu (lettres, chiffres, . _ -)").regex(ext, `fichier ${kind} attendu`);

/**
 * Accent : « bleu » seulement (décision du 2026-10-22). Les montages enregistrés avant en « violet » ou « vert » se
 * relisent en bleu, sans erreur : ils passent à la charte au prochain enregistrement.
 */
export const AccentSchema = z.preprocess((v) => (v === "violet" || v === "vert" ? "bleu" : v), z.enum(["bleu"]).default("bleu"));

export const RangeSchema = z.strictObject({ fromMs: ms, toMs: ms });

export const PlacementSchema = z.strictObject({
  x: z.number().min(-1080).max(1080).default(0),
  y: z.number().min(-1920).max(1920).default(0),
  scale: z.number().min(.25).max(2).default(1),
  opacity: z.number().min(0).max(1).default(1),
  enter: z.enum(["native", "fade", "slide"]).default("native"),
  exit: z.enum(["none", "fade"]).default("none"),
});
export type Placement = z.infer<typeof PlacementSchema>;

export const CustomAnimationSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).optional(),
  groupId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).optional(),
  name: z.string().regex(/^[a-z0-9-]+$/, "nom d'animation en minuscules (a-z, 0-9, -)"),
  fromMs: ms,
  toMs: ms,
  props: z.record(z.string(), z.unknown()).default({}),
  label: z.string().max(80).optional(),
  /** Version BeeMotion figée à l'enregistrement ; absente = montage antérieur, rendu avec la version courante. */
  version: z.number().int().min(1).max(999).optional(),
  placement: PlacementSchema.optional(),
  /**
   * Intensité du mouvement (Studio animations, 2026-11-11) : 0 = immobile, 1 = réglage de l'effet, 2 = deux fois plus
   * ample. Absente = 1 (rendu d'avant).
   */
  intensite: z.number().min(0).max(2).optional(),
  /**
   * Repères (Studio animations, 2026-11-11) : instants de la PRISE (ms, temps source) où chaque élément de l'effet
   * apparaît (ligne d'une checklist, étape d'un parcours, capsule). En temps source : ils suivent les coupes comme le
   * début de l'animation. Absents = éléments répartis régulièrement.
   */
  reperes: z.array(ms).max(12, "12 repères au plus").optional(),
}).refine((c) => c.name !== "logo-fin" || c.placement?.enter !== "slide", "Le logo officiel s’anime uniquement en opacité.");

export const SoundSchema = z.strictObject({
  file: fileName(/\.(mp3|wav|m4a|aac|ogg)$/i, "audio (.mp3, .wav, .m4a, .aac, .ogg)"),
  atMs: ms,
  volume: z.number().min(0).max(1).default(1),
  durationMs: ms.optional(),
  /** Musique (Instagram BeeRecos, 2026-11-03) : volume baissé automatiquement pendant la voix (absent = inchangé). */
  duck: z.strictObject({ volume: z.number().min(0).max(1).default(0.2) }).optional(),
});

/**
 * Illustration vidéo (B-roll, Instagram BeeRecos, 2026-11-03) : clip de la bibliothèque posé par-dessus la prise,
 * en temps de la bande source comme les animations (il suit les coupes), sans son (la voix reste celle de la prise).
 * `clipInMs` : point d'entrée dans le clip ; `focusX` : cadrage horizontal d'un clip 16:9 dans le 9:16 (0 à 100 %).
 */
export const BrollSchema = z.strictObject({
  file: fileName(/\.(mp4|mov|webm)$/i, "vidéo (.mp4, .mov, .webm)"),
  fromMs: ms,
  toMs: ms,
  clipInMs: ms.default(0),
  focusX: z.number().min(0).max(100).default(50),
}).refine((b) => b.toMs - b.fromMs >= 300, "un clip d'illustration dure au moins 0,3 s");

/** Réglages des sous-titres (repères de montage, voir CAPTION_DEFAULTS) : zone haute, largeur et corps. */
export const CaptionStyleSchema = z.strictObject({
  fontFamily: z.enum(["Poppins", "Caveat"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  highlightColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  top: z.number().int().min(900, "doit être à 900 px au moins (zone trop haute)").max(1700, "doit être à 1700 px au plus (zone trop basse)").optional(),
  maxWidth: z.number().int().min(400).max(1000).optional(),
  fontSize: z.number().int().min(32).max(120).optional(),
  /** Style des sous-titres (caption-modes.ts) : absent = « Highlight », le rendu d'avant. */
  mode: z.enum(CAPTION_MODES).optional(),
  /** Mots d'accentuation (Studio, 2026-11-11) : couleur, fond ou taille ; absent = « couleur ». */
  accent: z.enum(["couleur", "fond", "taille"]).optional(),
});

/**
 * Zoom d'accentuation (Studio, 2026-11-11), en temps de la prise (il suit les coupes) : « accent » = rapprochement
 * rapide puis retour fluide, « progressif » = rapprochement lent pendant une explication puis retour. Amplitude 3 à
 * 20 %, ancrée sur le point focal (visage : 50 % / 32 % par défaut, faute de détection automatique du visage).
 */
export const ZoomSchema = z.strictObject({
  fromMs: ms, toMs: ms,
  type: z.enum(["accent", "progressif"]).default("accent"),
  amplitude: z.number().min(1.03, "doit être à 103 % au moins").max(1.2, "doit être à 120 % au plus").default(1.08),
  focusX: z.number().min(0).max(100).default(50),
  focusY: z.number().min(0).max(100).default(32),
});
export type Zoom = z.infer<typeof ZoomSchema>;

/**
 * Mise en page de la vidéo (Studio, 2026-11-11), en temps de la prise : « carte » = la vidéo réduite dans une carte
 * arrondie sous un titre ; « mosaique » = la carte vidéo rejoint une grille de miniatures (images de la bibliothèque).
 */
export const LayoutSchema = z.strictObject({
  fromMs: ms, toMs: ms,
  type: z.enum(["carte", "mosaique"]).default("carte"),
  titre: z.string().trim().max(48).optional(),
  texte: z.string().trim().max(90).optional(),
  fond: z.enum(["blanc", "bleu", "noir"]).default("blanc"),
  images: z.array(fileName(/\.(png|jpe?g|webp)$/i, "image (.png, .jpg, .webp)")).max(5, "5 images au plus").optional(),
}).refine((l) => l.type !== "mosaique" || (l.images?.length ?? 0) >= 1, "La mosaïque demande au moins une image de la bibliothèque.");
export type Layout = z.infer<typeof LayoutSchema>;

/**
 * Rythme du montage (lot S6, Reels dynamiques) : zoom alterné à chaque coupe (plan large / plan serré, l'astuce des
 * montages face caméra qui cache les coupes) et un son de la bibliothèque joué à l'entrée de chaque animation.
 */
export const RythmeSchema = z.strictObject({
  zoomCoupes: z.boolean().default(false),
  /** Échelle du plan serré (1,10 = 110 %). */
  zoom: z.number().min(1.04, "doit être à 104 % au moins").max(1.2, "doit être à 120 % au plus").default(1.1),
  /** Son de la bibliothèque joué à l'entrée de chaque animation (absent = aucun). */
  sonAnimations: fileName(/\.(mp3|wav|m4a|aac|ogg)$/i, "audio (.mp3, .wav, .m4a, .aac, .ogg)").optional(),
  volumeSon: z.number().min(0).max(1).default(0.35),
  /** Auto Director (director.ts) : changements de plan aux moments forts. Absent = désactivé (rendu d'avant). */
  director: z.enum(DIRECTOR_INTENSITIES).optional(),
});
export type Rythme = z.infer<typeof RythmeSchema>;

/** Style Motion (2026-10-25) : absent = rendu d'avant. */
export const MotionRhythmSchema = z.enum(["pose", "dynamique", "tres_dynamique"]);
export type MotionRhythm = z.infer<typeof MotionRhythmSchema>;
export const MotionStyleSchema = z.strictObject({
  nom: z.literal("motion"),
  rythme: MotionRhythmSchema.default("dynamique"),
  musique: z.boolean().default(false),
});
export type MotionStyle = z.infer<typeof MotionStyleSchema>;

/**
 * Effets sonores SFX Kit (Wyzowl, CC0, 2026-11-12) : une entrée par occurrence (plusieurs occurrences d'un même son
 * possibles). Le placement est calculé à chaque lecture (sons.ts), avec la règle du kit : début du son = instant visé −
 * sync.at. L'ancrage dit à quoi le son est relié :
 * - « libre » : début du FICHIER posé à un instant de la prise (ms, temps source : il suit le passage filmé) ;
 * - « animation » : relié à une animation (son début ou sa fin) ; il la suit quand elle bouge, se tait si elle disparaît ;
 * - « repere » : instant de la prise visé par la génération automatique (zoom, transition, mise en page) ;
 * - « logo » : apparition de la vidéo de fin officielle.
 * `decalageMs` : réglage de l'utilisateur, ajouté à l'instant visé. `dureeMs` : durée utile maximale (coupe la fin).
 * Origine « auto » : `cle` identifie l'événement (pas de doublon à la relance) ; `modifie` liste ce que l'utilisateur
 * a changé à la main et que la relance doit garder.
 */
export const SON_LIB = "sfx-kit@1.0.0";
const occurrenceId = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const SonAncreSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("libre"), debutMs: ms }),
  z.strictObject({ type: z.literal("animation"), animId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), point: z.enum(["debut", "fin"]).default("debut") }),
  z.strictObject({ type: z.literal("repere"), atMs: ms, nature: z.enum(["zoom", "transition", "mise-en-page"]) }),
  z.strictObject({ type: z.literal("logo") }),
]);
export const SonSchema = z.strictObject({
  id: occurrenceId,
  son: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "identifiant de son SFX Kit attendu"),
  lib: z.literal(SON_LIB).default(SON_LIB),
  ancre: SonAncreSchema,
  decalageMs: z.number().int().min(-3000).max(3000).default(0),
  volume: z.number().min(0).max(1.5).default(0.7),
  muet: z.boolean().default(false),
  dureeMs: z.number().int().min(50).max(30_000).optional(),
  fonduEntreeMs: z.number().int().min(0).max(2000).optional(),
  fonduSortieMs: z.number().int().min(0).max(3000).optional(),
  origine: z.enum(["manuel", "auto"]).default("manuel"),
  cle: z.string().regex(/^[a-zA-Z0-9:_-]{1,140}$/).optional(),
  modifie: z.array(z.enum(["son", "volume", "muet", "decalage"])).max(4).optional(),
});
export type Son = z.infer<typeof SonSchema>;
export type SonAncre = z.infer<typeof SonAncreSchema>;

const videoFile = () => fileName(/\.(mp4|mov|m4v|webm)$/i, "vidéo (.mp4, .mov, .m4v, .webm)");

/** Nombre de prises et durée cumulée maximale d'un montage (décision du 2026-10-22). */
export const MAX_TAKES = 6;
export const MAX_STRIP_MS = 600_000;

/** Une prise de la bande, dans l'ordre d'envoi. */
export const TakeSchema = z.strictObject({ file: videoFile(), durationMs: ms.min(1000, "prise trop courte (1 s minimum)") });

/** Détourage d'une prise (lot S5) : la personne seule sur fond transparent, vidéo WebM VP9 avec alpha. */
export const matteFile = () => fileName(/\.webm$/i, "de détourage (.webm avec transparence)");

export const EditSchema = z.strictObject({
  video: videoFile(),
  /** Prises bout à bout (absent = une seule prise, `video`). La première est `video`. */
  takes: z.array(TakeSchema).min(1).max(MAX_TAKES, `doit compter ${MAX_TAKES} prises au plus`).optional(),
  /** Détourage par prise (lot S5) : nom de la prise → fichier de détourage, posé à côté. Sert au titre derrière le sujet. */
  mattes: z.record(z.string(), matteFile()).optional(),
  captions: fileName(/\.json$/i, "de sous-titres (.json)").optional(),
  /** Accent de la vidéo : le bleu BeeRecos seul (brand.ts). */
  accent: AccentSchema,
  /** Morceaux GARDÉS de la prise, dans l'ordre (coupes sèches entre eux). */
  ranges: z.array(RangeSchema).min(1, "au moins un morceau à garder"),
  subtitles: z.boolean().default(true),
  captionStyle: CaptionStyleSchema.default({}),
  /** Gain de la voix (1 = inchangé, 3,98 = +12 dB au maximum). */
  /**
   * Cadrage : `focusX` / `focusY` (0 à 100 %, Instagram BeeRecos 2026-11-03) choisissent la partie gardée d'une prise
   * plus large ou plus haute que le 9:16 (paysage : gauche → droite) ; x / y décalent l'image ; `scale` zoome.
   */
  framing: z.strictObject({x:z.number().min(-540).max(540),y:z.number().min(-960).max(960),scale:z.number().min(1).max(2),focusX:z.number().min(0).max(100).optional(),focusY:z.number().min(0).max(100).optional()}).optional(),
  outro: z.strictObject({durationMs:z.literal(2000),baseline:z.boolean().default(true)}).optional(),
  voiceGain: z.number().min(0).max(3.98).default(1),
  custom: z.array(CustomAnimationSchema).default([]),
  /** Choix explicites pour les propositions de Bee ; absent = ancien montage, [] = sans animations IA. */
  animationChoices: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(100)
    .refine((names) => new Set(names).size === names.length, "chaque animation se choisit une seule fois").optional(),
  sounds: z.array(SoundSchema).default([]),
  /** Clips d'illustration (B-roll) : absent = aucun. */
  broll: z.array(BrollSchema).max(30, "30 clips d'illustration au plus").optional(),
  /** Rythme (lot S6) : absent = montage d'avant, sans zoom ni son d'animation. */
  rythme: RythmeSchema.optional(),
  /** Style Motion (2026-10-25) : absent = rendu d'avant. */
  style: MotionStyleSchema.optional(),
  /**
   * Storyboard en cartes (refonte du Studio, 2026-11-10) : statut décidé par l'utilisateur pour une séquence, repérée
   * par son début dans la prise (ms, temps source). Absent = toutes les cartes en « Suggestion IA ».
   */
  sceneMarks: z.record(z.string().regex(/^\d{1,9}$/), z.enum(["validated", "modified"]))
    .refine((m) => Object.keys(m).length <= 200, "200 séquences au plus").optional(),
  /**
   * Accents sonores des animations (Studio animations, 2026-11-11) : clic à une validation, saisie sur un CTA, glissé à
   * l'entrée d'une carte. Absent ou inactif = aucun son ajouté (rendu d'avant). Volume par type, voix toujours devant.
   */
  effetsSonores: z.strictObject({
    actif: z.boolean().default(false),
    volumes: z.strictObject({
      clic: z.number().min(0).max(1).default(0.22),
      saisie: z.number().min(0).max(1).default(0.18),
      glisse: z.number().min(0).max(1).default(0.2),
    }).default({ clic: 0.22, saisie: 0.18, glisse: 0.2 }),
  }).optional(),
  /** Mots d'accentuation des sous-titres : début de chaque mot dans la prise (ms, temps source, survit aux coupes). */
  motsAccent: z.array(ms).max(80, "80 mots d'accentuation au plus").optional(),
  /** Zooms d'accentuation et rapprochements progressifs (absent = aucun). */
  zooms: z.array(ZoomSchema).max(40, "40 zooms au plus").optional(),
  /** Vidéo en carte ou en mosaïque (absent = plein cadre). */
  miseEnPage: z.array(LayoutSchema).max(20, "20 mises en page au plus").optional(),
  /** Effets sonores SFX Kit (absent = aucun : ancien montage, piste d'effets vide). */
  sons: z.array(SonSchema).max(200, "200 effets sonores au plus").refine((l) => new Set(l.map((x) => x.id)).size === l.length, "chaque effet sonore a un identifiant unique").optional(),
  /** Réglages des effets : « Son automatique » (désactivé par défaut) et volume global des effets. */
  sonsReglages: z.strictObject({ auto: z.boolean().default(false), volume: z.number().min(0).max(1.5).default(1) }).optional(),
  /** Événements dont l'utilisateur a supprimé le son automatique : la relance ne les recrée pas. */
  sonsAutoIgnores: z.array(z.string().regex(/^[a-zA-Z0-9:_-]{1,140}$/)).max(400).optional(),
  /** Optional official BeeRecos logo, kept separate from timed animation cards. */
  logo: z.strictObject({
    width: z.number().int().min(150).max(360).default(220),
    right: z.number().int().min(40).max(300).default(170),
    bottom: z.number().int().min(80).max(600).default(260),
    opacity: z.number().min(.35).max(1).default(1),
  }).optional(),
});

export type Edit = z.infer<typeof EditSchema>;
export type Range = z.infer<typeof RangeSchema>;
export type Take = z.infer<typeof TakeSchema>;

/** Prise posée sur la bande : [fromMs, toMs) de la bande. */
export type PlacedTake = { file: string; fromMs: number; toMs: number };

/** Prises posées bout à bout ; sans liste de prises, la seule prise couvre toute la bande. */
export function takeStrip(edit: Pick<Edit, "video" | "takes">): PlacedTake[] {
  if (!edit.takes?.length) return [{ file: edit.video, fromMs: 0, toMs: Number.POSITIVE_INFINITY }];
  let at = 0;
  return edit.takes.map((t) => {
    const placed = { file: t.file, fromMs: at, toMs: at + t.durationMs };
    at += t.durationMs;
    return placed;
  });
}

/** Début (ms de la bande) de chaque prise après la première : un raccord de prise. */
export const takeBreaks = (edit: Pick<Edit, "video" | "takes">) => takeStrip(edit).slice(1).map((t) => t.fromMs);

/** Numéro (0, 1…) de la prise qui contient cet instant de la bande. */
export function takeIndexAt(strip: PlacedTake[], ms: number): number {
  const i = strip.findIndex((t) => ms < t.toMs);
  return i < 0 ? strip.length - 1 : i;
}

/** Coupe les morceaux aux raccords de prises (sans rien changer au montage obtenu : les morceaux restent bout à bout). */
export function splitAtTakes(ranges: Range[], breaks: number[]): Range[] {
  if (!breaks.length) return ranges;
  const out: Range[] = [];
  for (const r of ranges) {
    let from = r.fromMs;
    for (const b of breaks) if (b > from && b < r.toMs) { out.push({ fromMs: from, toMs: b }); from = b; }
    out.push({ fromMs: from, toMs: r.toMs });
  }
  return out;
}

/** Mot du transcript (fichier `<projet>.json`), temps en ms de la prise. */
export const CaptionWordSchema = z.object({ text: z.string(), startMs: ms, endMs: ms });
export const CaptionsSchema = z.array(CaptionWordSchema);
export type CaptionWord = z.infer<typeof CaptionWordSchema>;

const TYPES: Record<string, string> = { number: "nombre", string: "texte", boolean: "vrai/faux", array: "liste", object: "objet" };

function pathOf(path: PropertyKey[]): string {
  return path.reduce<string>((s, k) => (typeof k === "number" ? `${s}[${k}]` : s ? `${s}.${String(k)}` : String(k)), "") || "(racine)";
}

/** Traduit une erreur zod en une ligne française lisible : « • ranges[0].toMs → nombre attendu ». */
export function formatIssue(issue: z.core.$ZodIssue): string {
  const at = pathOf(issue.path);
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined ? `• ${at} → clé obligatoire manquante` : `• ${at} → ${TYPES[issue.expected] ?? issue.expected} attendu`;
    case "unrecognized_keys":
      return `• ${at} → clé inconnue : ${issue.keys.join(", ")}`;
    case "invalid_value":
      return `• ${at} → valeur non autorisée — choix possibles : ${issue.values.map(String).join(", ")}`;
    case "too_small":
      return issue.origin === "array" ? `• ${at} → ${issue.message.startsWith("au moins") ? issue.message : `au moins ${issue.minimum} élément(s)`}` : `• ${at} → ${/^(doit|au moins)/.test(issue.message) ? issue.message : `minimum ${issue.minimum}`}`;
    case "too_big":
      return issue.origin === "string" ? `• ${at} → ${issue.maximum} caractères maximum` : `• ${at} → ${/^doit/.test(issue.message) ? issue.message : `maximum ${issue.maximum}`}`;
    default:
      return `• ${at} → ${issue.message}`;
  }
}

/** Vérifications que le schéma ne peut pas exprimer : ordre des morceaux, fenêtres valides. */
export function checkCoherence(edit: Edit): string[] {
  const errors: string[] = [];
  edit.ranges.forEach((r, i) => {
    if (r.toMs <= r.fromMs) errors.push(`• ranges[${i}] → toMs (${r.toMs}) doit être après fromMs (${r.fromMs})`);
    const prev = edit.ranges[i - 1];
    if (prev && r.fromMs < prev.toMs) errors.push(`• ranges[${i}] → chevauche ou précède le morceau précédent (début ${r.fromMs} < fin ${prev.toMs}) : les morceaux doivent être triés sans chevauchement`);
  });
  if (edit.takes?.length) {
    if (edit.takes[0].file !== edit.video) errors.push("• takes[0] → la première prise doit être la vidéo du montage (video)");
    const files = new Set<string>();
    edit.takes.forEach((t, i) => {
      if (files.has(t.file)) errors.push(`• takes[${i}] → prise « ${t.file} » en double`);
      files.add(t.file);
    });
    const strip = edit.takes.reduce((n, t) => n + t.durationMs, 0);
    if (strip > MAX_STRIP_MS) errors.push(`• takes → ${MAX_STRIP_MS / 60_000} min de prises au plus en tout (${Math.round(strip / 1000)} s)`);
    const last = edit.ranges[edit.ranges.length - 1];
    if (last && last.toMs > strip) errors.push(`• ranges → le dernier morceau finit après la dernière prise (${last.toMs} > ${strip} ms)`);
  }
  if (edit.mattes) {
    const files = new Set(takeStrip(edit).map((t) => t.file));
    const seen = new Set<string>();
    for (const [take, matte] of Object.entries(edit.mattes)) {
      if (!files.has(take)) errors.push(`• mattes.${take} → aucune prise de ce nom dans le montage`);
      if (files.has(matte) || seen.has(matte)) errors.push(`• mattes.${take} → « ${matte} » est déjà une prise ou un autre détourage`);
      seen.add(matte);
    }
  }
  const end = edit.ranges[edit.ranges.length - 1]?.toMs ?? 0;
  edit.custom.forEach((c, i) => {
    if (c.toMs <= c.fromMs) errors.push(`• custom[${i}] → toMs (${c.toMs}) doit être après fromMs (${c.fromMs})`);
    if (c.fromMs >= end) errors.push(`• custom[${i}] → commence après la fin du montage (${end} ms)`);
  });
  edit.sounds.forEach((s, i) => {
    if (s.atMs >= end) errors.push(`• sounds[${i}] → placé après la fin du montage (${end} ms)`);
  });
  return errors;
}

export type ParseResult = { ok: true; edit: Edit } | { ok: false; errors: string[] };

/**
 * Point d'entrée unique : schéma strict (clé inconnue = erreur) puis cohérence, erreurs en français. Avec plusieurs
 * prises, un morceau qui franchit un raccord est coupé en deux à ce raccord (chaque morceau lit une seule prise).
 */
export function parseEdit(input: unknown): ParseResult {
  const parsed = EditSchema.safeParse(input, { reportInput: true });
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map(formatIssue) };
  const errors = checkCoherence(parsed.data);
  if (errors.length) return { ok: false, errors };
  const breaks = takeBreaks(parsed.data);
  return { ok: true, edit: breaks.length ? { ...parsed.data, ranges: splitAtTakes(parsed.data.ranges, breaks) } : parsed.data };
}

/** Morceau posé sur la sortie : [fromMs, toMs) de la prise, joué à partir de `atMs` du montage. */
export type Segment = Range & { atMs: number };

/** Pose les morceaux gardés bout à bout. */
export function layout(ranges: Range[]): Segment[] {
  let at = 0;
  return ranges.map((r) => {
    const seg = { ...r, atMs: at };
    at += r.toMs - r.fromMs;
    return seg;
  });
}

export const totalMs = (segments: Segment[]) => {
  const last = segments[segments.length - 1];
  return last ? last.atMs + last.toMs - last.fromMs : 0;
};

/**
 * `F(ms)` : temps de la prise → temps du montage. Un instant tombé dans une coupe saute au début du
 * morceau suivant (l'animation démarre au raccord) ; après le dernier morceau, c'est la fin du montage.
 */
export function toOutputMs(segments: Segment[], sourceMs: number): number {
  for (const s of segments) {
    if (sourceMs < s.fromMs) return s.atMs;
    if (sourceMs < s.toMs) return s.atMs + sourceMs - s.fromMs;
  }
  return totalMs(segments);
}

/** Mot recalé sur le montage, avec le numéro du morceau qui le contient (pour changer de page à chaque raccord). */
/** Mot recalé sur le montage ; `sourceMs` = son début dans la prise (repère stable, il survit aux coupes). */
export type PlacedWord = CaptionWord & { segment?: number; sourceMs?: number };

/** Recale le transcript sur le montage : un mot est gardé si son milieu tombe dans un morceau. */
export function remapCaptions(words: CaptionWord[], segments: Segment[]): PlacedWord[] {
  const out: PlacedWord[] = [];
  for (const w of words) {
    const mid = (w.startMs + w.endMs) / 2;
    const segment = segments.findIndex((x) => mid >= x.fromMs && mid < x.toMs);
    if (segment < 0) continue;
    const s = segments[segment];
    const clamp = (t: number) => s.atMs + Math.min(Math.max(t, s.fromMs), s.toMs) - s.fromMs;
    out.push({ text: w.text, startMs: clamp(w.startMs), endMs: clamp(w.endMs), segment, sourceMs: w.startMs });
  }
  return out;
}

export type CaptionPage = { startMs: number; endMs: number; words: PlacedWord[] };

/**
 * Pages de sous-titres karaoké (temps du montage) : 4 mots et 26 caractères au plus en vertical,
 * nouvelle page après une fin de phrase, à chaque raccord et après un silence de plus de 650 ms. Une page reste affichée jusqu'à la suivante si l'écart est court.
 */
export function captionPages(words: PlacedWord[], opts: { maxWords?: number; maxChars?: number; gapMs?: number } = {}): CaptionPage[] {
  const { maxWords = 4, maxChars = 26, gapMs = 650 } = opts;
  const pages: CaptionPage[] = [];
  let cur: PlacedWord[] = [];
  const flush = () => {
    if (cur.length) pages.push({ startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs, words: cur });
    cur = [];
  };
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    const word = { ...w, text };
    const prev = cur[cur.length - 1];
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + text.length;
    const breakAfterPrev = prev && (/[.?!…]$/.test(prev.text) || prev.segment !== word.segment);
    if (cur.length && (breakAfterPrev || cur.length >= maxWords || chars > maxChars || word.startMs - prev.endMs > gapMs)) flush();
    cur.push(word);
  }
  flush();
  pages.forEach((p, i) => {
    const next = pages[i + 1];
    if (next && next.startMs - p.endMs <= gapMs) p.endMs = next.startMs;
  });
  return pages;
}
