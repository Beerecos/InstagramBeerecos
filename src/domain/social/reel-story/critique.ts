import { FORBIDDEN_PATTERNS } from "./facts";
import { CAPTION_CTA, type RecentItem } from "./generation";
import { REEL_MAX_SECONDS, REEL_MIN_SECONDS, SEQUENCES, totalDuration, type SequenceKey, type StorySpec } from "./spec";

/**
 * Contrôle d'un Reel en deux parties, sur le modèle « bureau IA » (créateur ≠ contrôleur) :
 *  1. des CONTRÔLES MESURÉS (scripts, oui / non, preuve à l'appui) : un seul échec renvoie en rédaction, quelle que soit la note ;
 *  2. la GRILLE d'un contrôleur séparé (un autre appel, idéalement un autre modèle, sans aucun outil de création) :
 *     verdict par critère avec la phrase citée en preuve et la consigne exacte à ajouter.
 * La note du contrôleur ne bloque la publication qu'une fois ÉTALONNÉE sur des notes humaines (`calibration`) :
 * avant, seul son verdict « refusé » argumenté compte. Règle des 3 tours : au 3e refus, la meilleure version
 * remonte à la direction pour arbitrage, elle n'est ni rendue ni publiée automatiquement.
 */

export const MAX_ROUNDS = 3;
/** Écran de couverture : 12 mots au plus ; autres écrans : 25 mots au plus. */
export const COVER_MAX_WORDS = 12;
export const SCREEN_MAX_WORDS = 25;
/** Vitesse de lecture maximale à l'écran (mots par seconde de séquence). */
export const MAX_WORDS_PER_SECOND = 4.5;
/** Seuils appliqués à la note une fois le contrôleur étalonné. */
export const SCORE_MIN_TOTAL = 9;
export const SCORE_MIN_CRITERION = 8;
/** Étalonnage : au moins 10 Reels notés par un humain ET par le contrôleur, écart moyen < 1 point. */
export const CALIBRATION_MIN_ITEMS = 10;
export const CALIBRATION_MAX_GAP = 1;

export type MeasuredCheck = { key: string; label: string; ok: boolean; proof: string };
export type CriterionKey = "accroche" | "lisibilite" | "valeur" | "rythme" | "marque" | "finition";
export const CRITIQUE_GRID: { key: CriterionKey; label: string; weight: number; question: string }[] = [
  { key: "accroche", label: "Accroche", weight: 20, question: "L'accroche arrête-t-elle le défilement en moins d'une seconde, pour un dirigeant de TPE ou PME ?" },
  { key: "lisibilite", label: "Lisibilité et hiérarchie", weight: 20, question: "Chaque écran se comprend-il en 3 secondes, dans le bon ordre, avec le mot qui compte en valeur ?" },
  { key: "valeur", label: "Valeur et clarté", weight: 20, question: "Le Reel porte-t-il une seule idée utile, vraie et compréhensible, sans promesse ?" },
  { key: "rythme", label: "Rythme", weight: 15, question: "Les durées laissent-elles lire chaque écran, sans temps mort ni à-coup ?" },
  { key: "marque", label: "Ton BeeRecos", weight: 15, question: "Ton direct, professionnel, humain, tutoiement ; « BeeRecos » bien écrit ; un seul appel à l'action ?" },
  { key: "finition", label: "Finition", weight: 10, question: "Orthographe, accents, majuscules, ponctuation, légende propre ?" },
];

export type CriterionVerdict = { key: CriterionKey; score: number; ok: boolean; proof: string; instruction: string };
export type Critique = {
  verdict: "reussi" | "refuse";
  criteria: CriterionVerdict[];
  /** Note pondérée sur 10 (indicative tant que le contrôleur n'est pas étalonné). */
  score: number;
  summary: string;
  independent: boolean;
};
export type Calibration = { items: number; gap: number | null; calibrated: boolean };
export type ReviewRound = {
  round: number; at: string; title?: string; hook?: string; caption?: string; spec?: StorySpec;
  refusedBy: "controle" | "critique" | null; errors: string[]; checks?: MeasuredCheck[]; critique?: Critique | null;
};
export type ContentBrief = { sujet: string; angle: string; motCle: string };
/** Rapport conservé sur le contenu : brief, chaque tour (versions refusées consultables), décision finale. */
export type ReviewReport = { brief?: ContentBrief; rounds: ReviewRound[]; final?: { checks: MeasuredCheck[]; critique: Critique | null; gated: "verdict" | "note" } };

const words = (s: string) => s.replace(/[*\n]/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Textes affichés, séquence par séquence. */
export function screenTexts(spec: StorySpec): Record<SequenceKey, string> {
  return {
    hook: `${spec.hook.text} ${spec.hook.complement}`,
    consequence: `${spec.consequence.text} ${spec.consequence.status}`,
    rupture: spec.rupture.text,
    value: spec.value.text,
    steps: [...spec.steps.items.flatMap((s) => [s.title, s.complement]), spec.steps.footnote].join(" "),
    signature: spec.signature.tagline,
    cta: `${spec.cta.verb} ${spec.cta.keyword} ${spec.cta.complement}`,
  };
}

/** Mots-clés qu'un appel « Commente X » invite à écrire (légende ou écran). */
export function invitedKeywords(text: string): string[] {
  return [...text.matchAll(/comment(?:e|ez)\s+[«"“]?\s*([A-ZÀ-ÖØ-Ý]{2,})/giu)].map((m) => m[1].toUpperCase());
}

/**
 * Partie 1 — contrôles mesurés. `activeKeywords` : mots-clés déclarés actifs dans le moteur de DM (Manychat) ;
 * le mot-clé du Reel doit en faire partie (sinon le commentaire ne déclenche rien) et aucun autre ne doit être invité.
 */
export function measuredChecks(spec: StorySpec, caption: string, opts: { activeKeywords: string[]; recent?: RecentItem[]; brief?: ContentBrief | null }): MeasuredCheck[] {
  const screens = screenTexts(spec);
  const checks: MeasuredCheck[] = [];
  const add = (key: string, label: string, ok: boolean, proof: string) => checks.push({ key, label, ok, proof });

  const total = totalDuration(spec);
  add("duree", "Durée 15 à 25 s", total >= REEL_MIN_SECONDS && total <= REEL_MAX_SECONDS, `${total} s`);

  const cover = words(screens.hook);
  add("couverture", `Couverture ≤ ${COVER_MAX_WORDS} mots`, cover <= COVER_MAX_WORDS, `${cover} mots : « ${screens.hook.replace(/\s+/g, " ").trim()} »`);
  const heavy = SEQUENCES.filter((k) => k !== "hook" && words(screens[k]) > SCREEN_MAX_WORDS);
  add("ecrans", `Écrans ≤ ${SCREEN_MAX_WORDS} mots`, heavy.length === 0, heavy.length ? heavy.map((k) => `${k} : ${words(screens[k])} mots`).join(", ") : "tous conformes");

  const fast = SEQUENCES.filter((k) => words(screens[k]) / spec.durations[k] > MAX_WORDS_PER_SECOND);
  add("lecture", `Temps de lecture (≤ ${MAX_WORDS_PER_SECOND} mots/s)`, fast.length === 0,
    fast.length ? fast.map((k) => `${k} : ${(words(screens[k]) / spec.durations[k]).toFixed(1)} mots/s`).join(", ") : "chaque écran se lit dans sa durée");

  add("legende_cta", "Légende avec l'appel à commenter", caption.includes(CAPTION_CTA), caption.includes(CAPTION_CTA) ? `« ${CAPTION_CTA} » présent` : `« ${CAPTION_CTA} » absent`);

  const active = opts.activeKeywords.map((k) => k.toUpperCase());
  const kw = spec.cta.keyword.toUpperCase();
  add("mot_cle_actif", "Mot-clé actif dans le moteur de DM", active.includes(kw), active.includes(kw) ? `${kw} déclaré actif` : `${kw} absent des mots-clés actifs (${active.join(", ") || "aucun"}) : le commentaire ne déclencherait rien`);
  const others = [...new Set([...invitedKeywords(caption), ...invitedKeywords(Object.values(screens).join(" "))])].filter((k) => k !== kw);
  add("collision", "Aucun autre mot-clé invité", others.length === 0, others.length ? `invite aussi : ${others.join(", ")}` : `seul ${kw} est invité`);

  const shown = [...Object.values(screens), caption];
  const misspelt = shown.flatMap((t) => [...t.matchAll(/bee\s?recos/gi)].map((m) => m[0])).filter((m) => m !== "BeeRecos" && m !== "BEERECOS" && m !== "beerecos");
  // #BeeRecos et les capitales d'écran (« BEERECOS ») sont admis ; le rendu applique la casse imposée (brandCase).
  add("marque", "« BeeRecos » bien écrit", misspelt.length === 0, misspelt.length ? `graphies fautives : ${[...new Set(misspelt)].join(", ")}` : "conforme");

  const hits = FORBIDDEN_PATTERNS.filter((f) => shown.some((t) => f.re.test(t.replace(/#\w+/g, ""))));
  add("interdits", "Aucune affirmation interdite", hits.length === 0, hits.length ? hits.map((h) => h.reason).join(" ; ") : "aucune");

  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/gi, "").toLowerCase();
  const dup = (opts.recent ?? []).find((r) => n(r.hook) === n(spec.hook.text) || n(r.title) === n(spec.title) || (opts.brief?.angle && r.angle && n(r.angle) === n(opts.brief.angle)));
  add("originalite", "Accroche, titre et angle non répétés", !dup, dup ? `déjà utilisé : « ${dup.title} »` : "inédits sur les 12 derniers");

  if (opts.brief !== undefined) {
    const b = opts.brief;
    const ok = Boolean(b && b.sujet.trim().length >= 8 && b.angle.trim().length >= 8 && b.motCle.toUpperCase() === kw);
    add("brief", "Brief complet (sujet, angle, mot-clé)", ok, b ? `sujet « ${b.sujet} » · angle « ${b.angle} » · mot-clé ${b.motCle}` : "brief absent");
  }
  return checks;
}

export function parseBrief(raw: unknown, keyword: string): ContentBrief | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const sujet = typeof o.sujet === "string" ? o.sujet.trim().slice(0, 200) : "";
  const angle = typeof o.angle === "string" ? o.angle.trim().slice(0, 300) : "";
  return sujet || angle ? { sujet, angle, motCle: keyword } : null;
}

/** Partie 2 — consigne du contrôleur : il juge, ne réécrit rien, cite sa preuve. */
export function buildCritiquePrompt(spec: StorySpec, caption: string, opts: { brief?: ContentBrief | null; rules?: string[] } = {}): { system: string; user: string } {
  const screens = screenTexts(spec);
  const system = [
    "Tu es le contrôleur qualité des Reels Instagram de BeeRecos (réseau de clubs d'affaires). Tu n'as rien créé et tu ne crées rien : tu juges.",
    "Pour chaque critère : une note entière de 0 à 10, la phrase exacte du Reel qui sert de preuve, et la consigne précise à ajouter au brief si la note est sous 8.",
    "Sois exigeant : 9 ou 10 seulement si tu ne trouves aucun défaut concret. Refuse (« refuse ») dès qu'un critère a un défaut bloquant que tu peux citer.",
    "Réponds UNIQUEMENT avec un objet JSON valide.",
  ].join("\n");
  const user = [
    opts.brief ? `Brief : sujet « ${opts.brief.sujet} » ; angle « ${opts.brief.angle} » ; mot-clé ${opts.brief.motCle}.` : "Brief : non fourni.",
    "Écrans dans l'ordre (durée en secondes) :",
    ...SEQUENCES.map((k) => `- ${k} (${spec.durations[k]} s) : ${screens[k].replace(/\n/g, " / ")}`),
    `Légende : ${caption}`,
    "",
    ...(opts.rules?.length ? ["Retours de la direction à vérifier (règles écrites) :", ...opts.rules.map((r) => `- ${r}`), ""] : []),
    "Critères :",
    ...CRITIQUE_GRID.map((c) => `- ${c.key} (${c.weight} %) : ${c.question}`),
    "",
    'Format : {"verdict":"reussi"|"refuse","criteria":[{"key":"accroche","score":0,"proof":"…","instruction":"…"}, …les 6 critères],"summary":"une phrase"}',
  ].join("\n");
  return { system, user };
}

export const weightedScore = (scores: Partial<Record<CriterionKey, number>>) =>
  Math.round(CRITIQUE_GRID.reduce((n, c) => n + (scores[c.key] ?? 0) * c.weight, 0) / 10) / 10;

/** Lecture stricte de la réponse du contrôleur ; une réponse incomplète est une erreur (jamais un « réussi » par défaut). */
export function parseCritique(raw: unknown, independent: boolean): { ok: true; critique: Critique } | { ok: false; error: string } {
  const o = (raw ?? {}) as { verdict?: unknown; criteria?: unknown; summary?: unknown };
  if (o.verdict !== "reussi" && o.verdict !== "refuse") return { ok: false, error: "Verdict du contrôleur absent." };
  const list = Array.isArray(o.criteria) ? o.criteria as Record<string, unknown>[] : [];
  const criteria: CriterionVerdict[] = [];
  for (const c of CRITIQUE_GRID) {
    const item = list.find((x) => x?.key === c.key);
    const score = Number(item?.score);
    if (!item || !Number.isInteger(score) || score < 0 || score > 10) return { ok: false, error: `Critère « ${c.label} » absent ou mal noté.` };
    const proof = typeof item.proof === "string" ? item.proof.trim().slice(0, 300) : "";
    if (!proof) return { ok: false, error: `Critère « ${c.label} » sans preuve.` };
    criteria.push({ key: c.key, score, ok: score >= SCORE_MIN_CRITERION, proof, instruction: typeof item.instruction === "string" ? item.instruction.trim().slice(0, 300) : "" });
  }
  const score = weightedScore(Object.fromEntries(criteria.map((c) => [c.key, c.score])));
  return { ok: true, critique: { verdict: o.verdict, criteria, score, summary: typeof o.summary === "string" ? o.summary.slice(0, 300) : "", independent } };
}

/** La critique laisse-t-elle passer ? Avant étalonnage : son verdict. Après : verdict ET note (≥ 9, aucun critère < 8). */
export function critiquePasses(c: Critique, calibrated: boolean): boolean {
  if (c.verdict !== "reussi") return false;
  if (!calibrated) return true;
  return c.score >= SCORE_MIN_TOTAL && c.criteria.every((x) => x.score >= SCORE_MIN_CRITERION);
}

/** Consignes à renvoyer au rédacteur pour le tour suivant. */
export function revisionNotes(round: Pick<ReviewRound, "errors" | "checks" | "critique">): string {
  const failed = (round.checks ?? []).filter((c) => !c.ok).map((c) => `${c.label} : ${c.proof}.`);
  const crit = (round.critique?.criteria ?? []).filter((c) => !c.ok).map((c) => `${c.key} (${c.score}/10) : ${c.instruction || c.proof}`);
  return [...round.errors, ...failed, ...crit].join(" ");
}

/** Étalonnage : écart moyen entre la note pondérée humaine et celle du contrôleur, sur les mêmes Reels. */
export function calibration(pairs: { human: Partial<Record<CriterionKey, number>>; ai: Partial<Record<CriterionKey, number>> }[]): Calibration {
  const valid = pairs.filter((p) => CRITIQUE_GRID.every((c) => Number.isFinite(p.human[c.key]) && Number.isFinite(p.ai[c.key])));
  if (!valid.length) return { items: 0, gap: null, calibrated: false };
  const gap = Math.round((valid.reduce((n, p) => n + Math.abs(weightedScore(p.human) - weightedScore(p.ai)), 0) / valid.length) * 100) / 100;
  return { items: valid.length, gap, calibrated: valid.length >= CALIBRATION_MIN_ITEMS && gap < CALIBRATION_MAX_GAP };
}

/** Note humaine (formulaire du pilotage) : 6 critères entiers de 0 à 10. */
export function parseHumanScores(raw: unknown): { ok: true; scores: Record<CriterionKey, number> } | { ok: false; error: string } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const out = {} as Record<CriterionKey, number>;
  for (const c of CRITIQUE_GRID) {
    const v = Number(o[c.key]);
    if (!Number.isInteger(v) || v < 0 || v > 10) return { ok: false, error: `Note « ${c.label} » : entier de 0 à 10.` };
    out[c.key] = v;
  }
  return { ok: true, scores: out };
}
