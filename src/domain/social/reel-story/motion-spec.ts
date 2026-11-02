import { AUDREY_VOICE_ID, currentVoiceAsset, type VoiceIdentity } from "./audrey";
import { brandCase, PILLAR_LABEL, type StoryPillar } from "./spec";
import { DEFAULT_VOICE_SPEED } from "./pron";

/**
 * Style « Motion BeeRecos - Dynamique » (prompt du Studio IA du 2026-10-23, film de présentation validé par Cédric) :
 * une vidéo graphique en scènes, chacune = une phrase de voix + un état visuel (titre, cartes, personnes, chapitre
 * bleu, piliers, appel à l'action, signature). Les DONNÉES sont ici ; la mise en scène est dans motion-composition.ts,
 * le son dans motion-soundtrack.ts. Trois réglages seulement : rythme, quantité de texte, présence humaine.
 */

export const MOTION_STYLE_ID = "motion-beerecos-dynamique";
export const MOTION_STYLE_LABEL = "Motion BeeRecos - Dynamique";

export type MotionRhythm = "pose" | "dynamique" | "tres_dynamique";
export type MotionTextAmount = "minimal" | "equilibre" | "riche";
export type MotionPresence = "graphique" | "mascotte" | "intervenant";
export type MotionSettings = { rythme: MotionRhythm; texte: MotionTextAmount; presence: MotionPresence };

export const RHYTHM_LABEL: Record<MotionRhythm, string> = { pose: "Posé", dynamique: "Dynamique", tres_dynamique: "Très dynamique" };
export const TEXT_LABEL: Record<MotionTextAmount, string> = { minimal: "Minimal (le mot clé)", equilibre: "Équilibré (titre court)", riche: "Riche (titre + précision)" };
export const PRESENCE_LABEL: Record<MotionPresence, string> = { graphique: "Graphique (pastilles)", mascotte: "Mascotte BeeRecos", intervenant: "Intervenant filmé" };

/** États visuels disponibles : un seul motif dominant par scène (cercle pour les personnes, carré arrondi pour les cartes). */
export const MOTION_VISUALS = ["titre", "relation", "marque", "liste", "chapitre", "piliers", "personnes", "cta", "signature"] as const;
export type MotionVisual = (typeof MOTION_VISUALS)[number];
export const VISUAL_LABEL: Record<MotionVisual, string> = {
  titre: "Titre + personnes", relation: "Deux cartes reliées", marque: "Logo + promesse", liste: "Liste de cartes",
  chapitre: "Chapitre bleu", piliers: "Trois piliers", personnes: "Cercle de personnes", cta: "Appel à l'action", signature: "Signature",
};

/** Rôle narratif facultatif d'une scène (même structure que le storyboard du montage, src/lib/montage/narrative.ts). */
export const MOTION_NARRATIVE_ROLES = ["HOOK", "LEAD", "BODY_1", "OPEN_LOOP_1", "BODY_2", "OPEN_LOOP_2", "BODY_3", "CTA"] as const;
export type MotionNarrativeRole = (typeof MOTION_NARRATIVE_ROLES)[number];
export const MOTION_ROLE_LABEL: Record<MotionNarrativeRole, string> = {
  HOOK: "Hook", LEAD: "Lead", BODY_1: "Body 1", OPEN_LOOP_1: "Open loop", BODY_2: "Body 2", OPEN_LOOP_2: "Open loop", BODY_3: "Payoff", CTA: "CTA",
};

export type MotionScene = {
  id: string;
  /** Rôle narratif (facultatif : une scène d'avant le moteur narratif n'en a pas). */
  role?: MotionNarrativeRole;
  visual: MotionVisual;
  /** Phrase exacte de la voix off (les sous-titres la suivent mot à mot). */
  voice: string;
  /** Texte à l'écran : 3 à 7 mots ; un retour à la ligne (\n) = une ligne. */
  title: string;
  /** Précision affichée en quantité de texte « riche ». */
  subtitle?: string;
  /** Mot pivot (appuyé par la voix) : punch d'animation, réaction de la mascotte, seul mot en SemiBold. */
  pivot?: string;
  /** Libellés des cartes / pastilles / piliers (3 au plus). */
  items?: string[];
};

export type MotionWord = { text: string; start: number; end: number };
export type MotionVoiceAsset = { src: string; duration: number; text: string; voiceId: string; words: MotionWord[] } & VoiceIdentity;

export type MotionSpec = {
  kind: "motion";
  style: typeof MOTION_STYLE_ID;
  title: string;
  objective: string;
  pillar: StoryPillar;
  /** Durée visée (s) ; la durée réelle suit la voix produite. */
  targetSeconds: number;
  settings: MotionSettings;
  scenes: MotionScene[];
  cta: { keyword: string; complement: string };
  voice: { provider: "heygen" | "kokoro"; voiceId: string; speed: number };
  assets?: { voice?: Record<string, MotionVoiceAsset> };
};

export const MOTION_MIN_SECONDS = 15;
export const MOTION_MAX_SECONDS = 60;

/** Voix par défaut : HeyGen « Audrey » obligatoire pour les nouvelles générations ; parsing historique conservé. */
export const MOTION_VOICES = {
  heygen: [{ id: AUDREY_VOICE_ID, label: "Audrey (HeyGen, française)" }],
  kokoro: [{ id: "ff_siwis", label: "Siwis (Kokoro, locale)" }],
} as const;

/** Film de présentation BeeRecos (validé le 2026-10-23) : exemple et point de départ du style. */
export const DEMO_MOTION: MotionSpec = {
  kind: "motion",
  style: MOTION_STYLE_ID,
  title: "Présentation BeeRecos",
  objective: "Faire découvrir les trois piliers et amener à commenter CLUB pour préparer une visite de club",
  pillar: "reseau_monetise",
  targetSeconds: 45,
  settings: { rythme: "dynamique", texte: "equilibre", presence: "mascotte" },
  scenes: [
    { id: "s1", visual: "titre", voice: "Ton prochain client est peut-être déjà dans le réseau de quelqu’un d’autre.", title: "Ton prochain\nclient", subtitle: "Dans son réseau.", pivot: "client", items: ["Client potentiel"] },
    { id: "s2", visual: "relation", voice: "Et si tu créais la rencontre ?", title: "Crée la\nrencontre.", pivot: "rencontre", items: ["Toi", "Ton contact"] },
    { id: "s3", visual: "marque", voice: "Bienvenue chez BeeRecos.", title: "Développer\nton activité", items: ["1", "2", "3"] },
    { id: "s4", visual: "liste", voice: "Un réseau d’apporteurs d’affaires pour créer des opportunités et valoriser tes recommandations.", title: "Réseau\nd’apporteurs\nd’affaires", pivot: "Réseau", items: ["Opportunités", "Mise en relation", "Recommandation"] },
    { id: "s5", visual: "chapitre", voice: "Une école de formation pour mieux vendre, mieux communiquer et développer ton activité.", title: "École de\nformation", pivot: "formation", items: ["Vendre", "Communiquer", "Progresser"] },
    { id: "s6", visual: "liste", voice: "La digitalisation IA pour créer tes contenus, simplifier ton quotidien et passer à l’action.", title: "Digitalisation IA", pivot: "IA", items: ["Créer", "Organiser", "Agir"] },
    { id: "s7", visual: "piliers", voice: "Des rencontres. Des compétences. Des outils. Trois piliers qui se renforcent.", title: "Ton activité", pivot: "renforcent", items: ["Réseau", "Formation", "Digitalisation IA"] },
    { id: "s8", visual: "personnes", voice: "Et toujours, l’humain au cœur du réseau.", title: "L’humain\nau centre.", pivot: "humain" },
    { id: "s9", visual: "cta", voice: "Envie de découvrir BeeRecos ? Commente CLUB pour recevoir les informations et préparer ta visite.", title: "Commente", subtitle: "Pour préparer ta visite.", pivot: "CLUB" },
    { id: "s10", visual: "signature", voice: "BeeRecos. Mon réseau, c’est ton réseau.", title: "" },
  ],
  cta: { keyword: "CLUB", complement: "Pour préparer ta visite." },
  voice: { provider: "heygen", voiceId: "7459d7aa599b4f97908600896a0e7ef4", speed: DEFAULT_VOICE_SPEED },
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const AMOUNT = /\d[\d\s.,]*\s?(€|euros?\b|k€|%)/i;
const PAY = /rémunér|commission|rétribu|gagne[rz]?\s+de\s+l'argent/i;
const words = (s: string) => s.replace(/\n/g, " ").split(/\s+/).filter(Boolean);

export type MotionParse = { ok: true; spec: MotionSpec } | { ok: false; errors: string[]; spec: MotionSpec };

/**
 * Contrôles mesurés avant rendu : structure (3 à 12 scènes, une seule scène d'appel à l'action juste avant la
 * signature finale), lisibilité (≤ 7 mots de titre, ≤ 3 cartes, phrases ≤ 220 caractères), un seul mot-clé, aucun
 * montant ni rémunération promise, durée estimée dans la fenêtre 15-60 s. Les erreurs gardent la saisie.
 */
export function parseMotionSpec(input: unknown): MotionParse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repris tel quel de BeeMarketing
  const o = (input ?? {}) as Record<string, any>;
  const errors: string[] = [];
  const rythme: MotionRhythm = ["pose", "dynamique", "tres_dynamique"].includes(o.settings?.rythme) ? o.settings.rythme : "dynamique";
  const texte: MotionTextAmount = ["minimal", "equilibre", "riche"].includes(o.settings?.texte) ? o.settings.texte : "equilibre";
  const presence: MotionPresence = ["graphique", "mascotte", "intervenant"].includes(o.settings?.presence) ? o.settings.presence : "mascotte";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repris tel quel de BeeMarketing
  const rawScenes: any[] = Array.isArray(o.scenes) ? o.scenes.slice(0, 12) : [];
  const scenes: MotionScene[] = rawScenes.map((s, i) => {
    const visual: MotionVisual = (MOTION_VISUALS as readonly string[]).includes(s?.visual) ? s.visual : "titre";
    const items = (Array.isArray(s?.items) ? s.items : []).map((x: unknown) => brandCase(str(x).trim()).slice(0, 28)).filter(Boolean).slice(0, 3);
    return {
      id: /^[a-z0-9-]{1,12}$/i.test(str(s?.id)) ? s.id : `s${i + 1}`,
      visual,
      voice: brandCase(str(s?.voice).trim()).slice(0, 220),
      title: brandCase(str(s?.title).trim()).slice(0, 80),
      subtitle: brandCase(str(s?.subtitle).trim()).slice(0, 60) || undefined,
      pivot: str(s?.pivot).trim().slice(0, 24) || undefined,
      items: items.length ? items : undefined,
      ...((MOTION_NARRATIVE_ROLES as readonly string[]).includes(s?.role) ? { role: s.role as MotionNarrativeRole } : {}),
    };
  });
  const keyword = str(o.cta?.keyword).trim().toUpperCase();
  const spec: MotionSpec = {
    kind: "motion",
    style: MOTION_STYLE_ID,
    title: str(o.title).trim().slice(0, 80),
    objective: str(o.objective).trim().slice(0, 160),
    pillar: (Object.keys(PILLAR_LABEL) as StoryPillar[]).includes(o.pillar) ? o.pillar : "reseau_monetise",
    targetSeconds: Math.min(MOTION_MAX_SECONDS, Math.max(MOTION_MIN_SECONDS, Math.round(Number(o.targetSeconds) || 45))),
    settings: { rythme, texte, presence },
    scenes,
    cta: { keyword, complement: brandCase(str(o.cta?.complement).trim()).slice(0, 48) },
    voice: {
      provider: o.voice?.provider === "kokoro" ? "kokoro" : "heygen",
      voiceId: /^[A-Za-z0-9_]{3,64}$/.test(str(o.voice?.voiceId)) ? o.voice.voiceId : MOTION_VOICES.heygen[0].id,
      speed: Math.min(1.25, Math.max(0.8, Number(o.voice?.speed) || DEFAULT_VOICE_SPEED)),
    },
    assets: o.assets && typeof o.assets === "object" ? o.assets : undefined,
  };

  if (!spec.title) errors.push("Sujet : un titre interne est nécessaire.");
  if (presence === "intervenant") errors.push("Présence humaine « intervenant filmé » : passe par Vidéo Reel (une vidéo tournée est nécessaire). En Vidéo IA, choisis Graphique ou Mascotte.");
  if (scenes.length < 3) errors.push("Il faut au moins 3 scènes (dont l'appel à l'action et la signature).");
  if (scenes[scenes.length - 1]?.visual !== "signature") errors.push("La dernière scène est la signature (logo et baseline officiels).");
  const ctaIdx = scenes.map((s) => s.visual).lastIndexOf("cta");
  if (scenes.filter((s) => s.visual === "cta").length !== 1 || ctaIdx !== scenes.length - 2) errors.push("Une seule scène d'appel à l'action, juste avant la signature.");
  if (scenes.filter((s) => s.visual === "signature").length > 1) errors.push("Une seule signature, en fin de vidéo.");
  if (!/^[A-ZÀ-Ý0-9]{2,20}$/.test(keyword)) errors.push("Appel à l'action : un seul mot-clé en majuscules, sans espace (ex. CLUB).");
  const cta = scenes[ctaIdx];
  if (cta && keyword && !new RegExp(`\\b${keyword}\\b`).test(cta.voice)) errors.push(`Appel à l'action : la voix doit prononcer le mot-clé ${keyword}.`);
  scenes.forEach((s, i) => {
    const n = `Scène ${i + 1}`;
    if (!s.voice) errors.push(`${n} : texte de la voix manquant.`);
    if (s.visual !== "signature" && s.visual !== "cta" && !s.title) errors.push(`${n} : texte à l'écran manquant.`);
    if (words(s.title).length > 7) errors.push(`${n} : 7 mots à l'écran au plus (les sous-titres portent la phrase entière).`);
    if (s.pivot && !words(`${s.title} ${s.voice}`).some((w) => w.replace(/[.,;:!?’'«»]/g, "").toLowerCase().endsWith(s.pivot!.toLowerCase()))) errors.push(`${n} : le mot pivot « ${s.pivot} » doit figurer dans le titre ou la voix.`);
    if (s.title && s.voice && s.title.replace(/\n/g, " ").trim() === s.voice.trim()) errors.push(`${n} : ne recopie pas la phrase de la voix à l'écran.`);
    if (["relation"].includes(s.visual) && (s.items?.length ?? 0) < 2) errors.push(`${n} : deux cartes à nommer (ex. Toi / Ton contact).`);
    if (["liste", "chapitre", "piliers"].includes(s.visual) && (s.items?.length ?? 0) < 2) errors.push(`${n} : 2 ou 3 cartes à nommer.`);
  });
  const shown = scenes.flatMap((s) => [s.title, s.subtitle ?? "", ...(s.items ?? [])]).concat(spec.cta.complement);
  const spoken = scenes.map((s) => s.voice);
  if ([...shown, ...spoken].some((t) => AMOUNT.test(t))) errors.push("Aucun montant ni pourcentage : la vidéo n'affiche ni ne promet de somme.");
  if ([...shown, ...spoken].some((t) => PAY.test(t))) errors.push("Aucune rémunération promise : ses conditions ne sont pas documentées (DONNÉE MANQUANTE).");
  if (shown.some((t) => /\d/.test(t) && !/^[123]$/.test(t.trim()))) errors.push("Aucun chiffre à l'écran (seules les pastilles 1, 2, 3 sont permises).");
  const total = estimateMotionSeconds(spec);
  if (total < MOTION_MIN_SECONDS || total > MOTION_MAX_SECONDS) errors.push(`Durée estimée ${Math.round(total)} s : la vidéo doit durer entre ${MOTION_MIN_SECONDS} et ${MOTION_MAX_SECONDS} s.`);
  return errors.length ? { ok: false, errors, spec } : { ok: true, spec };
}

/** Réglages de mouvement par rythme (valeurs de départ du prompt, resserrées pour « très dynamique »). */
export const RHYTHM = {
  pose: { pad: 0.9, min: 2.6, entry: 0.5, stagger: 0.1, push: 1.02, punch: 1.03, hold: 2.4, exit: 0, bpm: 100 },
  dynamique: { pad: 0.5, min: 2.2, entry: 0.38, stagger: 0.075, push: 1.04, punch: 1.06, hold: 1.7, exit: 0.3, bpm: 120 },
  tres_dynamique: { pad: 0.32, min: 1.8, entry: 0.28, stagger: 0.055, push: 1.06, punch: 1.08, hold: 1.3, exit: 0.25, bpm: 128 },
} as const;

/** Débit de lecture pour estimer une phrase sans voix produite (≈ 155 mots/min, prompt : 145-165). */
const WORDS_PER_SECOND = 2.6;

/** Mots d'une scène avec leurs temps (voix produite si elle correspond encore au texte, sinon estimation). */
export function sceneWords(spec: MotionSpec, scene: MotionScene): MotionWord[] {
  const a = spec.assets?.voice?.[scene.id];
  if (a && currentVoiceAsset(a, scene.voice, spec.voice.speed) && a.words?.length) return a.words;
  const list = words(scene.voice);
  const chars = list.reduce((n, w) => n + w.length + 1, 0) || 1;
  const span = list.length / WORDS_PER_SECOND / (spec.voice.speed || 1);
  let t = 0.2;
  return list.map((w) => { const d = ((w.length + 1) / chars) * span; const out = { text: w, start: round(t), end: round(t + d * 0.92) }; t += d; return out; });
}

/** Durée de chaque scène : fin de la voix + respiration du rythme ; tenues plus longues pour le CTA et la signature. */
export function sceneDurations(spec: MotionSpec): number[] {
  const R = RHYTHM[spec.settings.rythme];
  return spec.scenes.map((s) => {
    const w = sceneWords(spec, s);
    const a = spec.assets?.voice?.[s.id];
    const end = Math.max(w[w.length - 1]?.end ?? 0, a && currentVoiceAsset(a, s.voice, spec.voice.speed) ? a.duration : 0);
    const base = end + R.pad;
    if (s.visual === "cta") return round(Math.max(4, end + R.hold));
    if (s.visual === "signature") return round(Math.max(3, end + R.hold * 0.9));
    if (s.visual === "marque") return round(Math.max(R.min, base + 0.4));
    return round(Math.max(R.min, base));
  });
}

export function sceneStarts(spec: MotionSpec): number[] {
  const d = sceneDurations(spec);
  return d.map((_, i) => round(d.slice(0, i).reduce((n, x) => n + x, 0)));
}
export const estimateMotionSeconds = (spec: MotionSpec) => round(sceneDurations(spec).reduce((n, x) => n + x, 0));

/** Instant (local à la scène) où la voix prononce un mot ; à défaut, `fallback`. */
export function wordTime(ws: MotionWord[], needle: string | undefined, fallback: number): number {
  if (!needle) return fallback;
  const n = needle.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const hit = ws.find((w) => w.text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.,;:!?’'«»]/g, "").endsWith(n));
  return hit ? hit.start : fallback;
}

/** Empreinte du contenu (sans les fichiers produits) : relie un MP4 à la version exacte de la spec. */
export function motionFingerprint(spec: MotionSpec): string {
  const { assets: _a, ...content } = spec;
  void _a;
  const text = JSON.stringify(content);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const round = (n: number) => Math.round(n * 1000) / 1000;
