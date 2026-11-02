import { AUDREY_VOICE_ID, currentVoiceAsset, type VoiceIdentity } from "./audrey";
import { DEFAULT_VOICE_SPEED } from "./pron";
import { BRAND_NAME } from "./brand";
import { spokenFrench } from "./pron";
import type { GuideMode } from "./guide";

/**
 * Template « Recommandation » — les DONNÉES éditoriales d'un Reel BeeRecos, séparées du montage.
 * Une carte de mise en relation circule d'une séquence à l'autre et change de statut ; le montage
 * (composition.ts) et le son (soundtrack.ts) se recalent sur les durées décrites ici.
 *
 * Conventions d'écriture : un retour à la ligne (\n) = une ligne à l'écran ; *mot* = mot mis en valeur.
 */

/** Durée cible d'un Reel BeeRecos (s). */
export const REEL_MIN_SECONDS = 15;
export const REEL_MAX_SECONDS = 25;

export const SEQUENCES = ["hook", "consequence", "rupture", "value", "steps", "signature", "cta"] as const;
export type SequenceKey = (typeof SEQUENCES)[number];

export const SEQUENCE_LABEL: Record<SequenceKey, string> = {
  hook: "Accroche", consequence: "Conséquence", rupture: "Rupture", value: "Valeur",
  steps: "Démonstration", signature: "Signature", cta: "Appel à l'action",
};

/** Bornes de durée par séquence (s) : lisibilité minimale, rythme maximal. */
export const DURATION_RANGE: Record<SequenceKey, [number, number]> = {
  hook: [1.5, 3], consequence: [1.5, 3], rupture: [1, 2], value: [2, 3.5], steps: [4, 7], signature: [2, 3.5], cta: [3.5, 6],
};

export type StoryStep = { title: string; complement: string };
export type StoryPillar = "reseau_monetise" | "formation" | "digitalisation_ia";

export type StorySpec = {
  title: string;
  pillar: StoryPillar;
  /** Amplitude et rythme des gestes du guide (pictogramme), dans les limites de GUIDE_MOTION. */
  motion: GuideMode;
  /** Étiquettes de la carte qui circule et des trois repères (apporteur, contact, professionnel). */
  card: { label: string; status: string; from: string; contact: string; to: string };
  hook: { text: string; complement: string };
  consequence: { text: string; status: string };
  rupture: { text: string };
  value: { text: string };
  steps: { items: [StoryStep, StoryStep, StoryStep]; footnote: string };
  signature: { tagline: string };
  cta: { verb: string; keyword: string; complement: string };
  durations: Record<SequenceKey, number>;
  /** Voix off : une phrase par séquence (vide = pas de voix sur la séquence). */
  voice: { voiceId: string; lines: Record<SequenceKey, string> };
  /** Fichiers déjà produits (voix par séquence). Une voix n'est utilisée que si son texte correspond encore. */
  assets?: { voice?: Partial<Record<SequenceKey, VoiceAsset>> };
};

export type VoiceAsset = { src: string; duration: number; text: string; voiceId: string } & VoiceIdentity;

/** Exemple de démonstration (pilier réseau d'apporteurs d'affaires). Aucun chiffre, montant ni témoignage. */
export const DEMO_STORY: StorySpec = {
  title: "Ta mise en relation a de la valeur",
  pillar: "reseau_monetise",
  motion: "dynamique",
  card: { label: "Mise en relation", status: "Envoyée", from: "Toi", contact: "Ton contact", to: "Le pro" },
  hook: { text: "TU\nRECOMMANDES.", complement: "Le bon contact. Au bon moment." },
  consequence: { text: "UN CONTRAT\nSE *SIGNE*.", status: "Contrat signé" },
  rupture: { text: "ET\n*TOI* ?" },
  value: { text: "TA RECO\nA DE LA\n*VALEUR*." },
  steps: {
    // Promesse documentée (beerecos-knowledge/business.md) : portefeuille de recommandations des apporteurs,
    // recommandations qualifiées, développement commercial mutuel. Aucune rémunération n'est promise : ses
    // conditions de versement ne sont pas documentées (commercial-parameters.md : DONNÉE MANQUANTE).
    items: [
      { title: "ENREGISTRÉE.", complement: "Dans ton portefeuille de recos." },
      { title: "QUALIFIÉE.", complement: "Un vrai besoin, le bon pro." },
      { title: "RÉCIPROQUE.", complement: "Le réseau te recommande aussi." },
    ],
    footnote: "",
  },
  signature: { tagline: "Un réseau d'affaires digitalisé." },
  cta: { verb: "COMMENTE", keyword: "CLUB", complement: "pour recevoir le lien de visite." },
  durations: { hook: 2, consequence: 2, rupture: 1.5, value: 2.5, steps: 5, signature: 2.5, cta: 4.5 },
  voice: {
    voiceId: AUDREY_VOICE_ID,
    lines: {
      hook: "Tu recommandes un pro.",
      consequence: "Un contrat se signe.",
      rupture: "Et toi ?",
      value: "Ta mise en relation a de la valeur.",
      steps: "Avec BeeRecos, chaque reco est enregistrée, qualifiée, et le réseau te recommande aussi.",
      signature: "Envie de découvrir le réseau ?",
      cta: "Commente CLUB pour recevoir le lien de visite.",
    },
  },
};

export const PILLAR_LABEL: Record<StoryPillar, string> = {
  reseau_monetise: "Réseau d'apporteurs d'affaires", formation: "Formation", digitalisation_ia: "Digitalisation IA",
};

/** Le nom de marque garde sa casse (B et R majuscules), même dans un texte écrit en capitales. */
export const brandCase = (text: string) => text.replace(/beerecos/gi, BRAND_NAME);

/** Texte prononcé : marque phonétisée, liaisons obligatoires écrites, mots en capitales lus comme des mots (pron.ts). */
export const spokenText = (line: string): string => spokenFrench(line);

export const totalDuration = (spec: StorySpec) => round(SEQUENCES.reduce((n, k) => n + spec.durations[k], 0));
export function sequenceStarts(spec: StorySpec): Record<SequenceKey, number> {
  let t = 0;
  const out = {} as Record<SequenceKey, number>;
  for (const k of SEQUENCES) { out[k] = round(t); t += spec.durations[k]; }
  return out;
}
export const round = (n: number) => Math.round(n * 1000) / 1000;

/** Voix utilisable pour une séquence : fichier présent ET produit pour le texte et la voix actuels. */
export function voiceAsset(spec: StorySpec, key: SequenceKey): VoiceAsset | null {
  const a = spec.assets?.voice?.[key];
  const line = spec.voice.lines[key]?.trim();
  return a && line && spec.voice.voiceId === a.voiceId && currentVoiceAsset(a, line, DEFAULT_VOICE_SPEED) ? a : null;
}

export type ParseResult = { ok: true; spec: StorySpec } | { ok: false; errors: string[] };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const AMOUNT = /\d[\d\s.,]*\s?(€|euros?\b|k€)/i;
const PAY = /rémunér|commission|rétribu/i;

/**
 * Validation manuelle (pas de dépendance) : champs présents, longueurs lisibles, durées dans les bornes, CTA unique,
 * et garde-fous éditoriaux — aucun montant affiché, toute rémunération évoquée renvoie aux accords prévus.
 */
export function parseStorySpec(input: unknown): ParseResult {
  const errors: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repris tel quel de BeeMarketing
  const o = (input ?? {}) as Record<string, any>;
  const need = (label: string, v: unknown, max: number) => {
    const s = str(v).trim();
    if (!s) errors.push(`${label} : texte manquant.`);
    else if (s.replace(/[*\n]/g, "").length > max) errors.push(`${label} : ${max} caractères au plus.`);
    return s;
  };
  const durations = {} as Record<SequenceKey, number>;
  for (const k of SEQUENCES) {
    const d = Number(o.durations?.[k]);
    const [min, max] = DURATION_RANGE[k];
    if (!Number.isFinite(d) || d < min || d > max) errors.push(`${SEQUENCE_LABEL[k]} : durée entre ${min} et ${max} s.`);
    durations[k] = Number.isFinite(d) ? round(d) : min;
  }
  const items = Array.isArray(o.steps?.items) ? o.steps.items : [];
  if (items.length !== 3) errors.push("Démonstration : trois étapes exactement.");
  const steps = [0, 1, 2].map((i) => ({
    title: need(`Étape ${i + 1}`, items[i]?.title, 16),
    complement: need(`Étape ${i + 1} (complément)`, items[i]?.complement, 40),
  })) as [StoryStep, StoryStep, StoryStep];
  const keyword = str(o.cta?.keyword).trim().toUpperCase();
  if (!/^[A-ZÀ-Ý0-9]{2,12}$/.test(keyword)) errors.push("Appel à l'action : un seul mot-clé en majuscules, sans espace (ex. CLUB).");
  const lines = {} as Record<SequenceKey, string>;
  for (const k of SEQUENCES) lines[k] = str(o.voice?.lines?.[k]).trim().slice(0, 160);

  const spec: StorySpec = {
    title: need("Titre interne", o.title, 80),
    pillar: (["reseau_monetise", "formation", "digitalisation_ia"] as const).includes(o.pillar) ? o.pillar : "reseau_monetise",
    motion: o.motion === "discret" ? "discret" : "dynamique",
    card: {
      label: need("Carte", o.card?.label, 22), status: need("Statut initial de la carte", o.card?.status, 18), from: need("Repère apporteur", o.card?.from, 12),
      contact: need("Repère contact", o.card?.contact, 14), to: need("Repère professionnel", o.card?.to, 12),
    },
    hook: { text: brandCase(need("Accroche", o.hook?.text, 28)), complement: brandCase(str(o.hook?.complement).trim().slice(0, 48)) },
    consequence: { text: brandCase(need("Conséquence", o.consequence?.text, 28)), status: need("Statut de la carte", o.consequence?.status, 18) },
    rupture: { text: brandCase(need("Rupture", o.rupture?.text, 14)) },
    value: { text: brandCase(need("Valeur", o.value?.text, 32)) },
    steps: { items: steps, footnote: str(o.steps?.footnote).trim().slice(0, 48) },
    signature: { tagline: brandCase(need("Signature", o.signature?.tagline, 44)) },
    cta: { verb: need("Appel à l'action (verbe)", o.cta?.verb, 12), keyword, complement: brandCase(need("Appel à l'action (complément)", o.cta?.complement, 44)) },
    durations,
    voice: { voiceId: str(o.voice?.voiceId) || AUDREY_VOICE_ID, lines },
    assets: o.assets && typeof o.assets === "object" ? o.assets : undefined,
  };

  const shown = [spec.hook.text, spec.hook.complement, spec.consequence.text, spec.consequence.status, spec.value.text,
    ...steps.flatMap((s) => [s.title, s.complement]), spec.signature.tagline, spec.cta.complement];
  if ([...shown, ...Object.values(lines)].some((t) => AMOUNT.test(t))) errors.push("Aucun montant : la vidéo n'affiche ni ne promet de somme.");
  const mentionsPay = [...shown, ...Object.values(lines)].some((t) => PAY.test(t));
  if (mentionsPay && !/selon les accords prévus/i.test(`${spec.steps.footnote} ${Object.values(lines).join(" ")}`)) {
    errors.push("Rémunération évoquée : garde la mention « selon les accords prévus » (renvoi ou voix off).");
  }
  if (steps.some((s) => s.complement.includes("*")) && !spec.steps.footnote.startsWith("*")) {
    errors.push("Démonstration : l'astérisque doit renvoyer à une mention commençant par « * ».");
  }
  const total = SEQUENCES.reduce((n, k) => n + durations[k], 0);
  if (total < REEL_MIN_SECONDS || total > REEL_MAX_SECONDS) errors.push(`Le Reel doit durer entre ${REEL_MIN_SECONDS} et ${REEL_MAX_SECONDS} s (actuellement ${round(total)} s).`);
  if (shown.some((t) => /\d/.test(t))) errors.push("Aucun chiffre à l'écran : la vidéo n'affiche ni nombre ni résultat.");
  return errors.length ? { ok: false, errors } : { ok: true, spec };
}
