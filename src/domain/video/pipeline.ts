import type { CaptionWord, Range } from "./edit.ts";

/**
 * Pipeline déterministe d'une prise : transcript → recalage sur l'énergie audio → plan de coupe → morceaux gardés.
 * Le LLM décide (quelles phrases retirer), ces fonctions exécutent : aucune n'invente de mot ni de temps.
 */

/** Sortie de `hyperframes transcribe` : secondes → millisecondes de la prise. */
export function normalizeTranscript(words: { text: string; start: number; end: number }[]): CaptionWord[] {
  return words
    .filter((w) => w.text.trim())
    .map((w) => ({ text: ` ${w.text.trim()}`, startMs: Math.round(w.start * 1000), endMs: Math.max(Math.round(w.end * 1000), Math.round(w.start * 1000) + 1) }));
}

export const FRAME_MS = 20;

/** Énergie en dB par fenêtre de 20 ms, à partir d'échantillons PCM 16 bits mono. */
export function energyFrames(samples: Int16Array, sampleRate: number, frameMs = FRAME_MS): number[] {
  const size = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += size) {
    let sum = 0;
    const end = Math.min(i + size, samples.length);
    for (let j = i; j < end; j++) sum += (samples[j] / 32768) ** 2;
    out.push(Math.max(-100, 10 * Math.log10(sum / (end - i) || 1e-10)));
  }
  return out;
}

/** Seuil de parole : bruit de fond (15e centile) + 6 dB. */
export function speechThreshold(frames: number[]): number {
  if (!frames.length) return 0;
  const sorted = [...frames].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.15)] + 6;
}

/** Îlots de parole [début, fin) en ms ; les silences plus courts que `minGapMs` ne coupent pas un îlot. */
export function speechIslands(frames: number[], opts: { frameMs?: number; minGapMs?: number } = {}): Range[] {
  const { frameMs = FRAME_MS, minGapMs = 300 } = opts;
  const thr = speechThreshold(frames);
  const islands: Range[] = [];
  frames.forEach((db, i) => {
    if (db < thr) return;
    const from = i * frameMs;
    const last = islands[islands.length - 1];
    if (last && from - last.toMs < minGapMs) last.toMs = from + frameMs;
    else islands.push({ fromMs: from, toMs: from + frameMs });
  });
  return islands;
}

/**
 * Recale les mots sur la parole réellement entendue. Whisper étire souvent les mots sur les silences et place
 * trop tôt ceux qui suivent une pause : chaque mot est rattaché à l'îlot de parole qui contient son milieu
 * (à défaut, l'îlot suivant), puis les mots d'un même îlot sont ramenés proportionnellement dans ses bornes.
 * Un transcript déjà juste n'est pas modifié.
 */
export function refineWithEnergy(words: CaptionWord[], islands: Range[]): CaptionWord[] {
  if (!islands.length || !words.length) return words;
  const groups = new Map<number, number[]>();
  words.forEach((w, i) => {
    const mid = (w.startMs + w.endMs) / 2;
    let k = islands.findIndex((x) => mid >= x.fromMs && mid < x.toMs);
    if (k < 0) k = islands.findIndex((x) => x.fromMs > mid);
    if (k < 0) k = islands.length - 1;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const out = words.map((w) => ({ ...w }));
  for (const [k, idx] of groups) {
    const island = islands[k];
    const a = words[idx[0]].startMs;
    const b = words[idx[idx.length - 1]].endMs;
    const from = Math.max(a, island.fromMs);
    const to = Math.max(Math.min(b, island.toMs), from + idx.length);
    if (from === a && to === b) continue;
    const scale = b > a ? (to - from) / (b - a) : 0;
    for (const i of idx) {
      out[i].startMs = Math.round(from + (words[i].startMs - a) * scale);
      out[i].endMs = Math.max(Math.round(from + (words[i].endMs - a) * scale), out[i].startMs + 1);
    }
  }
  return out;
}

/** Hésitations retirées automatiquement à l'application d'une coupe. */
const FILLERS = new Set(["euh", "heu", "euhm", "hum", "hmm", "mmh", "bah", "ben"]);
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}'-]/gu, "");
export const isFiller = (w: CaptionWord) => FILLERS.has(norm(w.text));

export type Clause = {
  /** Numéro affiché (à partir de 1), utilisé par `--drop=2,5-6`. */
  n: number;
  text: string;
  fromMs: number;
  toMs: number;
  /** Indices des mots (dans le transcript) de la phrase. */
  words: number[];
  fillers: number;
  /** Raison de la suggestion de retrait (reprise, faux départ), sinon absent. */
  suggestDrop?: string;
};

const jaccard = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / (a.size + b.size - inter || 1);
};

/**
 * Plan de coupe : phrases numérotées (ponctuation ou silence > 700 ms), avec suggestions de retrait.
 * Reprise : une phrase très proche (Jaccard ≥ 0,55) de l'une des deux suivantes → on garde la dernière version.
 * Faux départ : 3 mots au plus, qui sont le début de la phrase suivante. Dans le doute, rien n'est suggéré.
 */
export function planAutoCut(words: CaptionWord[], opts: { pauseMs?: number } = {}): Clause[] {
  const { pauseMs = 700 } = opts;
  const clauses: Clause[] = [];
  let cur: number[] = [];
  const flush = () => {
    if (!cur.length) return;
    const ws = cur.map((i) => words[i]);
    clauses.push({ n: clauses.length + 1, text: ws.map((w) => w.text.trim()).join(" "), fromMs: ws[0].startMs, toMs: ws[ws.length - 1].endMs, words: cur, fillers: ws.filter(isFiller).length });
    cur = [];
  };
  words.forEach((w, i) => {
    if (cur.length && w.startMs - words[i - 1].endMs > pauseMs) flush();
    cur.push(i);
    if (/[.?!,;:…]$/.test(w.text.trim())) flush();
  });
  flush();

  const bag = (c: Clause) => new Set(c.words.map((i) => words[i]).filter((w) => !isFiller(w)).map((w) => norm(w.text)).filter(Boolean));
  const seq = (c: Clause) => c.words.map((i) => words[i]).filter((w) => !isFiller(w)).map((w) => norm(w.text));
  clauses.forEach((c, i) => {
    const mine = seq(c);
    const next = clauses[i + 1];
    if (next && mine.length > 0 && mine.length <= 3 && mine.every((t, j) => seq(next)[j] === t)) {
      c.suggestDrop = `faux départ (reprise en ${next.n})`;
      return;
    }
    if (mine.length < 3) return;
    const later = clauses.slice(i + 1, i + 3).find((o) => seq(o).length >= 3 && jaccard(bag(c), bag(o)) >= 0.55);
    if (later) c.suggestDrop = `reprise (version gardée : ${later.n})`;
  });
  return clauses;
}

/** « 2,5-6 » → {2, 5, 6}. Refuse toute autre écriture. */
export function parseDropList(list: string): Set<number> {
  const out = new Set<number>();
  if (!list.trim()) return out;
  for (const part of list.split(",")) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Liste de phrases invalide : « ${part.trim()} » (exemple : 2,5-6)`);
    const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
    if (b < a) throw new Error(`Intervalle à l'envers : « ${part.trim()} »`);
    for (let n = a; n <= b; n++) out.add(n);
  }
  return out;
}

/**
 * Morceaux gardés : mots conservés regroupés tant que le silence entre deux mots voisins fait moins de 350 ms,
 * avec 70 ms de marge avant et 110 ms après, sans jamais mordre sur un mot retiré.
 */
export function rangesFromWords(words: CaptionWord[], keep: (i: number) => boolean, opts: { joinGapMs?: number; padBeforeMs?: number; padAfterMs?: number; durationMs?: number } = {}): Range[] {
  const { joinGapMs = 350, padBeforeMs = 70, padAfterMs = 110, durationMs = Infinity } = opts;
  const ranges: Range[] = [];
  let open: { first: number; last: number } | null = null;
  const close = () => {
    if (!open) return;
    const prevEnd = open.first > 0 ? words[open.first - 1].endMs : 0;
    const nextStart = open.last < words.length - 1 ? words[open.last + 1].startMs : durationMs;
    const fromMs = Math.max(prevEnd, words[open.first].startMs - padBeforeMs, 0);
    const toMs = Math.min(nextStart, words[open.last].endMs + padAfterMs, durationMs);
    const last = ranges[ranges.length - 1];
    if (last && fromMs <= last.toMs) last.toMs = Math.max(last.toMs, toMs);
    else if (toMs > fromMs) ranges.push({ fromMs, toMs });
    open = null;
  };
  words.forEach((w, i) => {
    if (!keep(i)) return close();
    if (open && open.last === i - 1 && w.startMs - words[i - 1].endMs < joinGapMs) open.last = i;
    else {
      close();
      open = { first: i, last: i };
    }
  });
  close();
  return ranges;
}

/** Applique un plan : retire les phrases choisies et toutes les hésitations, puis recalcule les morceaux. */
export function applyAutoCut(words: CaptionWord[], clauses: Clause[], drop: Set<number>, durationMs?: number): Range[] {
  const unknown = [...drop].filter((n) => !clauses.some((c) => c.n === n));
  if (unknown.length) throw new Error(`Phrase(s) inexistante(s) : ${unknown.join(", ")} (le plan en compte ${clauses.length})`);
  const dropped = new Set(clauses.filter((c) => drop.has(c.n)).flatMap((c) => c.words));
  return rangesFromWords(words, (i) => !dropped.has(i) && !isFiller(words[i]), { durationMs });
}
