import { FORBIDDEN_PATTERNS, VERIFIED_FACTS } from "./facts";
import { DEMO_STORY, parseStorySpec, PILLAR_LABEL, type StoryPillar, type StorySpec } from "./spec";

/**
 * Réapprovisionnement automatique de la file : choix du pilier, consigne envoyée à Claude, et contrôle STRICT
 * de la réponse (structure du modèle, faits vérifiés seulement, interdits, CTA unique, pas de répétition).
 * Une réponse non conforme n'entre jamais dans la file : elle est refusée avec ses motifs.
 */

export const PILLAR_ROTATION: StoryPillar[] = ["reseau_monetise", "formation", "digitalisation_ia"];
export const CAPTION_CTA = "Commente CLUB pour recevoir le lien de visite";

/** Pilier le moins représenté parmi les derniers contenus (ordre de rotation en cas d'égalité). */
export function nextPillar(recent: StoryPillar[]): StoryPillar {
  const last = recent.slice(0, 6);
  const count = (p: StoryPillar) => last.filter((x) => x === p).length;
  const age = (p: StoryPillar) => (last.indexOf(p) === -1 ? Infinity : last.indexOf(p)); // plus grand = plus ancien
  return [...PILLAR_ROTATION].sort((a, b) => count(a) - count(b) || age(b) - age(a))[0];
}

export type RecentItem = { title: string; hook: string; pillar: StoryPillar; angle?: string };

export function buildGenerationPrompt(pillar: StoryPillar, recent: RecentItem[], opts: { rules?: string[] } = {}): { system: string; user: string } {
  const facts = VERIFIED_FACTS.filter((f) => f.pillar === pillar || f.pillar === "club");
  const shape = { ...DEMO_STORY, assets: undefined, voice: { voiceId: "ff_siwis", lines: { hook: "", consequence: "", rupture: "", value: "", steps: "", signature: "", cta: "" } } };
  const system = [
    "Tu écris des Reels Instagram pour BeeRecos (réseau de clubs d'affaires). Ton : direct, professionnel, humain, tutoiement, phrases courtes.",
    "Tu n'utilises QUE les faits fournis. Interdits absolus : chiffres, tarifs, avantages gratuits, garanties, rémunération, témoignages, superlatifs, noms de clubs ou de villes.",
    "Écris toujours « BeeRecos » (B et R majuscules). Un seul appel à l'action : commenter CLUB.",
    "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.",
  ].join("\n");
  const user = [
    `Pilier : ${PILLAR_LABEL[pillar]} (${pillar}).`,
    "Faits vérifiés autorisés :",
    ...facts.map((f) => `- ${f.text}`),
    "",
    "Sujets déjà publiés récemment (ne pas répéter l'accroche ni l'angle) :",
    ...(recent.length ? recent.slice(0, 12).map((r) => `- ${r.title} — accroche « ${r.hook.replace(/\n/g, " ")} »${r.angle ? ` — angle « ${r.angle} »` : ""}`) : ["- (aucun)"]),
    "",
    ...(opts.rules?.length ? ["Retours de la direction (règles écrites, à appliquer telles quelles) :", ...opts.rules.map((r) => `- ${r}`), ""] : []),
    "Format attendu : {\"brief\": {\"sujet\": \"ce dont parle le Reel, en une phrase\", \"angle\": \"en quoi c'est dit autrement que les sujets récents\"}, \"spec\": <objet de la même forme que l'exemple>, \"caption\": \"légende Instagram\"}",
    "Exemple de spec (même structure, mêmes clés, trois étapes, voix vides) :",
    JSON.stringify(shape),
    "",
    "Règles de la spec : textes à l'écran en MAJUSCULES sauf compléments ; \\n = retour à la ligne ; *mot* = mot mis en valeur ;",
    "accroche ≤ 28 caractères, conséquence ≤ 28, rupture ≤ 14, valeur ≤ 32, étape ≤ 16, complément ≤ 40, signature ≤ 44 ;",
    "durées dans les mêmes bornes que l'exemple, total entre 15 et 25 s ; cta = {\"verb\":\"COMMENTE\",\"keyword\":\"CLUB\",\"complement\":\"pour recevoir le lien de visite.\"} ;",
    `pillar = "${pillar}" ; motion = "dynamique".`,
    `Légende : 2 à 4 phrases courtes, puis exactement « ${CAPTION_CTA}. », puis 3 à 5 hashtags dont #BeeRecos. 600 caractères au plus.`,
  ].join("\n");
  return { system, user };
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/gi, "").toLowerCase();

/** Extrait le premier objet JSON d'une réponse (bloc ```json``` ou accolades). */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(body);
}

export type GeneratedContent = { ok: true; spec: StorySpec; caption: string } | { ok: false; errors: string[] };

/** Contrôle d'une proposition (Claude ou autre) avant son entrée dans la file. */
export function validateGenerated(raw: unknown, pillar: StoryPillar, recent: RecentItem[]): GeneratedContent {
  const o = (raw ?? {}) as { spec?: unknown; caption?: unknown };
  const parsed = parseStorySpec({ ...(o.spec as object), motion: (o.spec as { motion?: string })?.motion ?? "dynamique" });
  const errors: string[] = parsed.ok ? [] : [...parsed.errors];
  const caption = typeof o.caption === "string" ? o.caption.trim() : "";
  if (!caption) errors.push("Légende manquante.");
  if (caption.length > 2200) errors.push("Légende trop longue pour Instagram.");
  if (caption && !caption.includes(CAPTION_CTA)) errors.push(`La légende doit contenir « ${CAPTION_CTA} ».`);
  if (/\b(dm|message privé automatique)\b/i.test(caption)) errors.push("La légende ne promet pas de message privé : l'invitation est de commenter CLUB.");
  if (!parsed.ok) return { ok: false, errors };
  const spec = { ...parsed.spec, pillar, assets: undefined };
  const shown = [spec.title, spec.hook.text, spec.hook.complement, spec.consequence.text, spec.consequence.status, spec.rupture.text, spec.value.text,
    ...spec.steps.items.flatMap((s) => [s.title, s.complement]), spec.steps.footnote, spec.signature.tagline, spec.cta.complement, spec.card.label, spec.card.status,
    spec.card.from, spec.card.contact, spec.card.to, caption.replace(/#\w+/g, "")];
  for (const f of FORBIDDEN_PATTERNS) if (shown.some((t) => f.re.test(t))) errors.push(`Interdit : ${f.reason}.`);
  if (spec.cta.keyword !== "CLUB") errors.push("Le mot-clé doit être CLUB.");
  const hook = norm(spec.hook.text);
  if (recent.some((r) => norm(r.hook) === hook || norm(r.title) === norm(spec.title))) errors.push("Accroche ou titre déjà utilisé récemment.");
  if (Object.values(spec.voice.lines).some((l) => l.trim())) spec.voice = { ...spec.voice, lines: { hook: "", consequence: "", rupture: "", value: "", steps: "", signature: "", cta: "" } };
  return errors.length ? { ok: false, errors } : { ok: true, spec, caption };
}
