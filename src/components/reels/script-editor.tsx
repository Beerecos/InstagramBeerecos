"use client";
/**
 * Éditeur de script : blocs du Hook au Call to action, contrôles en direct, proposition IA, prompteur ; puis le même
 * script devient un réel IA (scènes) ou un réel filmé (prompteur + prise). Brouillon gardé sur l'appareil à chaque
 * frappe ; enregistrement serveur (révisions) dès que le script est complet.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Bot, Clapperboard, Plus, Trash2 } from "lucide-react";
import { chatStream, isBackendConfigured } from "@/lib/social/api";
import { StudioAssetError, studioAssets } from "@/lib/social/studio-assets-api";
import { extractJson } from "@/components/social/ReelsStudio";
import { PILLAR_LABEL, type StoryPillar } from "@/domain/social/reel-story/spec";
import type { MotionSpec } from "@/domain/social/reel-story/motion-spec";
import { BLOCKS, BLOCK_LABEL, addBlock, blockSeconds, emptyBlock, isReady, motionToScript, newScript, prompterText, removeBlock, scriptChecks, scriptSeconds, scriptToMotion, TARGET, type BlockRole, type Script } from "@/domain/scripts/script";

const draftKey = (id: string | null) => `ibr.script.draft.${id ?? "nouveau"}`;
const readDraft = (id: string | null): Script | null => { try { const r = localStorage.getItem(draftKey(id)); return r ? (JSON.parse(r) as Script) : null; } catch { return null; } };
const writeDraft = (id: string | null, s: Script) => { try { localStorage.setItem(draftKey(id), JSON.stringify(s)); } catch { /* facultatif */ } };

const AI_PROMPT = (brief: string, keyword: string) => `Tu écris un script de réel Instagram vertical pour BeeRecos (B et R majuscules), réseau d'apporteurs d'affaires, école de formation BeeSchool et digitalisation IA.
Sujet : ${brief}
Structure obligatoire, dans cet ordre : HOOK, LEAD, BODY_1, OPEN_LOOP_1, BODY_2, OPEN_LOOP_2, BODY_3, CTA (tu peux omettre OPEN_LOOP_1, BODY_2, OPEN_LOOP_2, BODY_3 si le sujet est court).
Règles : 35 à 60 secondes au total (environ 2,5 mots par seconde) ; hook de 15 mots au plus ; "voice" = phrase dite, 220 caractères au plus ; "screen" = texte à l'écran de 2 à 7 mots, différent de la phrase dite ; CTA unique qui prononce le mot-clé ${keyword} en majuscules ("Commente ${keyword}…").
Interdits : chiffre, montant, pourcentage, promesse de rémunération, témoignage, date, tarif ou fonctionnalité inventés.
Réponds UNIQUEMENT en JSON : {"title": "...", "blocks": [{"role": "HOOK", "voice": "...", "screen": "..."}]}`;

function Prompteur({ text, onClose }: { text: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40);
  const [size, setSize] = useState(44);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), raf = 0;
    const step = (t: number) => { if (box.current) box.current.scrollTop += ((t - last) / 1000) * speed; last = t; raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Prompteur" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex flex-wrap items-center gap-3 p-3 text-sm">
        <button type="button" className="rounded-lg bg-white px-4 py-2 font-semibold text-black" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Lecture"} (espace)</button>
        <label className="flex items-center gap-2">Vitesse<input type="range" min={10} max={120} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label>
        <label className="flex items-center gap-2">Taille<input type="range" min={28} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
        <button type="button" className="ml-auto rounded-lg border border-white/40 px-4 py-2" onClick={onClose}>Fermer (Échap)</button>
      </div>
      <div ref={box} className="flex-1 overflow-y-auto px-[8vw] pb-[60vh] pt-[30vh]" style={{ fontSize: size, lineHeight: 1.35 }}>
        {text.split("\n\n").map((p, i) => <p key={i} className="mb-[1em] font-semibold">{p}</p>)}
      </div>
    </div>
  );
}

/** Rendu côté navigateur uniquement : le brouillon vient du stockage de l'appareil (aucun écart d'hydratation). */
export default function ScriptEditor(props: { assetId?: string }) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  return mounted ? <Editor {...props} /> : <p role="status" className="text-sm">Chargement de l&apos;éditeur…</p>;
}

function Editor({ assetId }: { assetId?: string }) {
  const router = useRouter();
  const id = assetId ?? null;
  const [script, setScript] = useState<Script>(() => readDraft(id) ?? newScript());
  const [revision, setRevision] = useState<number | undefined>(undefined);
  const [serverId, setServerId] = useState<string | null>(id);
  const [state, setState] = useState<"local" | "serveur" | "modifié">("local");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [previous, setPrevious] = useState<Script | null>(null);
  const [prompteur, setPrompteur] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    studioAssets.get(id).then(({ asset }) => {
      if (!alive) return;
      if (asset.kind !== "motion") { setError("Ce projet n'est pas un script en scènes."); return; }
      setRevision(asset.revision);
      const draft = readDraft(id);
      if (draft) { setScript(draft); setState("modifié"); } else { setScript(motionToScript(asset.data as MotionSpec)); setState("serveur"); }
    }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id]);

  const update = (next: Script) => { setScript(next); writeDraft(id, next); setState("modifié"); };
  const setBlock = (bid: string, patch: Partial<Script["blocks"][number]>) => update({ ...script, blocks: script.blocks.map((b) => (b.id === bid ? { ...b, ...patch } : b)) });
  const checks = useMemo(() => scriptChecks(script), [script]);
  const total = scriptSeconds(script);
  const ready = isReady(script);
  const missing = BLOCKS.filter((b) => b.optional && !script.blocks.some((x) => x.role === b.role));

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(null); }
  };
  const save = () => run("save", async () => {
    try {
      const { asset } = await studioAssets.save({ ...(serverId ? { assetId: serverId, expectedRevision: revision } : {}), kind: "motion", title: script.title.trim(), data: scriptToMotion(script) });
      setRevision(asset.revision); setState("serveur");
      try { localStorage.removeItem(draftKey(id)); } catch { /* facultatif */ }
      if (!serverId) { setServerId(asset.id); router.replace(`/scripts/${asset.id}`); }
    } catch (e) {
      if (e instanceof StudioAssetError && e.status === 409) throw new Error("Ce script a été modifié ailleurs : recharge la page (ton brouillon reste sur cet appareil).");
      throw e;
    }
  });
  const propose = () => run("ai", async () => {
    if (!brief.trim()) throw new Error("Décris le sujet en une phrase.");
    const text = await chatStream("content", [{ role: "user", content: AI_PROMPT(brief.trim(), script.keyword || "CLUB") }], "Contenu", () => {});
    const data = extractJson(text) as { title?: string; blocks?: { role?: string; voice?: string; screen?: string }[] } | null;
    const order = BLOCKS.map((b) => b.role);
    const blocks = (data?.blocks ?? []).filter((b) => order.includes(b.role as BlockRole)).map((b) => ({ ...emptyBlock(b.role as BlockRole), voice: String(b.voice ?? ""), screen: String(b.screen ?? "") }));
    if (!blocks.length) throw new Error("La proposition de l'IA est illisible : relance ou écris le script.");
    setPrevious(script);
    update({ ...script, title: script.title || String(data?.title ?? "").slice(0, 80), blocks: blocks.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role)) });
  });

  return (
    <div className="social-studio -mx-4 space-y-4 px-4 py-2 sm:-mx-8 sm:px-8">
      <nav aria-label="Fil d'Ariane" className="text-sm text-mut"><Link href="/scripts" className="underline">Scripts</Link> › {script.title || "Nouveau script"}</nav>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">Éditeur de script</p>
          <h1 className="font-display text-3xl font-semibold">{script.title || "Nouveau script"}</h1>
          <p className="mt-1 text-sm text-mut">Du hook au call to action. Durée estimée <strong>{total} s</strong> (cible {TARGET.min}–{TARGET.max} s, carte de fin comprise) · <span role="status">{state === "serveur" ? `enregistré sur le serveur (révision ${revision})` : "brouillon sur cet appareil, non enregistré"}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost min-h-11" disabled={!prompterText(script)} onClick={() => setPrompteur(true)}>Prompteur</button>
          <button type="button" className="btn-red min-h-11" disabled={!ready || Boolean(busy) || state === "serveur"} onClick={save}>{busy === "save" ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </header>

      <section className="card grid gap-3 p-4 sm:grid-cols-2" aria-label="Informations du script">
        <label className="text-sm">Titre<input value={script.title} maxLength={80} onChange={(e) => update({ ...script, title: e.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3" /></label>
        <label className="text-sm">Pilier<select value={script.pillar} onChange={(e) => update({ ...script, pillar: e.target.value as StoryPillar })} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3">{(Object.keys(PILLAR_LABEL) as StoryPillar[]).map((p) => <option key={p} value={p}>{PILLAR_LABEL[p]}</option>)}</select></label>
        <label className="text-sm">Objectif<input value={script.objective} maxLength={160} onChange={(e) => update({ ...script, objective: e.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3" /></label>
        <label className="text-sm">Mot-clé du CTA<input value={script.keyword} onChange={(e) => update({ ...script, keyword: e.target.value.toUpperCase().replace(/\s/g, "") })} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3" /></label>
      </section>

      {isBackendConfigured ? (
        <details className="card p-4"><summary className="cursor-pointer font-semibold"><Bot aria-hidden size={16} className="mr-1 inline" />Proposer le script avec l&apos;IA</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Le sujet en une phrase (ex. pourquoi une recommandation se prépare)" className="min-h-11 flex-1 rounded-lg border border-line bg-white px-3 text-sm" aria-label="Sujet du script" />
            <button type="button" className="btn-ghost min-h-11" disabled={Boolean(busy)} onClick={propose}>{busy === "ai" ? "Proposition…" : "Proposer"}</button>
            {previous ? <button type="button" className="btn-ghost min-h-11" onClick={() => { update(previous); setPrevious(null); }}>Annuler la proposition</button> : null}
          </div>
          <p className="mt-2 text-xs text-mut">La proposition remplace les blocs ; relis chaque phrase, rien n&apos;est validé automatiquement.</p>
        </details>
      ) : null}

      <ol className="space-y-3" aria-label="Blocs du script">
        {script.blocks.map((b, i) => {
          const meta = BLOCKS.find((x) => x.role === b.role)!;
          const issues = checks.filter((c) => c.block === b.id);
          return (
            <li key={b.id} className={`card p-4 ${b.role === "HOOK" || b.role === "CTA" ? "border-brand/50" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold"><span className="mr-2 text-brand">{i + 1}.</span>{meta.label}</h2>
                <span className="text-xs text-mut">≈ {blockSeconds(b)} s{meta.optional ? <button type="button" aria-label={`Retirer ${meta.label}`} className="ml-3 text-mut hover:text-red-700" onClick={() => update(removeBlock(script, b.id))}><Trash2 aria-hidden size={14} className="inline" /></button> : null}</span>
              </div>
              <p className="mt-1 text-xs text-mut">{meta.hint}</p>
              <label className="mt-2 block text-sm">Texte à dire<textarea rows={2} value={b.voice} onChange={(e) => setBlock(b.id, { voice: e.target.value })} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2" /></label>
              <label className="mt-2 block text-sm">{b.role === "CTA" ? "Texte à l'écran (facultatif, « Commente » par défaut)" : "Texte à l'écran (2 à 7 mots)"}<input value={b.screen} onChange={(e) => setBlock(b.id, { screen: e.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3" /></label>
              {issues.length ? <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">{issues.map((c) => <li key={c.text}>{c.text}</li>)}</ul> : null}
            </li>
          );
        })}
      </ol>
      {missing.length ? <div className="flex flex-wrap gap-2 text-sm">{missing.map((m) => <button key={m.role} type="button" className="btn-ghost min-h-10" onClick={() => update(addBlock(script, m.role))}><Plus aria-hidden size={14} /> {BLOCK_LABEL[m.role]}</button>)}</div> : null}

      {checks.filter((c) => !c.block).length ? <ul className="card list-disc space-y-1 p-4 pl-8 text-sm">{checks.filter((c) => !c.block).map((c) => <li key={c.text} className={c.level === "erreur" ? "text-red-700" : "text-amber-800"}>{c.text}</li>)}</ul> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

      <section className="card space-y-2 p-4" aria-labelledby="transformer">
        <h2 id="transformer" className="font-semibold">Transformer ce script</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-red min-h-11" disabled={state !== "serveur" || !serverId || !revision} onClick={() => router.push(`/reels/nouveau/ia?studioAsset=${serverId}&studioRevision=${revision}&studioKind=motion`)}><Bot aria-hidden size={16} /> Faire en réel IA</button>
          <button type="button" className="btn-ghost min-h-11" disabled={!prompterText(script)} onClick={() => setPrompteur(true)}><Clapperboard aria-hidden size={16} /> Filmer ce script (prompteur)</button>
          <Link href="/reels/nouveau/video" className="btn-ghost min-h-11">Importer la prise filmée</Link>
        </div>
        <p className="text-xs text-mut">{state !== "serveur" ? "Enregistre le script complet pour en faire un réel IA. " : ""}Le réel IA reprend les blocs comme scènes (voix, texte à l&apos;écran), avec la signature BeeRecos en fin.</p>
      </section>
      {prompteur ? <Prompteur text={prompterText(script)} onClose={() => setPrompteur(false)} /> : null}
    </div>
  );
}
