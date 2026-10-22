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
