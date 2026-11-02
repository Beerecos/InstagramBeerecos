/**
 * Long tournage des 72 réels : repérage des annonces « V12 + titre » dans la transcription de la session et plan de
 * découpe à vérifier. Reprise en TypeScript de `automation/lib/decoupe.mjs` (branche claude/amazing-mayer-00r1ac),
 * logique pure et testée. Le rush original n'est jamais modifié : un segment n'est qu'une paire de bornes.
 * Jamais de découpe en parts égales ; une association incertaine reste « à vérifier ».
 */

export type Word = { text: string; startMs: number; endMs: number };
export type Slate = { n: number; atMs: number; titre: string; startMs: number; redit: boolean };
export type Segment = { n: number; fromMs: number; toMs: number; titre: string };

export const PAD_MS = 400;
export const MAX_REEL_MS = 180_000;

const UNITS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16 };
const TENS: Record<string, number> = { vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };
/** Façons dont la transcription écrit la lettre « V » prononcée seule (ou la développe en « vidéo »). */
const V_TOKENS = new Set(["v", "ve", "vee", "vay", "video"]);

export const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

type Token = { t: string; wi: number };
export function tokenize(words: Word[]): Token[] {
  return words.flatMap((w, wi) => plain(w.text).split(" ").filter(Boolean).map((t) => ({ t, wi })));
}

/** Nombre en chiffres ou en lettres (1 à 999) : « 72 », « soixante douze », « soixante et onze ». */
export function readNumber(tokens: Token[], i: number): { value: number; len: number } | null {
  const first = tokens[i]?.t;
  if (first && /^\d{1,3}$/.test(first)) return { value: Number(first), len: 1 };
  let value = 0, last = Infinity, j = i;
  while (j < tokens.length && j < i + 5) {
    const t = tokens[j].t;
    let v: number | undefined;
    if (t === "quatre" && /^vingts?$/.test(tokens[j + 1]?.t ?? "")) { v = 80; j++; }
    else if (t === "et" && value) { j++; continue; }
    else v = TENS[t] ?? UNITS[t];
    if (v === undefined || v >= last) break;
    value += v; last = v; j++;
  }
  return value ? { value, len: j - i } : null;
}

const SLATE_PAUSE_MS = 700;
const TITLE_PAUSE_MS = 600;

/** Annonces trouvées : `startMs` = début du titre redit (le réel commence là), sinon juste après le numéro. */
export function findSlates(words: Word[]): Slate[] {
  const tokens = tokenize(words);
  const slates: Slate[] = [];
  let last = 0;
  for (let i = 0; i < tokens.length; i++) {
    let num: number | null = null, after = 0;
    const glued = tokens[i].t.match(/^v(\d{1,3})$/);
    if (glued) { num = Number(glued[1]); after = i + 1; }
    else if (V_TOKENS.has(tokens[i].t)) {
      const r = readNumber(tokens, i + 1);
      if (r) { num = r.value; after = i + 1 + r.len; }
    }
    if (!num) continue;
    const wi = tokens[i].wi;
    const pause = wi === 0 || words[wi].startMs - words[wi - 1].endMs >= SLATE_PAUSE_MS;
    if (!pause && num !== last + 1) continue;
    const firstWord = after < tokens.length ? tokens[after].wi : words.length;
    let end = firstWord;
    while (end < words.length && end - firstWord < 15 && (end === firstWord || words[end].startMs - words[end - 1].endMs < TITLE_PAUSE_MS)) end++;
    const titleWords = words.slice(firstWord, end);
    const titre = titleWords.map((w) => w.text.trim()).join(" ").replace(/[\s.,;:!?…]+$/, "");
    const key = tokenize(titleWords).slice(0, 3).map((k) => k.t);
    let start = firstWord, redit = false;
    if (key.length) {
      const rest = tokenize(words.slice(end)).map((k) => ({ ...k, wi: k.wi + end }));
      for (let k = 0; k + key.length <= rest.length; k++) {
        if (words[rest[k].wi].startMs - (titleWords.at(-1)?.endMs ?? 0) > 30_000) break;
        if (key.every((t, x) => rest[k + x].t === t)) { start = rest[k].wi; redit = true; break; }
      }
    }
    if (start >= words.length) continue;
    slates.push({ n: num, atMs: words[wi].startMs, titre, startMs: words[start].startMs, redit });
    last = num;
    i = tokens.findIndex((t) => t.wi >= start) - 1;
    if (i < 0) break;
  }
  return slates;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** 3 723 400 ms → « 1:02:03.4 ». */
export function clock(ms: number): string {
  const t = Math.round(ms / 100) / 10;
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = (t % 60).toFixed(1);
  return `${h}:${pad2(m)}:${s.padStart(4, "0")}`;
}

/** Plan à partir des annonces : l'annonce est retirée ; une prise refaite garde la DERNIÈRE ; les manques sont signalés. */
export function planFromSlates(slates: Slate[], words: Word[], durationMs: number, { expected, padMs = PAD_MS }: { expected?: number; padMs?: number } = {}): { segments: Segment[]; warnings: string[] } {
  const ordered = [...slates].sort((a, b) => a.atMs - b.atMs);
  const warnings: string[] = [];
  const lastOf = new Map(ordered.map((s, i) => [s.n, i]));
  const segments: Segment[] = [];
  ordered.forEach((s, i) => {
    const next = ordered[i + 1];
    const limit = next ? next.atMs : durationMs;
    if (lastOf.get(s.n) !== i) { warnings.push(`V${s.n} annoncé plusieurs fois : la dernière prise est gardée (la précédente, à ${clock(s.atMs)}, est écartée).`); return; }
    const spoken = words.filter((w) => w.startMs >= s.startMs && w.endMs <= limit);
    const endMs = spoken.length ? spoken[spoken.length - 1].endMs : s.startMs;
    segments.push({ n: s.n, fromMs: Math.max(0, s.startMs - padMs), toMs: Math.min(limit, endMs + padMs, durationMs), titre: s.titre });
    if (!s.redit) warnings.push(`V${s.n} : titre non redit, le réel commence juste après l'annonce (${clock(s.startMs)}) ; titre « ${s.titre || "?"} » à vérifier.`);
  });
  const top = Math.max(expected ?? 0, ...segments.map((s) => s.n));
  const missing = Array.from({ length: top }, (_, k) => k + 1).filter((n) => !lastOf.has(n));
  if (missing.length) warnings.push(`Annonce introuvable pour : ${missing.map((n) => `V${n}`).join(", ")} (prise manquante ou mal transcrite : à associer à la main).`);
  for (const s of segments) if (s.toMs - s.fromMs > MAX_REEL_MS) warnings.push(`V${s.n} (${clock(s.fromMs)}) dure ${Math.round((s.toMs - s.fromMs) / 1000)} s : plus de 3 min, sans doute deux réels collés.`);
  return { segments, warnings };
}

/** Contrôle d'un plan relu : bornes en ordre, sans chevauchement, dans la durée du fichier, numéros uniques. */
export function checkPlan(segments: Segment[], durationMs: number): string[] {
  const errors: string[] = [];
  if (!segments.length) return ["Au moins un segment attendu."];
  let last = 0;
  segments.forEach((s, i) => {
    const at = `Segment ${i + 1}`;
    if (!Number.isFinite(s.fromMs) || !Number.isFinite(s.toMs)) { errors.push(`${at} : début et fin attendus.`); return; }
    if (s.toMs - s.fromMs < 1000) errors.push(`${at} : moins d'1 s.`);
    if (s.fromMs < last) errors.push(`${at} : commence avant la fin du segment précédent.`);
    if (durationMs && s.toMs > durationMs + 50) errors.push(`${at} : finit après la fin du rush.`);
    if (segments.findIndex((x) => x.n === s.n) !== i) errors.push(`${at} : numéro V${s.n} déjà utilisé.`);
    last = s.toMs;
  });
  return errors;
}

/** Nom d'un extrait : reel-07-mon-titre.mp4. */
export function segmentName(s: Pick<Segment, "n" | "titre">): string {
  const slug = plain(s.titre ?? "").replace(/ /g, "-").slice(0, 40);
  return `reel-${String(s.n).padStart(2, "0")}${slug ? `-${slug}` : ""}.mp4`;
}

/**
 * Commande FFmpeg d'un extrait, à exécuter là où le rush est stocké : réencodage H.264/AAC (coupe exacte à l'image,
 * qualité conservée par CRF 18) ; le rush n'est lu que sur l'intervalle, jamais recopié en entier.
 */
export function ffmpegCommand(source: string, s: Segment): string {
  const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
  return ["ffmpeg -v error -y", `-ss ${(s.fromMs / 1000).toFixed(3)}`, `-i ${q(source)}`, `-t ${((s.toMs - s.fromMs) / 1000).toFixed(3)}`,
    "-map 0:v:0 -map 0:a:0? -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart", q(segmentName(s))].join(" ");
}
