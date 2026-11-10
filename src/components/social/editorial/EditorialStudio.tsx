"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Lock, LockOpen, Sparkles, Trash2 } from "lucide-react";
import ReelPreview, { type ReelPreviewHandle } from "@/components/social/ReelPreview";
import { generateEditorialText } from "@/lib/social/editorial-api";
import { directFromScript, directorBrief, parseDirector } from "@/domain/social/editorial/director";
import { planStoryboard, type Plan } from "@/domain/social/editorial/schedule";
import { renderEditorial } from "@/domain/social/editorial/render";
import { qaStoryboard } from "@/domain/social/editorial/qa";
import { beatTicks } from "@/domain/social/editorial/beat";
import { END_VIDEO } from "@/domain/social/montage/brand";
import { SCENE_LABEL, StoryboardSchema, TRANSITIONS, type EditorialScene, type Storyboard } from "@/domain/social/editorial/schema";

/**
 * « GÉNÉRER MON REEL » — preset EDITORIAL IMPACT. Script → AI Motion Director (repli : découpage déterministe) →
 * storyboard en cartes modifiables → aperçu identique au rendu. Rien n'est publié ici.
 */
const BG_LABEL = { dark: "Sombre", light: "Clair", brand: "Bleu BeeRecos" } as const;
const TR_LABEL: Record<(typeof TRANSITIONS)[number], string> = { "wipe-lr": "Balayage →", "wipe-rl": "Balayage ←", cut: "Coupe sèche", none: "Aucune" };
const LAYOUTS: Record<EditorialScene["type"], string[]> = {
  "hook-stat": ["left", "center", "full"], statement: ["left", "center", "stack"], pills: ["left", "center", "alternate"],
  human: ["left", "center", "stack"], testimonials: ["diagonal", "horizontal", "stack"], cta: ["left", "center", "stack"],
};
const LAYOUT_LABEL: Record<string, string> = { left: "Aligné à gauche", center: "Centré", full: "Plein écran", stack: "Empilé", alternate: "En quinconce", diagonal: "En diagonale", horizontal: "En ligne" };
const SFX_LABEL = { off: "Sans son", subtle: "Discret", normal: "Normal", impact: "Impact" } as const;
const field = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";

/** Champ « une ligne par ligne » des textes de chaque scène (le reste garde sa valeur). */
function linesOf(s: EditorialScene): { key: string; label: string; value: string }[] {
  switch (s.type) {
    case "hook-stat": return [{ key: "lead", label: "Avant le chiffre", value: s.lead ?? "" }, { key: "stat", label: "Chiffre (dit dans le script)", value: String(s.stat.value).replace(".", ",") }, { key: "lines", label: "Après le chiffre (une ligne par ligne)", value: s.lines.join("\n") }, { key: "accent", label: "Mot en couleur", value: s.accent ?? "" }];
    case "statement": return [{ key: "lines", label: "Texte (une ligne par ligne)", value: s.lines.join("\n") }, { key: "accentWords", label: "Mots en couleur (séparés par une virgule)", value: s.accentWords.join(", ") }, { key: "micro", label: "Petite phrase", value: s.micro ?? "" }];
    case "pills": return [{ key: "title", label: "Titre", value: s.title }, { key: "pills", label: "Capsules (une par ligne)", value: s.pills.join("\n") }];
    case "human": return [{ key: "question", label: "Question (une ligne par ligne)", value: s.question.join("\n") }, { key: "answer", label: "Réponse", value: s.answer }, { key: "micro", label: "Petite phrase", value: s.micro ?? "" }];
    case "testimonials": return [{ key: "title", label: "Titre", value: s.title }];
    case "cta": return [{ key: "lines", label: "Texte (une ligne par ligne)", value: s.lines.join("\n") }, { key: "sub", label: "Consigne (ex. Commente MOT…)", value: s.sub ?? "" }, { key: "button", label: "Bouton", value: s.button }];
  }
}
function withField(s: EditorialScene, key: string, v: string): EditorialScene {
  const list = v.split("\n").map((x) => x.trim()).filter(Boolean);
  const opt = v.trim() || undefined;
  if (key === "stat" && s.type === "hook-stat") { const n = Number(v.replace(",", ".")); return Number.isFinite(n) ? { ...s, stat: { ...s.stat, value: n, decimals: /[.,]/.test(v) ? 1 : 0 } } : s; }
  if (key === "accentWords") return { ...s, accentWords: v.split(",").map((x) => x.trim()).filter(Boolean) } as EditorialScene;
  if (["lines", "pills", "question"].includes(key)) return { ...s, [key]: list } as EditorialScene;
  if (["lead", "accent", "micro", "sub"].includes(key)) return { ...s, [key]: opt } as EditorialScene;
  return { ...s, [key]: v } as EditorialScene;
}

function Timeline({ plan, at, onSeek }: { plan: Plan; at: number; onSeek: (s: number) => void }) {
  const total = plan.durationMs + END_VIDEO.durationMs;
  const pct = (ms: number) => `${(ms / total) * 100}%`;
  return (
    <div className="mt-4">
      <div className="relative h-14 overflow-hidden rounded-lg border border-line bg-black/[0.03]" role="group" aria-label="Timeline">
        {plan.scenes.map((p) => (
          <button key={p.scene.id} type="button" onClick={() => onSeek(p.startMs / 1000 + 0.05)} title={SCENE_LABEL[p.scene.type]}
            className="absolute top-0 h-8 border-r border-white text-left text-[10px] font-semibold text-white" style={{ left: pct(p.startMs), width: pct(p.endMs - p.startMs), background: p.scene.background === "light" ? "#9a9890" : p.scene.background === "brand" ? "#2851FF" : "#0B0B0B" }}>
            <span className="block truncate px-1 pt-1">{SCENE_LABEL[p.scene.type]}</span>
          </button>
        ))}
        <button type="button" onClick={() => onSeek(plan.durationMs / 1000 + 0.05)} title="Vidéo de fin BeeRecos" className="absolute top-0 h-8 bg-[#9aa7ff] text-left text-[10px] font-semibold text-white" style={{ left: pct(plan.durationMs), width: pct(END_VIDEO.durationMs) }}>
          <span className="block truncate px-1 pt-1">Fin BeeRecos</span>
        </button>
        {beatTicks(0, plan.durationMs, plan.bpm).map((t) => <span key={t} aria-hidden className="absolute bottom-0 h-2 w-px bg-black/25" style={{ left: pct(t) }} />)}
        {plan.audio.map((a, i) => <span key={i} aria-hidden title={a.sfx} className="absolute bottom-2 size-1.5 -translate-x-1/2 rounded-full bg-brand" style={{ left: pct(a.atMs) }} />)}
        <span aria-hidden className="absolute top-0 h-full w-0.5 bg-red-500" style={{ left: pct(at * 1000) }} />
      </div>
      <p className="mt-1 text-xs text-mut">{(total / 1000).toFixed(1)} s (dont {(END_VIDEO.durationMs / 1000).toFixed(1)} s de vidéo de fin) · {plan.scenes.length} scènes · {plan.audio.length} sons · grille {plan.bpm} BPM</p>
    </div>
  );
}

export default function EditorialStudio() {
  const [script, setScript] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sb, setSb] = useState<Storyboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const preview = useRef<ReelPreviewHandle>(null);

  const plan = useMemo(() => (sb ? planStoryboard(sb) : null), [sb]);
  const html = useMemo(() => {
    if (!sb || !plan || typeof window === "undefined") return null;
    try { return renderEditorial(sb, { assetBase: `${window.location.origin}/hyperframes`, preview: true }, plan); } catch { return null; }
  }, [sb, plan]);
  const qa = useMemo(() => (sb && plan ? qaStoryboard(sb, plan) : []), [sb, plan]);

  /** Remplace le storyboard en gardant les scènes verrouillées à leur place. */
  const adopt = (next: Storyboard) => {
    if (!sb) return setSb(next);
    const scenes = next.scenes.map((s, i) => (sb.scenes[i]?.locked ? sb.scenes[i] : s));
    setSb(StoryboardSchema.parse({ ...next, intensity: sb.intensity, sfx: sb.sfx, scenes }));
  };

  const generate = async () => {
    if (script.trim().length < 20) { setError("Colle ton script (quelques phrases au moins)."); return; }
    setBusy(true); setError(null); setNote(null);
    const opts = { intensity: sb?.intensity ?? 4, keyword: keyword.trim() || null };
    try {
      const raw = await generateEditorialText({ channel: "instagram", workspaceId: null, brief: directorBrief(script, opts) });
      const r = parseDirector(raw, script, opts);
      adopt(r.storyboard);
      setNote(r.source === "ai" ? "Storyboard proposé par l'IA : modifie chaque carte librement." : "Réponse de l'IA inutilisable : storyboard construit automatiquement à partir du script.");
    } catch (e) {
      adopt(directFromScript(script, opts));
      setNote(`IA indisponible (${e instanceof Error ? e.message : "erreur"}) : storyboard construit automatiquement à partir du script.`);
    } finally { setBusy(false); }
  };

  const update = (fn: (s: Storyboard) => Storyboard) => setSb((cur) => {
    if (!cur) return cur;
    const r = StoryboardSchema.safeParse(fn(cur));
    if (!r.success) { setError("Modification refusée : " + (r.error.issues[0]?.message ?? "valeur invalide")); return cur; }
    setError(null); return r.data;
  });
  const setScene = (i: number, s: EditorialScene) => update((cur) => ({ ...cur, scenes: cur.scenes.map((x, k) => (k === i ? s : x)) }));
  const move = (i: number, d: -1 | 1) => update((cur) => { const a = [...cur.scenes]; const j = i + d; if (j < 0 || j >= a.length) return cur; [a[i], a[j]] = [a[j], a[i]]; return { ...cur, scenes: a }; });
  const seekScene = (i: number) => { const p = plan?.scenes[i]; if (p) preview.current?.seek(p.startMs / 1000 + 0.05); };

  return (
    <div className="social-studio space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h1 className="font-display text-2xl font-semibold">Reel éditorial</h1>
        <p className="mt-1 text-sm text-mut">Preset « Editorial Impact » : gros titres, chiffres animés, capsules, balayages bleus, sons calés sur le rythme. Colle ton script ; l&apos;IA décide de ce qui devient énorme.</p>
        <label className="mt-4 block text-xs font-medium" htmlFor="ei-script">Script ou transcription</label>
        <textarea id="ei-script" className={`${field} min-h-36`} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Colle ici le texte de ta vidéo." />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium">Mot-clé du CTA (facultatif)
            <input className={field} value={keyword} onChange={(e) => setKeyword(e.target.value.toUpperCase())} placeholder="Ex. RÉSEAU" maxLength={20} />
          </label>
          <label className="block text-xs font-medium">Intensité : {sb?.intensity ?? 4} / 5
            <input type="range" min={1} max={5} step={1} className="mt-3 w-full accent-[#2851FF]" value={sb?.intensity ?? 4} disabled={!sb}
              onChange={(e) => update((cur) => ({ ...cur, intensity: Number(e.target.value) }))} aria-describedby="ei-int" />
            <span id="ei-int" className="mt-1 block font-normal text-mut">1 = posé · 5 = très rythmé</span>
          </label>
          <label className="block text-xs font-medium">Effets sonores
            <select className={field} value={sb?.sfx ?? "normal"} disabled={!sb} onChange={(e) => update((cur) => ({ ...cur, sfx: e.target.value as Storyboard["sfx"] }))}>
              {Object.entries(SFX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <button type="button" className="btn-red mt-4 min-h-12 px-6 text-base" onClick={generate} disabled={busy}>
          <Sparkles aria-hidden size={18} />{busy ? "Génération…" : sb ? "RÉGÉNÉRER (cartes verrouillées gardées)" : "GÉNÉRER MON REEL"}
        </button>
        {note ? <p role="status" className="mt-2 text-sm text-mut">{note}</p> : null}
        {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      </section>

      {sb && plan ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div className="lg:sticky lg:top-4 lg:self-start">
            <div className="mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-2xl bg-black">
              {html ? <ReelPreview ref={preview} html={html} title="Aperçu du Reel éditorial" onTimeUpdate={setAt} preservePosition /> : null}
            </div>
            <Timeline plan={plan} at={at} onSeek={(s) => preview.current?.seek(s)} />
            <div className="mt-4 rounded-xl border border-line p-3" aria-live="polite">
              <p className="text-sm font-semibold">Contrôle qualité</p>
              {qa.length === 0 ? <p className="mt-1 text-sm text-mut">✅ Aucun problème détecté.</p> : (
                <ul className="mt-1 space-y-1 text-sm">{qa.map((q, i) => <li key={i} className={q.level === "error" ? "text-red-700" : "text-ink-2"}>{q.level === "error" ? "⚠️" : "🟡"} {q.sceneId ? `Scène ${sb.scenes.findIndex((s) => s.id === q.sceneId) + 1} : ` : ""}{q.message}</li>)}</ul>
              )}
            </div>
          </div>

          <ol className="space-y-3" aria-label="Storyboard">
            {sb.scenes.map((s, i) => {
              const p = plan.scenes[i];
              return (
                <li key={s.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="text-left" onClick={() => seekScene(i)}>
                      <span className="text-xs text-mut">Scène {i + 1} · {((p.endMs - p.startMs) / 1000).toFixed(1)} s</span>
                      <span className="block font-semibold">{SCENE_LABEL[s.type]}</span>
                    </button>
                    <div className="ml-auto flex gap-1">
                      <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label="Monter" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={16} aria-hidden /></button>
                      <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label="Descendre" onClick={() => move(i, 1)} disabled={i === sb.scenes.length - 1}><ArrowDown size={16} aria-hidden /></button>
                      <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label="Dupliquer" disabled={sb.scenes.length >= 10}
                        onClick={() => update((cur) => ({ ...cur, scenes: [...cur.scenes.slice(0, i + 1), { ...s, id: `${s.id}-${Date.now().toString(36)}`.slice(0, 40), locked: false }, ...cur.scenes.slice(i + 1)] }))}><Copy size={16} aria-hidden /></button>
                      <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label={s.locked ? "Déverrouiller" : "Verrouiller"} aria-pressed={!!s.locked} onClick={() => setScene(i, { ...s, locked: !s.locked })}>{s.locked ? <Lock size={16} aria-hidden /> : <LockOpen size={16} aria-hidden />}</button>
                      <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label="Supprimer" disabled={sb.scenes.length <= 2} onClick={() => update((cur) => ({ ...cur, scenes: cur.scenes.filter((_, k) => k !== i) }))}><Trash2 size={16} aria-hidden /></button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs font-medium">Mise en page
                      <select className={field} value={s.layout} onChange={(e) => setScene(i, { ...s, layout: e.target.value } as EditorialScene)}>
                        {LAYOUTS[s.type].map((l) => <option key={l} value={l}>{LAYOUT_LABEL[l]}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-medium">Fond
                      <select className={field} value={s.background} onChange={(e) => setScene(i, { ...s, background: e.target.value as EditorialScene["background"] })}>
                        {Object.entries(BG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-medium">Transition vers la suite
                      <select className={field} value={s.transitionOut} disabled={i === sb.scenes.length - 1} onChange={(e) => setScene(i, { ...s, transitionOut: e.target.value as EditorialScene["transitionOut"] })}>
                        {TRANSITIONS.map((t) => <option key={t} value={t}>{TR_LABEL[t]}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {linesOf(s).map((f) => (
                      <label key={`${s.id}-${f.key}-${f.value}`} className="block text-xs font-medium">{f.label}
                        {f.value.includes("\n") || ["lines", "pills", "question"].includes(f.key)
                          ? <textarea className={`${field} min-h-20`} defaultValue={f.value} onBlur={(e) => e.target.value !== f.value && setScene(i, withField(s, f.key, e.target.value))} />
                          : <input className={field} defaultValue={f.value} onBlur={(e) => e.target.value !== f.value && setScene(i, withField(s, f.key, e.target.value))} />}
                      </label>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
      {sb ? <p className="text-xs text-mut">Le chiffre d&apos;une accroche doit être dit dans le script ; aucun témoignage ni note n&apos;est ajouté sans source. Rien n&apos;est publié depuis cette page.</p> : null}
    </div>
  );
}
