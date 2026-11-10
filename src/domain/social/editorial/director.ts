import { StoryboardSchema, type EditorialScene, type Storyboard } from "./schema";
import { brandCase } from "./render";

/**
 * AI MOTION DIRECTOR — du texte (script ou transcription) au storyboard. Deux chemins :
 * 1. l'IA (directorBrief → JSON) éditorialise : ce qui devient énorme, chiffre, capsules, rupture, CTA ;
 * 2. sinon, un découpage déterministe (directFromScript) garantit toujours un storyboard valide.
 * Garde-fous identiques pour les deux : aucun chiffre qui n'est pas dans le texte, aucun témoignage ni note inventés,
 * « BeeRecos » bien écrit, alternance des fonds, transitions variées (60 % gauche→droite, 30 % droite→gauche).
 */
const FILLERS = /\b(aujourd'hui|en fait|vraiment|simplement|juste|du coup|tout simplement|euh|bon|alors que|en effet)\b/gi;
// Appel à l'action : un verbe à l'impératif parmi les premiers mots de la phrase (« tu ne viens pas… » n'en est pas un).
const CTA_RE = /^(?:[^\s]+\s+){0,2}(commente|commentez|rejoins|rejoignez|inscris|inscrivez|découvre|découvrez|viens|venez|clique|cliquez|réserve|réservez)\b/i;
const HUMAN_RE = /\b(confiance|humain|équipe|ensemble|relation|toi|vous|émotion|cœur)\b/i;
const STRONG = ["réseau", "recommandation", "recommande", "confiance", "clients", "business", "club", "clubs", "entrepreneurs", "chiffre", "affaires", "opportunités"];

const sentences = (t: string) => t.replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
const upper = (t: string) => brandCase(t.toLocaleUpperCase("fr-FR"));

/** Phrase → lignes courtes (≤ 16 caractères, coupées entre les mots), sans mots de remplissage. */
export function editorialLines(sentence: string, max = 4): string[] {
  const words = sentence.replace(FILLERS, "").replace(/\s+/g, " ").replace(/\s([,.;:!?])/g, "$1").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 16 && !/[,.;:!?]$/.test(last)) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return lines.slice(0, max).map(upper);
}

const numberIn = (t: string) => {
  const m = /(\d[\d\s]*(?:[.,]\d+)?)\s*(%|€)?/.exec(t);
  return m ? { raw: m[0], value: Number(m[1].replace(/\s/g, "").replace(",", ".")), suffix: m[2] ? (m[2] === "%" ? " %" : " €") : "", decimals: /[.,]/.test(m[1]) ? 1 : 0, index: m.index } : null;
};
const listItems = (t: string) => t.split(/,|\bet\b|;|:/).map((x) => x.trim()).filter((x) => x.split(" ").length >= 1 && x.length >= 3);

const BG_CYCLE = ["dark", "brand", "dark", "light", "light", "dark", "brand", "dark"] as const;
const TRANSITIONS = ["wipe-lr", "wipe-rl", "wipe-lr", "cut", "wipe-lr", "wipe-rl", "wipe-lr", "wipe-lr"] as const;

/** Découpage déterministe : toujours un storyboard valide, jamais un fait inventé. */
export function directFromScript(script: string, opts: { intensity?: number; keyword?: string | null; mascot?: boolean } = {}): Storyboard {
  const all = sentences(script).filter((x) => x.length > 2);
  const scenes: EditorialScene[] = [];
  const ctaIdx = all.findLastIndex((x) => CTA_RE.test(x));
  const cta = ctaIdx >= 0 ? all[ctaIdx] : null;
  const body = all.filter((_, i) => i !== ctaIdx);
  const id = () => `s${scenes.length + 1}`;
  body.slice(0, 6).forEach((sent, i) => {
    const voice = brandCase(sent).slice(0, 260);
    const num = numberIn(sent);
    const items = listItems(sent);
    if (i === 0 && num) {
      const before = sent.slice(0, num.index).trim(), after = sent.slice(num.index + num.raw.length).trim();
      const rest = editorialLines(after, 3);
      scenes.push({ id: id(), voice, type: "hook-stat", background: "dark", layout: "left", transitionOut: "wipe-lr", ...(before ? { lead: editorialLines(before, 1)[0] } : {}), stat: { value: num.value, prefix: "", suffix: num.suffix.trim() ? num.suffix : "", decimals: num.decimals }, lines: rest.slice(0, -1).slice(0, 2), ...(rest.length ? { accent: rest[rest.length - 1] } : {}) });
    } else if (items.length >= 3 && items.length <= 6 && items.every((x) => x.split(" ").length <= 6)) {
      const [title, ...pills] = items;
      scenes.push({ id: id(), voice, type: "pills", background: "dark", layout: "left", transitionOut: "wipe-lr", title: editorialLines(title, 1)[0], pills: pills.slice(0, 5).map((p) => brandCase(p.charAt(0).toUpperCase() + p.slice(1)).slice(0, 32)) });
    } else if (HUMAN_RE.test(sent) && sent.includes("?")) {
      const [q, a] = sent.split("?");
      scenes.push({ id: id(), voice, type: "human", background: "light", layout: "left", transitionOut: "wipe-lr", question: editorialLines(q + " ?", 3), answer: (editorialLines(a || q, 1)[0] ?? "").slice(0, 40) || "ENSEMBLE." });
    } else {
      const lines = editorialLines(sent, 4);
      const accent = STRONG.find((w) => lines.join(" ").toLowerCase().includes(w));
      scenes.push({ id: id(), voice, type: "statement", background: "dark", layout: "left", transitionOut: "wipe-lr", lines, accentWords: accent ? [accent.toUpperCase()] : [] });
    }
  });
  const keyword = opts.keyword?.toUpperCase() ?? (cta?.match(/comment(?:e|ez)\s+«?\s*([A-ZÀ-Ýa-zà-ÿ]+)/i)?.[1]?.toUpperCase() ?? null);
  const ctaVoice = cta ? brandCase(cta).slice(0, 260) : keyword ? `Commente ${keyword} pour recevoir ton invitation.` : undefined;
  scenes.push({ id: id(), ...(ctaVoice ? { voice: ctaVoice } : {}), type: "cta", background: "dark", layout: "left", transitionOut: "none", lines: ["ALORS,", "ON SE VOIT", "AU CLUB ?"], ...(cta ? { sub: brandCase(cta).slice(0, 60) } : keyword ? { sub: `Commente ${keyword} pour recevoir ton invitation.` } : {}), button: "DÉCOUVRIR UN CLUB", brand: true });
  return finalize({ preset: "editorial-impact", intensity: opts.intensity ?? 4, bpm: 120, sfx: "normal", mascot: opts.mascot ?? false, scenes }, script);
}

/** Règles appliquées à tout storyboard (IA ou déterministe) : fonds alternés, transitions variées, chiffres vérifiés. */
export function finalize(raw: unknown, source: string): Storyboard {
  const sb = StoryboardSchema.parse(raw);
  const said = new Set((source.match(/\d+(?:[.,]\d+)?/g) ?? []).map((d) => d.replace(",", ".")));
  const kept = sb.scenes.filter((s) => s.type !== "hook-stat" || said.has(String(s.stat.value)) || said.has(s.stat.value.toFixed(s.stat.decimals)));
  const scenes: EditorialScene[] = [];
  kept.forEach((s, i) => {
    // La scène humaine reste claire, le CTA sombre ; jamais trois fonds identiques à la suite.
    let background = s.type === "human" ? "light" : s.type === "cta" ? "dark" : s.background;
    const [p1, p2] = [scenes[i - 1], scenes[i - 2]];
    if (p1 && p2 && p1.background === background && p2.background === background) {
      if (s.type === "cta" || s.type === "human") scenes[i - 1] = { ...p1, background: background === "brand" ? "dark" : "brand" } as EditorialScene;
      else background = BG_CYCLE.find((b) => b !== p1.background) ?? "brand";
    }
    scenes.push({ ...s, background, transitionOut: i === kept.length - 1 ? "none" : s.transitionOut === "none" ? TRANSITIONS[i % TRANSITIONS.length] : s.transitionOut } as EditorialScene);
  });
  return StoryboardSchema.parse({ ...sb, scenes });
}

/** Consigne pour l'IA (même contrat de sortie que le découpage déterministe). */
export function directorBrief(script: string, opts: { keyword?: string | null; testimonials?: { quote: string; author: string }[]; rating?: number | null; idea?: boolean; facts?: { date: string; text: string; source: string }[] } = {}): string {
  return `AI MOTION DIRECTOR — Reel « Editorial Impact » BeeRecos (1080×1920), voix off d'Audrey. DURÉE : environ 30 s de contenu (la vidéo de fin BeeRecos est ajoutée automatiquement après), soit 70 à 75 mots de voix au total.
Tu es scénariste, directeur artistique et monteur. ${opts.idea ? "On te donne une IDÉE : écris d'abord la voix off (tutoiement, phrases courtes, ≈ 155 mots/min) en prenant BeeRecos pour référence — uniquement ce que dit la base de connaissances BeeRecos fournie (réseau d'affaires, clubs, recommandation, offres, cibles, FAQ) —, puis éditorialise-la." : "On te donne le texte de la voix : garde ses phrases et éditorialise-le."} Tu ne fais PAS des sous-titres : décide de ce qui devient énorme (chiffre), une affirmation, une liste de capsules, une rupture humaine, des témoignages, puis l'appel à l'action.
Structure : HOOK (problème, curiosité ou provocation) → valeur (1 à 3 scènes, une idée par scène) → rupture humaine si elle sert le propos → CTA.
Règles :
- Chaque scène a "voice" : la phrase exacte dite par Audrey (8 à 18 mots), différente du texte à l'écran, qui reste court. Total de toutes les voix : 70 à 75 mots.
- 5 à 6 scènes. Première scène = accroche (hook-stat si un chiffre est dit, sinon statement en question). Dernière = cta.
- Lignes courtes en CAPITALES (2 à 4 mots, 16 caractères maximum par ligne), 1 à 4 lignes par scène. Supprime le remplissage. Écris toujours « BeeRecos ».
- Aucun chiffre, nom, témoignage ou note qui ne soit dans le texte ou fourni ci-dessous. Pas de scène testimonials sans témoignages fournis.
- Fonds alternés (dark, brand, dark, light, light, dark…), jamais trois fois le même à la suite. Scène human sur fond light.
- transitionOut : "wipe-lr" le plus souvent, "wipe-rl" parfois, "cut" rarement ; la dernière scène "none".
- Bouton du CTA : DÉCOUVRIR UN CLUB, PARTICIPER À UNE RÉUNION, RECEVOIR MON INVITATION ou EN SAVOIR PLUS, selon le texte.${opts.keyword ? `\n- Mot-clé du CTA : « Commente ${opts.keyword.toUpperCase()} ».` : ""}
Types (tous avec "voice") : hook-stat {lead?, stat:{value,suffix,decimals}, lines[], accent?}, statement {lines[], accentWords[], micro?}, pills {title, pills[2-5]}, human {question[], answer, micro?}, testimonials {title, cards[{quote,author}], rating?}, cta {lines[], sub?, button, brand:true}.
Réponds UNIQUEMENT par un objet JSON : {"preset":"editorial-impact","intensity":4,"bpm":120,"sfx":"normal","scenes":[{"id":"s1","type":"…","background":"…","layout":"left",…}]}
${opts.testimonials?.length ? `\nTÉMOIGNAGES FOURNIS (seuls autorisés, 12 à 20 mots chacun, raccourcis sans changer le sens) :\n${opts.testimonials.map((t) => `- « ${t.quote} » — ${t.author}`).join("\n")}` : ""}${opts.rating ? `\nNOTE FOURNIE : ${opts.rating} / 5` : ""}

${opts.facts?.length ? `FAITS TROUVÉS SUR LE WEB (sources vérifiées) — sers-t'en pour l'accroche ou la preuve, puis fais le lien avec BeeRecos ; ce sont les seuls chiffres autorisés en plus de l'idée, recopiés tels quels, et la source va dans le "micro" de la scène (ex. « Source : Ifop, 2024 ») :
${opts.facts.map((f) => `- ${f.date ? `${f.date} : ` : ""}${f.text} (${f.source})`).join("\n")}

` : ""}${opts.idea ? "IDÉE" : "TEXTE"} :
${script.trim()}`;
}

/** Réponse de l'IA → storyboard validé ; en cas d'échec, le découpage déterministe. */
export function parseDirector(raw: string, script: string, opts: { intensity?: number; keyword?: string | null; mascot?: boolean } = {}): { storyboard: Storyboard; source: "ai" | "rules" } {
  try {
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "");
    // Chiffre à l'écran : seulement s'il est dans l'idée ou le texte fourni (finalize) ; voix : voir inventedNumbers.
    return { storyboard: finalize({ ...json, intensity: opts.intensity ?? json.intensity ?? 4, mascot: opts.mascot ?? false }, script), source: "ai" };
  } catch {
    return { storyboard: directFromScript(script, opts), source: "rules" };
  }
}

/** Chiffres de la voix off absents du texte fourni : affichés à corriger (aucun chiffre inventé ne part en vidéo). */
export function inventedNumbers(sb: Storyboard, source: string): { sceneId: string; numbers: string[] }[] {
  const said = new Set((source.match(/\d+(?:[.,]\d+)?/g) ?? []).map((d) => d.replace(",", ".")));
  return sb.scenes.flatMap((s) => {
    const numbers = (s.voice?.match(/\d+(?:[.,]\d+)?/g) ?? []).filter((d) => !said.has(d.replace(",", ".")));
    return numbers.length ? [{ sceneId: s.id, numbers }] : [];
  });
}
