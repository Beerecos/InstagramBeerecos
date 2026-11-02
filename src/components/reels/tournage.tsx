"use client";
/**
 * Tournage : (A) fichiers déjà séparés → un projet par fichier, associé à un des 72 scripts ; (B) long rush → plan de
 * segments proposé depuis les annonces « V12 + titre » de la transcription, à vérifier et corriger, puis extraits.
 * Le rush original n'est jamais modifié ni envoyé en entier par cette page. Aucun découpage n'est simulé.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { isMontageConfigured, montage, reels, type ReelSummary } from "@/lib/social/montage-api";
import { matchCatalogue, type CatalogueEntry, type Match } from "@/domain/tournage/match";
import { checkPlan, clock, ffmpegCommand, findSlates, planFromSlates, segmentName, type Segment, type Word } from "@/domain/tournage/slates";
import { parseClock, parseTranscript } from "@/domain/tournage/transcript";

const CONF: Record<Match["confidence"], string> = { numero: "numéro annoncé", titre: "titre proche (à vérifier)", incertain: "incertain : choisis", aucun: "aucune correspondance" };

function durationOf(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(v.src); Number.isFinite(d) ? resolve(Math.round(d * 1000)) : reject(new Error("Durée illisible.")); };
    v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error("Format vidéo non lisible par le navigateur.")); };
    v.src = URL.createObjectURL(file);
  });
}
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const fmt = (ms: number) => clock(ms);

function useCatalogue() {
  const [items, setItems] = useState<ReelSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (isMontageConfigured) reels.list().then((r) => setItems(r.reels)).catch((e: Error) => setError(e.message)); }, []);
  const entries: CatalogueEntry[] = useMemo(() => items.map((r) => ({ reelId: r.reelId, title: r.title })), [items]);
  return { items, entries, error };
}

function ReelSelect({ value, onChange, items, label }: { value: string; onChange: (v: string) => void; items: ReelSummary[]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-10 max-w-[16rem] rounded-lg border border-line bg-white px-2 text-sm">
      <option value="">— aucun script —</option>
      {items.map((r) => <option key={r.reelId} value={r.reelId} disabled={Boolean(r.linked) && r.reelId !== value}>{r.reelId} · {r.title}{r.linked ? " (déjà filmé)" : ""}</option>)}
    </select>
  );
}

type Row = { file: File; durationMs: number | null; reelId: string; match: Match; state: string; montageId?: string; error?: string };

function SeparateFiles({ items, entries }: { items: ReelSummary[]; entries: CatalogueEntry[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [transcription, setTranscription] = useState<boolean | null>(null);
  useEffect(() => { if (isMontageConfigured) montage.getSettings().then((r) => setTranscription(r.services.transcription)).catch(() => setTranscription(null)); }, []);
  const add = async (files: FileList | null) => {
    if (!files) return;
    const next: Row[] = [];
    for (const file of Array.from(files)) {
      const match = matchCatalogue({ label: file.name.replace(/\.[^.]+$/, "") }, entries);
      let durationMs: number | null = null, error: string | undefined;
      try { durationMs = await durationOf(file); } catch (e) { error = (e as Error).message; }
      next.push({ file, durationMs, reelId: match.reelId ?? "", match, state: error ? "illisible" : "à envoyer", error });
    }
    setRows((r) => [...r, ...next]);
  };
  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const send = async () => {
    setBusy(true);
    for (const [i, row] of rows.entries()) {
      if (row.montageId || row.durationMs === null) continue;
      try {
        const reel = items.find((r) => r.reelId === row.reelId);
        patch(i, { state: "envoi…", error: undefined });
        const created = await montage.create({ title: reel ? `${reel.reelId} · ${reel.title}` : row.file.name.replace(/\.[^.]+$/, ""), fileName: row.file.name, size: row.file.size, ...(row.reelId ? { reelId: row.reelId } : {}) });
        const res = await fetch(created.uploadUrl, { method: "PUT", headers: { "Content-Type": row.file.type || "video/mp4" }, body: row.file });
        if (!res.ok) throw new Error(`Envoi interrompu (HTTP ${res.status}). Le projet existe : reprends l'envoi depuis son studio.`);
        await montage.uploaded(created.id, { durationMs: row.durationMs, islands: null });
        patch(i, { montageId: created.id, state: "vidéo reçue" });
        if (transcription) {
          patch(i, { state: "transcription…" });
          try { await montage.transcribe(created.id); patch(i, { state: "transcrit" }); }
          catch (e) { patch(i, { state: "vidéo reçue · transcription à relancer", error: (e as Error).message }); }
        }
      } catch (e) { patch(i, { state: "erreur", error: (e as Error).message }); }
    }
    setBusy(false);
  };
  return (
    <section className="card space-y-3 p-4" aria-labelledby="separes">
      <h2 id="separes" className="font-semibold">Fichiers déjà séparés (une prise par réel)</h2>
      <p className="text-sm text-mut">Chaque fichier devient un projet indépendant, associé au script choisi. Limites actuelles du serveur : 500 Mo et 10 min par prise. {transcription === false ? "Transcription non configurée : elle se lancera depuis le studio." : transcription ? "La transcription est lancée après l'envoi ; un échec conserve la vidéo." : ""}</p>
      <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" multiple disabled={busy} onChange={(e) => add(e.target.files)} aria-label="Fichiers vidéo séparés" className="block text-sm" />
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-mut"><tr><th className="py-1">Fichier</th><th>Durée</th><th>Script associé</th><th>Proposition</th><th>État</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={`${r.file.name}-${i}`} className="border-t border-line align-top">
                <td className="py-2 pr-2">{r.file.name}<span className="block text-xs text-mut">{Math.round(r.file.size / 1e6)} Mo</span></td>
                <td className="pr-2">{r.durationMs ? fmt(r.durationMs) : "—"}</td>
                <td className="pr-2"><ReelSelect label={`Script pour ${r.file.name}`} value={r.reelId} items={items} onChange={(v) => patch(i, { reelId: v })} /></td>
                <td className="pr-2 text-xs">{CONF[r.match.confidence]}{r.match.candidates.length > 1 ? ` (${r.match.candidates.join(", ")})` : ""}</td>
                <td className="text-xs">{r.montageId ? <Link className="text-brand underline" href={`/reels/${r.montageId}`}>{r.state}</Link> : r.state}{r.error ? <span role="alert" className="block text-red-700">{r.error}</span> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      <button type="button" className="btn-red min-h-11" disabled={busy || !rows.some((r) => !r.montageId && r.durationMs !== null)} onClick={send}>{busy ? "Envoi en cours…" : "Créer les projets"}</button>
    </section>
  );
}

type PlanRow = Segment & { reelId: string; match: Match };

function LongRush({ items, entries }: { items: ReelSummary[]; entries: CatalogueEntry[] }) {
  const [rush, setRush] = useState<{ file: File; url: string; durationMs: number } | null>(null);
  const [words, setWords] = useState<Word[] | null>(null);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => () => { if (rush) URL.revokeObjectURL(rush.url); }, [rush]);

  const pickRush = async (file?: File) => {
    if (!file) return;
    setError(null);
    try { setRush({ file, url: URL.createObjectURL(file), durationMs: await durationOf(file) }); } catch (e) { setError((e as Error).message); }
  };
  const pickTranscript = async (file?: File) => {
    if (!file) return;
    setError(null);
    try { setWords(parseTranscript(JSON.parse(await file.text()))); } catch (e) { setError(e instanceof SyntaxError ? "Fichier JSON invalide." : (e as Error).message); }
  };
  const propose = () => {
    if (!words || !rush) return;
    const { segments, warnings } = planFromSlates(findSlates(words), words, rush.durationMs, { expected: entries.length || 72 });
    setWarnings(warnings);
    setPlan(segments.map((s) => { const match = matchCatalogue({ n: s.n, label: s.titre }, entries); return { ...s, reelId: match.reelId ?? "", match }; }));
  };
  const patch = (i: number, p: Partial<PlanRow>) => setPlan((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const seek = (ms: number) => { if (player.current) { player.current.currentTime = ms / 1000; void player.current.play().catch(() => {}); } };
  const errors = rush ? checkPlan(plan, rush.durationMs) : [];
  const unassigned = plan.filter((p) => !p.reelId).length;
  const exportPlan = () => rush && download(JSON.stringify({
    rush: { fileName: rush.file.name, size: rush.file.size, durationMs: rush.durationMs },
    segments: plan.map(({ n, fromMs, toMs, titre, reelId, match }) => ({ n, reelId: reelId || null, sourceFromMs: fromMs, sourceToMs: toMs, titre, association: reelId ? (match.reelId === reelId ? match.confidence : "manuelle") : "à faire", file: segmentName({ n, titre }) })),
  }, null, 2), `${rush.file.name.replace(/\.[^.]+$/, "")}-plan.json`, "application/json");
  const exportScript = () => rush && download(["#!/bin/sh", "# Extraits du rush (le fichier original n'est pas modifié). À lancer dans le dossier du rush.", "set -e", ...plan.map((s) => ffmpegCommand(rush.file.name, s))].join("\n") + "\n", "extraits.sh", "text/x-shellscript");

  return (
    <section className="card space-y-3 p-4" aria-labelledby="rush">
      <h2 id="rush" className="font-semibold">Long rush (plusieurs réels dans un fichier)</h2>
      <div role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-medium">Ce qui manque côté serveur pour le traiter de bout en bout en ligne :</p>
        <ul className="mt-1 list-disc pl-5">
          <li>envoi reprenable d&apos;un fichier de plus de 500 Mo et transcription asynchrone d&apos;une session de plus de 10 min ;</li>
          <li>production des extraits (FFmpeg) côté serveur, puis création des projets avec la référence au rush et ses bornes.</li>
        </ul>
        <p className="mt-1">En attendant : le rush reste sur ton poste (rien n&apos;est envoyé ici), tu charges sa transcription horodatée, tu vérifies le plan, puis les extraits produits s&apos;importent ci-dessus avec leur script.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Rush (lu sur ce poste)<input type="file" accept="video/*" onChange={(e) => pickRush(e.target.files?.[0])} className="mt-1 block text-sm" /></label>
        <label className="text-sm">Transcription horodatée (JSON : mots avec début et fin)<input type="file" accept="application/json,.json" onChange={(e) => pickTranscript(e.target.files?.[0])} className="mt-1 block text-sm" /></label>
      </div>
      <p className="text-xs text-mut">{rush ? `Rush : ${rush.file.name} · ${fmt(rush.durationMs)}` : "Aucun rush choisi."} {words ? `· ${words.length} mots transcrits` : ""}</p>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <button type="button" className="btn-ghost min-h-11" disabled={!rush || !words} onClick={propose}>Proposer les segments</button>
      {rush ? <video ref={player} src={rush.url} controls playsInline className="max-h-72 rounded-xl bg-black" aria-label="Lecture du rush original" /> : null}
      {warnings.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">{warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
      {plan.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-mut"><tr><th className="py-1">N°</th><th>Début (rush)</th><th>Fin (rush)</th><th>Titre annoncé</th><th>Script</th><th>Proposition</th><th /></tr></thead>
              <tbody>{plan.map((s, i) => (
                <tr key={`${s.n}-${i}`} className="border-t border-line">
                  <td className="py-2">V{s.n}</td>
                  {(["fromMs", "toMs"] as const).map((k) => (
                    <td key={k}><input aria-label={`${k === "fromMs" ? "Début" : "Fin"} de V${s.n}`} defaultValue={fmt(s[k])} key={s[k]} onBlur={(e) => { const v = parseClock(e.target.value); if (v !== null) patch(i, { [k]: v } as Partial<PlanRow>); else e.target.value = fmt(s[k]); }} className="min-h-10 w-28 rounded-lg border border-line bg-white px-2" /></td>
                  ))}
                  <td className="max-w-[14rem] truncate pr-2" title={s.titre}>{s.titre || "—"}</td>
                  <td><ReelSelect label={`Script pour V${s.n}`} value={s.reelId} items={items} onChange={(v) => patch(i, { reelId: v })} /></td>
                  <td className="text-xs">{CONF[s.match.confidence]}</td>
                  <td className="whitespace-nowrap"><button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => seek(s.fromMs)}>▶ début</button> <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => seek(Math.max(0, s.toMs - 3000))}>▶ fin</button> <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => setPlan((r) => r.filter((_, k) => k !== i))}>Retirer</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {errors.length ? <ul role="alert" className="list-disc pl-5 text-sm text-red-700">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
          <p className="text-sm">{plan.length} segments · {unassigned ? `${unassigned} sans script associé` : "tous associés"}. Les temps sont ceux du rush original.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-red min-h-11" disabled={Boolean(errors.length)} onClick={exportPlan}>Télécharger le plan (JSON)</button>
            <button type="button" className="btn-ghost min-h-11" disabled={Boolean(errors.length)} onClick={exportScript}>Télécharger le script d&apos;extraits (FFmpeg)</button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function Tournage() {
  const { items, entries, error } = useCatalogue();
  return (
    <div className="social-studio -mx-4 space-y-4 px-4 py-2 sm:-mx-8 sm:px-8">
      <header>
        <p className="kicker">Instagram BeeRecos</p>
        <h1 className="font-display text-3xl font-semibold">Découper un tournage</h1>
        <p className="mt-1 text-sm text-mut">Un projet indépendant par réel confirmé. Jamais de découpe en parts égales ; une association incertaine se choisit à la main.</p>
      </header>
      {!isMontageConfigured ? <p role="status" className="card p-4 text-sm">Le serveur de montage n&apos;est pas configuré (NEXT_PUBLIC_BEE_API_URL) : les projets ne peuvent pas être créés.</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">Catalogue des 72 réels illisible : {error}</p> : null}
      {isMontageConfigured && !error && !items.length ? <p className="text-sm text-mut">Catalogue des 72 réels vide sur le serveur : importe-le depuis la <Link href="/library" className="text-brand underline">Bibliothèque</Link> pour associer les prises.</p> : null}
      <SeparateFiles items={items} entries={entries} />
      <LongRush items={items} entries={entries} />
    </div>
  );
}
