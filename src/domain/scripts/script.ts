/**
 * Éditeur de script d'Instagram BeeRecos : un script = des blocs ordonnés, de l'accroche (HOOK) à l'appel à l'action
 * (CTA), suivant le moteur narratif validé de BeeMarketing (HOOK → LEAD → BODY 1 → OPEN LOOP → BODY 2 → OPEN LOOP →
 * BODY 3 → CTA). Chaque bloc porte le texte à dire (prompteur, voix) et le texte à l'écran.
 * Stockage : MotionSpec (studio_assets « motion », révisions serveur) → le même script devient réel IA ou réel filmé.
 * Règles pures et testées ; rien n'est inventé (aucun chiffre, montant ni promesse de rémunération).
 */
import { hasKeyword } from "@/domain/social/montage/reels";
import { DEFAULT_VOICE_SPEED } from "@/domain/social/reel-story/pron";
import { AUDREY_VOICE_ID } from "@/domain/social/reel-story/audrey";
import { MOTION_STYLE_ID, type MotionNarrativeRole, type MotionScene, type MotionSpec } from "@/domain/social/reel-story/motion-spec";
import type { StoryPillar } from "@/domain/social/reel-story/spec";
import { OFFICIAL_SIGNATURE_VOICE } from "@/domain/reels/ai-spec";

export type BlockRole = MotionNarrativeRole;
export type ScriptBlock = { id: string; role: BlockRole; voice: string; screen: string; pivot?: string };
export type Script = { title: string; objective: string; pillar: StoryPillar; keyword: string; blocks: ScriptBlock[] };

export const BLOCKS: { role: BlockRole; label: string; hint: string; optional: boolean }[] = [
  { role: "HOOK", label: "Hook · accroche", hint: "Une phrase qui arrête le pouce : une tension, une question, une situation vécue. 15 mots au plus.", optional: false },
  { role: "LEAD", label: "Lead · contexte", hint: "Pourquoi ça compte pour la personne qui regarde ; on installe le problème.", optional: false },
  { role: "BODY_1", label: "Body 1 · première idée", hint: "Le premier apport concret (une étape, un exemple, un conseil).", optional: false },
  { role: "OPEN_LOOP_1", label: "Open loop · relance", hint: "Une courte relance qui donne envie de rester (« Et ce n'est pas le plus important… »).", optional: true },
  { role: "BODY_2", label: "Body 2 · deuxième idée", hint: "Le deuxième apport, plus fort que le premier.", optional: true },
  { role: "OPEN_LOOP_2", label: "Open loop · relance", hint: "Deuxième relance, avant la conclusion.", optional: true },
  { role: "BODY_3", label: "Body 3 · payoff", hint: "La réponse promise par le hook : l'idée à retenir.", optional: true },
  { role: "CTA", label: "Call to action", hint: "Une seule action : « Commente MOT… ». Le mot-clé est prononcé en majuscules.", optional: false },
];
export const BLOCK_LABEL = Object.fromEntries(BLOCKS.map((b) => [b.role, b.label])) as Record<BlockRole, string>;

/** Débit de lecture moyen d'un réel (environ 150 mots par minute). */
export const WORDS_PER_SECOND = 2.5;
export const SIGNATURE_SECONDS = 2;
export const TARGET = { min: 35, max: 60 };

const words = (t: string) => t.replace(/\n/g, " ").split(/\s+/).filter(Boolean);
export const blockSeconds = (b: Pick<ScriptBlock, "voice">) => Math.round((words(b.voice).length / WORDS_PER_SECOND) * 10) / 10;
export const scriptSeconds = (s: Script) => Math.round((s.blocks.reduce((n, b) => n + blockSeconds(b), 0) + SIGNATURE_SECONDS) * 10) / 10;

let n = 0;
const newId = () => `b${Date.now().toString(36)}${(++n).toString(36)}`;
export const emptyBlock = (role: BlockRole): ScriptBlock => ({ id: newId(), role, voice: "", screen: "" });
export const newScript = (): Script => ({ title: "", objective: "", pillar: "reseau_monetise", keyword: "CLUB", blocks: BLOCKS.filter((b) => !b.optional).map((b) => emptyBlock(b.role)) });

/** Ajoute un bloc facultatif à sa place dans l'ordre narratif (un seul bloc par rôle). */
export function addBlock(s: Script, role: BlockRole): Script {
  if (s.blocks.some((b) => b.role === role)) return s;
  const order = BLOCKS.map((b) => b.role);
  const blocks = [...s.blocks, emptyBlock(role)].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  return { ...s, blocks };
}
export function removeBlock(s: Script, id: string): Script {
  const b = s.blocks.find((x) => x.id === id);
  if (!b || !BLOCKS.find((x) => x.role === b.role)?.optional) return s;
  return { ...s, blocks: s.blocks.filter((x) => x.id !== id) };
}

const AMOUNT = /\d[\d\s.,]*\s?(€|euros?\b|k€|%)/i;
const PAY = /rémunér|commission|rétribu|gagne[rz]?\s+de\s+l'argent/i;

export type Check = { level: "erreur" | "conseil"; text: string; block?: string };
export function scriptChecks(s: Script): Check[] {
  const out: Check[] = [];
  const kw = s.keyword.trim();
  if (!s.title.trim()) out.push({ level: "erreur", text: "Donne un titre au script." });
  if (!/^[A-ZÀ-Ý0-9]{2,20}$/.test(kw)) out.push({ level: "erreur", text: "Mot-clé du CTA : un seul mot en majuscules, sans espace (ex. CLUB)." });
  if (s.blocks[0]?.role !== "HOOK") out.push({ level: "erreur", text: "Le script commence par le hook." });
  if (s.blocks.at(-1)?.role !== "CTA") out.push({ level: "erreur", text: "Le script finit par le call to action." });
  for (const b of s.blocks) {
    const label = BLOCK_LABEL[b.role];
    if (!b.voice.trim()) out.push({ level: "erreur", text: `${label} : texte à dire manquant.`, block: b.id });
    if (b.role !== "CTA" && !b.screen.trim()) out.push({ level: "erreur", text: `${label} : texte à l'écran manquant.`, block: b.id });
    if (words(b.screen).length > 7) out.push({ level: "erreur", text: `${label} : 7 mots à l'écran au plus (les sous-titres portent la phrase).`, block: b.id });
    if (b.voice.length > 220) out.push({ level: "erreur", text: `${label} : 220 caractères au plus par bloc (scinde la phrase).`, block: b.id });
    if (b.screen.trim() && b.screen.replace(/\n/g, " ").trim() === b.voice.trim()) out.push({ level: "erreur", text: `${label} : ne recopie pas la phrase dite à l'écran.`, block: b.id });
    if ([b.voice, b.screen].some((t) => AMOUNT.test(t))) out.push({ level: "erreur", text: `${label} : aucun montant ni pourcentage.`, block: b.id });
    if ([b.voice, b.screen].some((t) => PAY.test(t))) out.push({ level: "erreur", text: `${label} : aucune rémunération promise (conditions non documentées).`, block: b.id });
    if (/beerecos/i.test(`${b.voice} ${b.screen}`.replace(/BeeRecos/g, ""))) out.push({ level: "erreur", text: `${label} : écris BeeRecos (B et R majuscules).`, block: b.id });
  }
  const hook = s.blocks.find((b) => b.role === "HOOK");
  if (hook && words(hook.voice).length > 15) out.push({ level: "conseil", text: "Hook : 15 mots au plus pour arrêter le pouce.", block: hook.id });
  const cta = s.blocks.find((b) => b.role === "CTA");
  if (cta && kw && cta.voice.trim() && !hasKeyword(cta.voice, kw)) out.push({ level: "erreur", text: `Call to action : prononce le mot-clé ${kw} en majuscules.`, block: cta.id });
  const total = scriptSeconds(s);
  if (total < TARGET.min) out.push({ level: "conseil", text: `Durée estimée ${total} s : la cible est de ${TARGET.min} à ${TARGET.max} s (CTA et carte de fin compris).` });
  if (total > TARGET.max) out.push({ level: "conseil", text: `Durée estimée ${total} s : au-delà de ${TARGET.max} s, raccourcis un bloc.` });
  return out;
}
export const isReady = (s: Script) => !scriptChecks(s).some((c) => c.level === "erreur");

/** Script → MotionSpec (réel IA, prompteur) : blocs dans l'ordre, signature officielle ajoutée en fin. */
export function scriptToMotion(s: Script): MotionSpec {
  const scenes: MotionScene[] = s.blocks.map((b, i) => ({
    id: `s${i + 1}`, role: b.role, visual: b.role === "CTA" ? "cta" : "titre", voice: b.voice.trim(),
    title: b.role === "CTA" ? (b.screen.trim() || "Commente") : b.screen.trim(),
    ...(b.role === "CTA" ? { pivot: s.keyword.trim() } : b.pivot ? { pivot: b.pivot } : {}),
  }));
  scenes.push({ id: `s${scenes.length + 1}`, visual: "signature", voice: OFFICIAL_SIGNATURE_VOICE, title: "" });
  return {
    kind: "motion", style: MOTION_STYLE_ID, title: s.title.trim(), objective: s.objective.trim(), pillar: s.pillar,
    targetSeconds: Math.min(60, Math.max(15, Math.round(scriptSeconds(s)))),
    settings: { rythme: "dynamique", texte: "equilibre", presence: "mascotte" }, scenes,
    cta: { keyword: s.keyword.trim(), complement: "" },
    voice: { provider: "heygen", voiceId: AUDREY_VOICE_ID, speed: DEFAULT_VOICE_SPEED },
  };
}

/** MotionSpec enregistré → blocs (la signature n'est pas un bloc). Scènes sans rôle : Body dans l'ordre. */
export function motionToScript(spec: MotionSpec): Script {
  const body: BlockRole[] = ["BODY_1", "BODY_2", "BODY_3"];
  let k = 0;
  const blocks = spec.scenes.filter((x) => x.visual !== "signature").map((x, i, all) => ({
    id: newId(),
    role: x.role ?? (i === 0 ? "HOOK" : i === all.length - 1 && x.visual === "cta" ? "CTA" : body[Math.min(k++, 2)]),
    voice: x.voice, screen: x.visual === "cta" && x.title === "Commente" ? "" : x.title.replace(/\n/g, " "), ...(x.pivot && x.visual !== "cta" ? { pivot: x.pivot } : {}),
  }));
  return { title: spec.title, objective: spec.objective, pillar: spec.pillar, keyword: spec.cta.keyword, blocks };
}

/** Texte complet à lire au prompteur. */
export const prompterText = (s: Script) => s.blocks.map((b) => b.voice.trim()).filter(Boolean).join("\n\n");
