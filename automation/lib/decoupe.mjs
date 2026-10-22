// Découpe d'un long fichier de tournage (une session studio qui enchaîne des dizaines de Reels) en une prise par Reel.
// Logique PURE (testée) : lecture des silences ffmpeg, choix des coupes, contrôle du plan édité à la main.
// Le fichier source n'est jamais décodé en image : seule la piste audio est lue pour trouver les pauses.

/** Durée minimale d'un Reel proposé (ms) : en dessous, c'est un faux départ, pas un Reel. */
export const MIN_REEL_MS = 8000;
/** Durée maximale d'un Reel (3 min) : au-delà, le Montage le refusera. */
export const MAX_REEL_MS = 180_000;
/** Marge gardée de chaque côté d'une coupe (ms) : on ne mange jamais le début ou la fin d'une phrase. */
export const PAD_MS = 400;

/** Silences détectés par `ffmpeg -af silencedetect` (lignes silence_start / silence_end sur stderr). */
export function parseSilences(log, durationMs) {
  const out = [];
  let start = null;
  for (const line of log.split("\n")) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    if (s) start = Math.max(0, Math.round(Number(s[1]) * 1000));
    const e = line.match(/silence_end: ([\d.]+)/);
    if (e && start !== null) {
      out.push({ startMs: start, endMs: Math.round(Number(e[1]) * 1000) });
      start = null;
    }
  }
  // Silence qui court jusqu'à la fin du fichier (pas de silence_end).
  if (start !== null && durationMs) out.push({ startMs: start, endMs: durationMs });
  return out;
}

/**
 * Plan de découpe : chaque silence assez long sépare deux Reels. Avec `expected` (ex. 72 Reels annoncés), on garde les
 * expected − 1 pauses les plus longues, sans jamais créer un morceau plus court que MIN_REEL_MS. Les silences de tête
 * et de queue du fichier sont retirés. Renvoie les morceaux { n, fromMs, toMs } et les avertissements à relire.
 */
export function planSplit(silences, durationMs, { expected, minReelMs = MIN_REEL_MS, padMs = PAD_MS } = {}) {
  let head = 0, tail = durationMs;
  const inner = [];
  for (const s of silences) {
    if (s.startMs <= 0) head = Math.max(head, s.endMs - padMs);
    else if (s.endMs >= durationMs) tail = Math.min(tail, s.startMs + padMs);
    else inner.push(s);
  }
  const ranked = [...inner].sort((a, b) => b.endMs - b.startMs - (a.endMs - a.startMs));
  const chosen = [];
  const fits = (cut) => {
    const points = [head, ...[...chosen, cut].map((c) => (c.startMs + c.endMs) / 2).sort((a, b) => a - b), tail];
    return points.every((p, i) => i === 0 || p - points[i - 1] >= minReelMs);
  };
  for (const s of ranked) {
    if (expected && chosen.length >= expected - 1) break;
    if (fits(s)) chosen.push(s);
  }
  chosen.sort((a, b) => a.startMs - b.startMs);
  const segments = [];
  let from = head;
  for (const c of [...chosen, { startMs: tail - padMs, endMs: tail }]) {
    const to = Math.min(c.startMs + padMs, tail);
    segments.push({ n: segments.length + 1, fromMs: Math.max(0, Math.round(from)), toMs: Math.round(to), titre: "" });
    from = Math.max(c.endMs - padMs, to);
  }
  return { segments, warnings: planWarnings(segments, expected) };
}

const pad2 = (n) => String(n).padStart(2, "0");
/** 3 723 400 ms → « 1:02:03.4 ». */
export function clock(ms) {
  const t = Math.round(ms / 100) / 10;
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = (t % 60).toFixed(1);
  return `${h}:${pad2(m)}:${s.padStart(4, "0")}`;
}

function planWarnings(segments, expected) {
  const w = [];
  if (expected && segments.length !== expected) w.push(`${segments.length} Reels trouvés pour ${expected} annoncés : relis les pauses (fusionne ou sépare à la main dans le fichier de découpe).`);
  for (const s of segments) {
    const d = s.toMs - s.fromMs;
    if (d > MAX_REEL_MS) w.push(`Reel ${s.n} (${clock(s.fromMs)}) dure ${Math.round(d / 1000)} s : plus de 3 min, sans doute deux Reels collés.`);
  }
  return w;
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* ANNONCES « V12 + titre » : au début de chaque Reel, la prise est annoncée (« V12, le réseau qui recommande »), puis */
/* le titre est redit pour commencer le Reel. Le transcript de la session suffit alors à couper, numéroter et nommer. */
/* ---------------------------------------------------------------------------------------------------------------- */

const UNITS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16 };
const TENS = { vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };
/** Façons dont la transcription écrit la lettre « V » prononcée seule (ou la développe en « vidéo »). */
const V_TOKENS = new Set(["v", "ve", "vee", "vay", "video"]);

const plain = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Mots → jetons sans accent ni ponctuation (« soixante-douze » donne deux jetons), chacun relié à son mot. */
export function tokenize(words) {
  return words.flatMap((w, wi) => plain(w.text).split(" ").filter(Boolean).map((t) => ({ t, wi })));
}

/**
 * Nombre écrit en chiffres ou en lettres à partir du jeton i (1 à 999) : « 72 », « soixante douze », « soixante et
 * onze », « quatre vingt dix sept ». Chaque terme ajouté est plus petit que le précédent (« deux trois » s'arrête à 2).
 */
export function readNumber(tokens, i) {
  const first = tokens[i]?.t;
  if (first && /^\d{1,3}$/.test(first)) return { value: Number(first), len: 1 };
  let value = 0, last = Infinity, j = i;
  while (j < tokens.length && j < i + 5) {
    const t = tokens[j].t;
    let v;
    if (t === "quatre" && /^vingts?$/.test(tokens[j + 1]?.t ?? "")) { v = 80; j++; }
    else if (t === "et" && value) { j++; continue; }
    else v = TENS[t] ?? UNITS[t];
    if (v === undefined || v >= last) break;
    value += v; last = v; j++;
  }
  return value ? { value, len: j - i } : null;
}

/** Pause minimale avant une annonce (ms), sauf si elle suit la précédente dans l'ordre (V11 puis V12). */
const SLATE_PAUSE_MS = 700;
/** Pause qui termine le titre annoncé (ms). */
const TITLE_PAUSE_MS = 600;

/**
 * Annonces trouvées dans le transcript : { n, atMs, titre, startMs, redit }. `startMs` est le début du titre REDIT
 * (le Reel commence là) ; si le titre n'est pas redit dans les 30 s, le Reel commence au premier mot après le numéro
 * et `titre` n'est qu'une proposition (les premiers mots dits).
 */
export function findSlates(words) {
  const tokens = tokenize(words);
  const slates = [];
  let last = 0;
  for (let i = 0; i < tokens.length; i++) {
    let num = null, after;
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
    // Titre annoncé : les mots qui suivent le numéro, jusqu'à une pause (15 mots au plus).
    const firstWord = after < tokens.length ? tokens[after].wi : words.length;
    let end = firstWord;
    while (end < words.length && end - firstWord < 15 && (end === firstWord || words[end].startMs - words[end - 1].endMs < TITLE_PAUSE_MS)) end++;
    const titleWords = words.slice(firstWord, end);
    const titre = titleWords.map((w) => w.text.trim()).join(" ").replace(/[\s.,;:!?…]+$/, "");
    // Titre redit : les premiers jetons du titre se retrouvent juste après (le Reel commence là).
    const key = tokenize(titleWords).slice(0, 3).map((k) => k.t);
    // Sans titre redit (annonce seule « V3 », ou titre dit une fois), le Reel commence juste après le numéro :
    // on ne retire que l'annonce, jamais une phrase.
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

/**
 * Plan de découpe à partir des annonces : chaque Reel va du titre redit jusqu'au dernier mot avant l'annonce
 * suivante (l'annonce elle-même est retirée). Une annonce répétée (prise refaite) garde la DERNIÈRE ; les numéros
 * manquants et les titres non redits sont signalés.
 */
export function planFromSlates(slates, words, durationMs, { expected, padMs = PAD_MS } = {}) {
  const ordered = [...slates].sort((a, b) => a.atMs - b.atMs);
  const warnings = [];
  const lastOf = new Map(ordered.map((s, i) => [s.n, i]));
  const segments = [];
  ordered.forEach((s, i) => {
    const next = ordered[i + 1];
    const limit = next ? next.atMs : durationMs;
    if (lastOf.get(s.n) !== i) return warnings.push(`V${s.n} annoncé plusieurs fois : la dernière prise est gardée (la précédente, à ${clock(s.atMs)}, est écartée).`);
    const spoken = words.filter((w) => w.startMs >= s.startMs && w.endMs <= limit);
    const endMs = spoken.length ? spoken.at(-1).endMs : s.startMs;
    segments.push({ n: s.n, fromMs: Math.max(0, s.startMs - padMs), toMs: Math.min(limit, endMs + padMs, durationMs), titre: s.titre });
    if (!s.redit) warnings.push(`V${s.n} : pas de titre redit, le Reel commence juste après « V${s.n} » (${clock(s.startMs)}) ; titre proposé « ${s.titre || "?"} » à vérifier.`);
  });
  const top = Math.max(expected ?? 0, ...segments.map((s) => s.n));
  const missing = Array.from({ length: top }, (_, k) => k + 1).filter((n) => !lastOf.has(n));
  if (missing.length) warnings.push(`Annonce introuvable pour : ${missing.map((n) => `V${n}`).join(", ")} (mal transcrite ? coupe ces Reels à la main dans le fichier de découpe).`);
  warnings.push(...planWarnings(segments, undefined));
  return { segments, warnings };
}

/** Contrôle d'un plan relu à la main : morceaux dans l'ordre, sans chevauchement, dans la durée du fichier. */
export function checkPlan(plan, durationMs) {
  const errors = [];
  if (!plan || !Array.isArray(plan.segments) || !plan.segments.length) return ["• segments → au moins un Reel attendu"];
  let last = 0;
  plan.segments.forEach((s, i) => {
    const at = `• segments[${i}]`;
    if (!Number.isFinite(s?.fromMs) || !Number.isFinite(s?.toMs)) return errors.push(`${at} → fromMs et toMs en millisecondes attendus`);
    if (s.toMs - s.fromMs < 1000) errors.push(`${at} → moins d'1 s (${s.fromMs} → ${s.toMs})`);
    if (s.fromMs < last) errors.push(`${at} → commence avant la fin du Reel précédent`);
    if (durationMs && s.toMs > durationMs + 50) errors.push(`${at} → finit après la fin du fichier (${s.toMs} > ${durationMs} ms)`);
    if (s.titre !== undefined && typeof s.titre !== "string") errors.push(`${at} → titre en texte attendu`);
    if (s.n !== undefined && !(Number.isInteger(s.n) && s.n >= 1)) errors.push(`${at} → n (numéro du Reel) entier attendu`);
    else if (s.n !== undefined && plan.segments.findIndex((x) => x?.n === s.n) !== i) errors.push(`${at} → numéro ${s.n} déjà utilisé`);
    last = s.toMs;
  });
  return errors;
}

/** Nom de fichier d'un Reel découpé : reel-07-mon-titre.mp4 (sans accent ni espace, accepté par le Montage). */
export function segmentName(s, width = 2) {
  const slug = (s.titre ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `reel-${String(s.n).padStart(width, "0")}${slug ? `-${slug}` : ""}.mp4`;
}

/** Arguments ffmpeg d'un Reel : copie sans réencodage (rapide, coupe calée sur l'image clé précédente) ou version web. */
export function ffmpegArgs(source, s, out, { web = false } = {}) {
  const at = ["-ss", (s.fromMs / 1000).toFixed(3), "-i", source, "-t", ((s.toMs - s.fromMs) / 1000).toFixed(3)];
  const codec = web
    ? ["-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale='if(gt(iw,ih),-2,1080)':'if(gt(iw,ih),1080,-2)'", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"]
    : ["-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-avoid_negative_ts", "make_zero"];
  return ["-v", "error", "-y", ...at, ...codec, out];
}
