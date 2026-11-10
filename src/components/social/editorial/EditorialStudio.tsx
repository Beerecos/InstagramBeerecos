"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Lock, LockOpen, Pencil, Sparkles, Trash2 } from "lucide-react";
import ReelPreview, { type ReelPreviewHandle } from "@/components/social/ReelPreview";
import { generateEditorialText } from "@/lib/social/editorial-api";
import { directFromScript, directorBrief, inventedNumbers, parseDirector } from "@/domain/social/editorial/director";
import { planStoryboard, type Plan } from "@/domain/social/editorial/schedule";
import { renderEditorial } from "@/domain/social/editorial/render";
import { qaStoryboard } from "@/domain/social/editorial/qa";
import { beatTicks } from "@/domain/social/editorial/beat";
import { END_VIDEO } from "@/domain/social/montage/brand";
import { SCENE_LABEL, StoryboardSchema, TRANSITIONS, type EditorialScene, type Storyboard } from "@/domain/social/editorial/schema";

/**
 * Réel IA ultra simple (demande de Cédric, 2026-11-10) — preset EDITORIAL IMPACT, mascotte en option :
 * 1. mon idée (+ case mascotte) → 2. l'IA propose la structure Hook → CTA (texte à l'écran + phrase d'Audrey),
 * je modifie ou je valide → 3. aperçu (même écran de fin que les Reels) → je modifie ou je valide. Rien n'est publié ici.
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
/** Rôle de la scène dans la structure Hook → CTA (affiché sur la carte). */
const role = (s: EditorialScene, i: number, n: number) => (i === 0 ? "Accroche" : i === n - 1 || s.type === "cta" ? "Appel à l'action" : s.type === "human" ? "Rupture" : "Valeur");
/** Texte à l'écran, résumé en une ligne. */
function screenText(s: EditorialScene): string {
  switch (s.type) {
    case "hook-stat": return [s.lead, String(s.stat.value).replace(".", ",") + (s.stat.suffix ?? ""), ...s.lines, s.accent].filter(Boolean).join(" ");
    case "statement": return s.lines.join(" ");
    case "pills": return `${s.title} ${s.pills.join(" · ")}`;
    case "human": return `${s.question.join(" ")} ${s.answer}`;
    case "testimonials": return s.title;
    case "cta": return `${s.lines.join(" ")} · ${s.button}`;
  }
}
function withField(s: EditorialScene, key: string, v: string): EditorialScene {
  const list = v.split("\n").map((x) => x.trim()).filter(Boolean);
  const opt = v.trim() || undefined;
  if (key === "stat" && s.type === "hook-stat") { const n = Number(v.replace(",", ".")); return Number.isFinite(n) ? { ...s, stat: { ...s.stat, value: n, decimals: /[.,]/.test(v) ? 1 : 0 } } : s; }
  if (key === "accentWords") return { ...s, accentWords: v.split(",").map((x) => x.trim()).filter(Boolean) } as EditorialScene;
  if (["lines", "pills", "question"].includes(key)) return { ...s, [key]: list } as EditorialScene;
  if (["lead", "accent", "micro", "sub", "voice"].includes(key)) return { ...s, [key]: opt } as EditorialScene;
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

type Step = "idea" | "structure" | "preview";

export default function EditorialStudio() {
  const [idea, setIdea] = useState("");
  const [mascot, setMascot] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [sb, setSb] = useState<Storyboard | null>(null);
  const [step, setStep] = useState<Step>("idea");
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const preview = useRef<ReelPreviewHandle>(null);

  const plan = useMemo(() => (sb ? planStoryboard(sb) : null), [sb]);
  const html = useMemo(() => {
    if (!sb || !plan || step !== "preview" || typeof window === "undefined") return null;
    try { return renderEditorial(sb, { assetBase: `${window.location.origin}/hyperframes`, preview: true }, plan); } catch { return null; }
  }, [sb, plan, step]);
  const qa = useMemo(() => (sb && plan ? qaStoryboard(sb, plan) : []), [sb, plan]);
  const invented = useMemo(() => (sb ? inventedNumbers(sb, idea) : []), [sb, idea]);

  /** Remplace la structure en gardant les scènes gardées (verrouillées) à leur place. */
  const adopt = (next: Storyboard) => {
    if (!sb) return setSb(next);
    const scenes = next.scenes.map((s, i) => (sb.scenes[i]?.locked ? sb.scenes[i] : s));
    setSb(StoryboardSchema.parse({ ...next, intensity: sb.intensity, sfx: sb.sfx, mascot, scenes }));
  };

  const structure = async () => {
    if (idea.trim().length < 10) { setError("Écris ton idée en une ou deux phrases."); return; }
    setBusy(true); setError(null); setNote(null); setEditing(null);
    const opts = { intensity: sb?.intensity ?? 4, keyword: keyword.trim() || null, mascot, idea: true };
    try {
      const raw = await generateEditorialText({ channel: "instagram", workspaceId: null, brief: directorBrief(idea, opts) });
      const r = parseDirector(raw, idea, opts);
      adopt(r.storyboard);
      setNote(r.source === "ai" ? "Structure proposée par l'IA : modifie une carte ou valide." : "Réponse de l'IA inutilisable : structure construite à partir de ton texte. Modifie-la ou relance.");
    } catch (e) {
      adopt(directFromScript(idea, opts));
      setNote(`IA indisponible (${e instanceof Error ? e.message : "erreur"}) : structure construite à partir de ton texte.`);
    } finally { setBusy(false); setStep("structure"); }
  };

  const update = (fn: (s: Storyboard) => Storyboard) => setSb((cur) => {
    if (!cur) return cur;
    const r = StoryboardSchema.safeParse(fn(cur));
    if (!r.success) { setError("Modification refusée : " + (r.error.issues[0]?.message ?? "valeur invalide")); return cur; }
    setError(null); return r.data;
  });
  const setScene = (i: number, s: EditorialScene) => update((cur) => ({ ...cur, scenes: cur.scenes.map((x, k) => (k === i ? s : x)) }));
  const move = (i: number, d: -1 | 1) => update((cur) => { const a = [...cur.scenes]; const j = i + d; if (j < 0 || j >= a.length) return cur; [a[i], a[j]] = [a[j], a[i]]; return { ...cur, scenes: a }; });
  const toggleMascot = (v: boolean) => { setMascot(v); if (sb) update((cur) => ({ ...cur, mascot: v })); };
  const blocking = qa.some((q) => q.level === "error") || invented.length > 0;


  return (
    <div className="social-studio space-y-6">
      <section className="space-y-3 rounded-2xl border border-line bg-white p-5" aria-labelledby="ia-titre">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 id="ia-titre" className="font-display text-2xl font-semibold">Réel IA</h1>
          <Steps step={step} />
        </div>
        <label className="block text-xs font-medium" htmlFor="ei-idea">Mon idée</label>
        <textarea id="ei-idea" className={`${field} min-h-24`} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Ex. : pourquoi venir visiter un club BeeRecos avant d'adhérer" />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-5 accent-[#2851FF]" checked={mascot} onChange={(e) => toggleMascot(e.target.checked)} /> Mascotte BeeRecos
          </label>
          <details className="text-sm">
            <summary className="cursor-pointer text-mut">Options</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-medium">Mot-clé du CTA
                <input className={field} value={keyword} onChange={(e) => setKeyword(e.target.value.toUpperCase())} placeholder="Ex. RÉSEAU" maxLength={20} />
              </label>
              <label className="block text-xs font-medium">Intensité : {sb?.intensity ?? 4} / 5
                <input type="range" min={1} max={5} step={1} className="mt-3 w-full accent-[#2851FF]" value={sb?.intensity ?? 4} disabled={!sb}
                  onChange={(e) => update((cur) => ({ ...cur, intensity: Number(e.target.value) }))} />
              </label>
              <label className="block text-xs font-medium">Effets sonores
                <select className={field} value={sb?.sfx ?? "normal"} disabled={!sb} onChange={(e) => update((cur) => ({ ...cur, sfx: e.target.value as Storyboard["sfx"] }))}>
                  {Object.entries(SFX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
          </details>
        </div>
        <button type="button" className="btn-red min-h-12 px-6 text-base" onClick={structure} disabled={busy}>
          <Sparkles aria-hidden size={18} />{busy ? "L'IA structure ta vidéo…" : sb ? "Proposer une autre structure" : "Structurer ma vidéo (Hook → CTA)"}
        </button>
        {sb && sb.scenes.some((s) => s.locked) ? <p className="text-xs text-mut">Les cartes gardées ne changent pas.</p> : null}
        {note ? <p role="status" className="text-sm text-mut">{note}</p> : null}
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      </section>

      {sb && plan && step === "structure" ? (
        <section aria-labelledby="structure-titre" className="space-y-3">
          <h2 id="structure-titre" className="font-display text-xl font-semibold">Ma structure</h2>
          <ol className="space-y-3" aria-label="Storyboard">
            {sb.scenes.map((s, i) => {
              const p = plan.scenes[i];
              const nums = invented.find((x) => x.sceneId === s.id);
              return (
                <li key={s.id} className={`rounded-2xl border bg-white p-4 ${s.locked ? "border-brand" : "border-line"}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{role(s, i, sb.scenes.length)}</span>
                    <span className="text-xs text-mut">{SCENE_LABEL[s.type]} · {((p.endMs - p.startMs) / 1000).toFixed(1)} s</span>
                    <div className="ml-auto flex gap-1">
                      <button type="button" className="btn-ghost min-h-[36px] px-3 text-xs" aria-pressed={!!s.locked} onClick={() => setScene(i, { ...s, locked: !s.locked })}>{s.locked ? <><Lock size={14} aria-hidden /> Gardée</> : <><LockOpen size={14} aria-hidden /> Garder</>}</button>
                      <button type="button" className="btn-ghost min-h-[36px] px-3 text-xs" aria-expanded={editing === i} onClick={() => setEditing(editing === i ? null : i)}><Pencil size={14} aria-hidden /> Modifier</button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{screenText(s)}</p>
                  <p className="mt-1 text-sm text-ink-2"><span className="text-mut">Audrey dit :</span> {s.voice ?? <em className="text-mut">aucune phrase</em>}</p>
                  {nums ? <p role="alert" className="mt-1 text-sm text-red-700">⚠️ Chiffre absent de ton idée : {nums.numbers.join(", ")}. Corrige la phrase ou ajoute la source dans ton idée.</p> : null}
                  {editing === i ? <SceneEditor s={s} i={i} n={sb.scenes.length} onChange={(x) => setScene(i, x)} onMove={(d) => move(i, d)}
                    onDuplicate={() => update((cur) => ({ ...cur, scenes: [...cur.scenes.slice(0, i + 1), { ...s, id: `${s.id}-${Date.now().toString(36)}`.slice(0, 40), locked: false }, ...cur.scenes.slice(i + 1)] }))}
                    onDelete={() => { setEditing(null); update((cur) => ({ ...cur, scenes: cur.scenes.filter((_, k) => k !== i) })); }} /> : null}
                </li>
              );
            })}
          </ol>
          <QaList qa={qa} sb={sb} />
          <button type="button" className="btn-red min-h-12 px-6 text-base" disabled={blocking} onClick={() => { setEditing(null); setStep("preview"); }}>
            <Check aria-hidden size={18} /> Valider la structure
          </button>
          {blocking ? <p className="text-xs text-red-700">Corrige les points signalés pour valider.</p> : null}
        </section>
      ) : null}

      {sb && plan && step === "preview" ? (
        <section aria-labelledby="apercu-titre" className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div>
            <h2 id="apercu-titre" className="sr-only">Aperçu</h2>
            <div className="mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-2xl bg-black">
              {html ? <ReelPreview ref={preview} html={html} title="Aperçu du Réel IA" onTimeUpdate={setAt} preservePosition /> : null}
            </div>
            <Timeline plan={plan} at={at} onSeek={(sec) => preview.current?.seek(sec)} />
          </div>
          <div className="space-y-3">
            <p className="text-sm">Aperçu muet : durées estimées sur la voix d&apos;Audrey. La vidéo se termine par le même écran de fin que les Reels.</p>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">🟡 Compilation avec la voix d&apos;Audrey : prochaine mise à jour. Tu peux déjà relire et ajuster la structure.</div>
            <QaList qa={qa} sb={sb} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost min-h-11" onClick={() => setStep("structure")}><Pencil size={16} aria-hidden /> Modifier la structure</button>
            </div>
            <p className="text-xs text-mut">Aucun chiffre ni témoignage ajouté sans source. Rien n&apos;est publié depuis cette page.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  return (
    <ol className="flex flex-wrap gap-2 text-xs font-medium" aria-label="Étapes">
      {(["idea", "structure", "preview"] as const).map((k, i) => (
        <li key={k} aria-current={step === k ? "step" : undefined} className={`rounded-full px-3 py-1 ${step === k ? "bg-brand text-white" : "bg-black/[0.05] text-mut"}`}>{i + 1}. {k === "idea" ? "Mon idée" : k === "structure" ? "Ma structure" : "Aperçu"}</li>
      ))}
    </ol>
  );
}

function QaList({ qa, sb }: { qa: ReturnType<typeof qaStoryboard>; sb: Storyboard }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3" aria-live="polite">
      <p className="text-sm font-semibold">Contrôle qualité</p>
      {qa.length === 0 ? <p className="mt-1 text-sm text-mut">✅ Aucun problème détecté.</p> : (
        <ul className="mt-1 space-y-1 text-sm">{qa.map((q, i) => <li key={i} className={q.level === "error" ? "text-red-700" : "text-ink-2"}>{q.level === "error" ? "⚠️" : "🟡"} {q.sceneId ? `Scène ${sb.scenes.findIndex((s) => s.id === q.sceneId) + 1} : ` : ""}{q.message}</li>)}</ul>
      )}
    </div>
  );
}

/** Modification détaillée d'une carte (mise en page, fond, transition, textes, voix, ordre). */
function SceneEditor({ s, i, n, onChange, onMove, onDuplicate, onDelete }: { s: EditorialScene; i: number; n: number; onChange: (s: EditorialScene) => void; onMove: (d: -1 | 1) => void; onDuplicate: () => void; onDelete: () => void }) {
  const fields = [{ key: "voice", label: "Audrey dit (voix off)", value: s.voice ?? "" }, ...linesOf(s)];
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium">Mise en page
          <select className={field} value={s.layout} onChange={(e) => onChange({ ...s, layout: e.target.value } as EditorialScene)}>
            {LAYOUTS[s.type].map((l) => <option key={l} value={l}>{LAYOUT_LABEL[l]}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium">Fond
          <select className={field} value={s.background} onChange={(e) => onChange({ ...s, background: e.target.value as EditorialScene["background"] })}>
            {Object.entries(BG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium">Transition vers la suite
          <select className={field} value={s.transitionOut} disabled={i === n - 1} onChange={(e) => onChange({ ...s, transitionOut: e.target.value as EditorialScene["transitionOut"] })}>
            {TRANSITIONS.map((t) => <option key={t} value={t}>{TR_LABEL[t]}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={`${s.id}-${f.key}-${f.value}`} className={`block text-xs font-medium ${f.key === "voice" ? "sm:col-span-2" : ""}`}>{f.label}
            {f.key === "voice" || f.value.includes("\n") || ["lines", "pills", "question"].includes(f.key)
              ? <textarea className={`${field} min-h-20`} defaultValue={f.value} onBlur={(e) => e.target.value !== f.value && onChange(withField(s, f.key, e.target.value))} />
              : <input className={field} defaultValue={f.value} onBlur={(e) => e.target.value !== f.value && onChange(withField(s, f.key, e.target.value))} />}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label="Monter" onClick={() => onMove(-1)} disabled={i === 0}><ArrowUp size={16} aria-hidden /></button>
        <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label="Descendre" onClick={() => onMove(1)} disabled={i === n - 1}><ArrowDown size={16} aria-hidden /></button>
        <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label="Dupliquer" onClick={onDuplicate} disabled={n >= 10}><Copy size={16} aria-hidden /></button>
        <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label="Supprimer" onClick={onDelete} disabled={n <= 2}><Trash2 size={16} aria-hidden /></button>
      </div>
    </div>
  );
}
