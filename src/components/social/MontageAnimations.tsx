"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { montage, type MontageDetail } from "@/lib/social/montage-api";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { behindErrors, hasMattes, isBehind, matteAt } from "@/domain/social/montage/matte";
import { checkTimeline, fieldsOf, keptWords, MANUAL_ONLY, type CustomAnimation, type Rejected, type Suggestion } from "@/domain/social/montage/suggest";
import { animationOutputRange, retimeAnimation } from "@/domain/social/montage/placement";
import { layout, toOutputMs } from "@/domain/social/montage/edit";
import { renderAnimation } from "@/domain/social/montage/animations";
import StudioScenes from "@/components/social/studio/StudioScenes";
import { charteIssues } from "@/domain/social/montage/charte";
import { sceneCardCandidate, type Candidate, type Scene } from "@/domain/social/montage/scenes";
import { listMotions, type KeptMotion } from "@/domain/social/montage/beemotion";
import { prefersReducedMotion } from "@/components/social/ReelPreview";

/**
 * RÉSEAUX SOCIAUX → MONTAGE → Animations (lot 2) : catalogue BeeRecos, ajout en cliquant le mot de départ dans le
 * transcript, propositions de Bee (filtrées côté serveur : rien d'inventé) à accepter une par une. Le brouillon
 * s'affiche tout de suite dans l'aperçu ; rien n'est enregistré sans « Enregistrer les animations ».
 */

const sec = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
/** Les animations qui désignent un média (image) se posent depuis le panneau Médias. */
const NAMES = Object.keys(ANIMATIONS).filter((n) => !MANUAL_ONLY.has(n));
/** Libellés des réglages (une animation maison garde le nom de son réglage). */
const FIELD_LABELS: Record<string, string> = {
  texte: "Texte", detail: "Ligne secondaire", mot: "Mot-clé à commenter", valeur: "Nombre (dit dans la vidéo)", decimales: "Décimales",
  avant: "Avant le nombre (ex. +)", apres: "Après le nombre (ex. %)", legende: "Légende", titre: "Titre", items: "Points", remplacement: "Bonne réponse",
  position: "Position", couleur: "Couleur", entree: "Entrée",
};
/** Libellés des choix (valeurs techniques inchangées). */
const CHOICE_LABELS: Record<string, string> = {
  haut: "Derrière la tête", milieu: "Derrière les épaules", blanc: "Blanc", bleu: "Bleu BeeRecos", noir: "Noir",
  flou: "Fondu flou", rebond: "Agrandissement avec rebond", verticale: "Entrée verticale", laterale: "Entrée latérale",
};

/** Valeurs du formulaire (texte brut) → réglages typés de l'animation. */
function toProps(name: string, values: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fieldsOf(ANIMATIONS[name])) {
    const v = (values[f.key] ?? "").trim();
    if (!v && f.optional) continue;
    out[f.key] = f.kind === "number" ? (v ? Number(v.replace(",", ".")) : "") : f.kind === "list" ? v.split("\n").map((x) => x.trim()).filter(Boolean) : v;
  }
  return out;
}
function fromExample(name: string): Record<string, string> {
  const ex = (ANIMATIONS[name].example ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(ex).map(([k, v]) => [k, Array.isArray(v) ? v.join("\n") : String(v)]));
}
const summary = (c: CustomAnimation) => Object.values(c.props).map((v) => (Array.isArray(v) ? v.join(" · ") : String(v))).join(" — ");

export type MontageAnimationsHandle = { place: (name: string, scene: Scene, fromIndex?: number) => void };
type Props = {
  activeScene?: Scene;
  onAppendOutro?: () => void;
  onPlaced?: (animation: CustomAnimation) => void;
  studioMode?: boolean;
  m: MontageDetail;
  draft: CustomAnimation[];
  onDraft: (c: CustomAnimation[]) => void;
  onSave: (c: CustomAnimation[]) => Promise<void>;
  choices: string[] | undefined;
  onChoices: (choices: string[] | undefined) => void;
  onBusy: (busy: boolean) => void;
  playheadMs: number | null;
  onTest: (sourceMs: number) => void;
  disabled: boolean;
};

const MontageAnimations = forwardRef<MontageAnimationsHandle, Props>(function MontageAnimations({ m, draft, onDraft, onSave, choices, onChoices, onBusy, playheadMs, onTest, disabled, activeScene, studioMode = false, onPlaced, onAppendOutro }, ref) {
  const [advanced, setAdvanced] = useState(false);
  const words = useMemo(() => (m.edit ? keptWords(m.captions, m.edit.ranges) : []), [m.captions, m.edit]);
  const [name, setName] = useState(NAMES[0]);
  const [values, setValues] = useState<Record<string, string>>(() => fromExample(NAMES[0]));
  const [anchor, setAnchor] = useState<number | null>(null);
  const [lengthMs, setLengthMs] = useState(ANIMATIONS[NAMES[0]].lengthMs);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saved = JSON.stringify(m.edit?.custom ?? []) === JSON.stringify(draft) && JSON.stringify(m.edit?.animationChoices) === JSON.stringify(choices);
  const canBehind = Boolean(m.edit && hasMattes(m.edit));
  const availableChoices = (choices ?? []).filter((n) => NAMES.includes(n) && (canBehind || !isBehind(n, ANIMATIONS)));
  const choose = (next: string[] | undefined) => { onChoices(next); setSuggestions([]); setRejected([]); };
  const timeline = checkTimeline(draft);

  // BeeMotion : « ON GARDE » et usage réel (indisponibles tant que la fonction montage n'est pas à jour : rien ne casse).
  const [kept, setKept] = useState<KeptMotion[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    montage.motionLibrary().then((r) => { if (alive) { setKept(r.kept); setUsage(r.usage); } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const approved = new Set(listMotions(undefined, kept).filter((x) => x.status === "approved").map((x) => x.id));
  const toForm = () => { setAdvanced(true); requestAnimationFrame(() => document.getElementById("montage-anim-form")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" })); };

  /** Choisit une animation ; un préréglage (scène BeeMotion, remplacement) peut fixer réglages, début et durée. */
  const pick = (n: string, preset?: { values?: Record<string, string>; anchorMs?: number; lengthMs?: number }) => {
    setName(n); setValues(preset?.values ?? fromExample(n)); setLengthMs(preset?.lengthMs ?? ANIMATIONS[n].lengthMs);
    if (preset?.anchorMs !== undefined) setAnchor(preset.anchorMs);
  };
  const candidate: CustomAnimation | null = anchor === null ? null : { name, fromMs: anchor, toMs: anchor + lengthMs, props: toProps(name, values) };
  const timingError = candidate && (!Number.isFinite(lengthMs) || lengthMs < 500 || lengthMs > 15_000
    ? "Choisissez une durée entre 0,5 et 15 secondes."
    : !m.edit?.ranges.some((r) => candidate.fromMs >= r.fromMs && candidate.fromMs < r.toMs)
      ? "Choisissez un début dans une portion conservée de la vidéo."
      : null);
  const candidateError = candidate
    ? timingError ?? renderAnimation(candidate.name, candidate.props, { id: "zz9", start: 0, duration: lengthMs / 1000, accent: "#2851FF" }, ANIMATIONS).error
      ?? (m.edit && isBehind(candidate.name, ANIMATIONS) && !matteAt(m.edit, candidate.fromMs) ? "Envoyez d'abord le détourage de cette prise (carte Détourage) : sans lui, le titre ne peut pas passer derrière le sujet." : null)
    : null;
  const sorted = (list: CustomAnimation[]) => [...list].sort((a, b) => a.fromMs - b.fromMs);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); onBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(null); onBusy(false); }
  };

  const editAnimation = (index: number) => {
    const c = draft[index];
    if (!c) return;
    onDraft(draft.filter((_, i) => i !== index));
    pick(c.name, { anchorMs: c.fromMs, lengthMs: c.toMs - c.fromMs, values: Object.fromEntries(Object.entries(c.props).map(([key, value]) => [key, Array.isArray(value) ? value.join("\n") : String(value)])) });
    toForm();
  };

  /** A dropped card uses the real transcript, never catalogue sample copy. Missing fields stay editable. */
  const placeOnScene = (c: Candidate, scene: Scene, fromIndex?: number) => {
    if (!m.edit || disabled || busy) return;
    if (c.motion.id === "logo-fin" && onAppendOutro) { onAppendOutro(); return; }
    const previous = fromIndex === undefined ? null : draft[fromIndex];
    if (previous && previous.name !== c.motion.id) return;
    const fromMs = c.anchorMs;
    const segments = layout(m.edit.ranges);
    const start = toOutputMs(segments, fromMs);
    const span = previous ? animationOutputRange(previous, m.edit.ranges) : null;
    const duration = span ? span.toMs-span.fromMs : c.motion.durationMs;
    const end = Math.min(toOutputMs(segments, scene.endMs), start+duration);
    if (end-start < 500) { setError("Séquence trop courte pour cette animation."); return; }
    const timing = retimeAnimation(previous ?? {name:c.motion.id,fromMs,toMs:fromMs+duration,props:{}},m.edit.ranges,start,end);
    const toMs = timing.toMs;
    const props = previous?.props ?? toProps(c.motion.id, c.values);
    const next = { ...previous, id: previous?.id ?? crypto.randomUUID(), name: c.motion.id, fromMs, toMs, props };
    const others = draft.filter((_, i) => i !== fromIndex);
    pick(c.motion.id, { values: previous ? Object.fromEntries(Object.entries(props).map(([k, v]) => [k, Array.isArray(v) ? v.join("\n") : String(v)])) : c.values, anchorMs: fromMs, lengthMs: toMs - fromMs });
    choose([...new Set([...(choices ?? []), c.motion.id])]);
    const rendered = renderAnimation(next.name, next.props, { id: "zz9", start: 0, duration: (toMs - fromMs) / 1000, accent: "#2851FF" }, ANIMATIONS);
    const issues = [rendered.error, ...checkTimeline([...others, next]), ...behindErrors({ ...m.edit, custom: [next] }, ANIMATIONS), ...Object.values(props).flatMap((v) => (Array.isArray(v) ? v : [v]).flatMap((text) => typeof text === "string" ? charteIssues(text) : []))].filter(Boolean);
    if (studioMode && !advanced && fromIndex === undefined && rendered.error && toMs - fromMs >= 500 && !checkTimeline([...others, next]).length && !behindErrors({ ...m.edit, custom: [next] }, ANIMATIONS).length) {
      onDraft(sorted([...others, next])); if(!advanced)onPlaced?.(next);
      setAnchor(null); setError("Carte ajoutée au brouillon : complétez ses champs dans les réglages à droite avant d’enregistrer."); return;
    }
    if (toMs - fromMs < 500 || issues.length) {
      if (fromIndex !== undefined) {
        setAnchor(null); setError("Déplacement impossible : la carte reste sur sa scène d’origine. " + issues.join(" ")); return;
      }
      setError(toMs - fromMs < 500 ? "Scène trop courte : choisissez un autre début dans le formulaire." : "Complétez ou ajustez les réglages ci-dessous avant d’ajouter cette carte. " + issues.join(" "));
      toForm();
      return;
    }
    onDraft(sorted([...others, next])); if(!advanced)onPlaced?.(next);
    setAnchor(null); setError(null);
  };

  useImperativeHandle(ref, () => ({ place: (name, scene, fromIndex) => {
    const c = sceneCardCandidate(name, scene, { kept, keyword: m.reel?.keyword ?? null, canBehind: Boolean(m.edit && matteAt(m.edit, scene.startMs)) });
    if (c) placeOnScene(c, scene, fromIndex);
    else setError("Cette animation n’est pas disponible pour cette séquence.");
  } }));

  return (
    <>
      {studioMode ? <button type="button" className="btn-ghost min-h-[44px] w-full text-xs" onClick={() => setAdvanced(!advanced)}>{advanced ? "Retour à la bibliothèque" : "Éditeur avancé"}</button> : null}
    <fieldset disabled={disabled || Boolean(busy)} className="min-w-0 space-y-4">
      {(!studioMode || advanced) ? <div>
        <h3 className="font-display text-lg">Créez vos animations sur cette vidéo</h3>
        <p className="mt-1 text-sm text-mut">Choisissez une carte dans la bibliothèque, puis déposez-la sur une scène. Ajustez le texte et testez le brouillon avant de l’enregistrer.</p>
      </div> : null}
      <StudioScenes compact={studioMode && !advanced} activeScene={activeScene} m={m} draft={draft} kept={kept} usage={usage} choices={choices ?? []} disabled={disabled || Boolean(busy)}
        onChoose={(id) => choose([...new Set([...(choices ?? []), id])])} onPlace={placeOnScene}
        onRemove={(index) => onDraft(draft.filter((_, i) => i !== index))} onEdit={editAnimation} onTest={onTest}
        onUse={(c) => { pick(c.motion.id, { values: c.values, anchorMs: c.anchorMs }); toForm(); }} />
      {(!studioMode || advanced) ? <>
      <div className="space-y-2 rounded-xl border border-line p-3">
        <p className="text-sm font-medium">Animations choisies pour les propositions de Bee</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choix d’animations pour Bee">
          {(choices ?? []).map((id) => <button type="button" key={id} className="btn-ghost min-h-[36px] text-xs" aria-label={`Retirer ${ANIMATIONS[id]?.label ?? id} des choix de Bee`} onClick={() => choose(choices?.filter((name) => name !== id))}>{ANIMATIONS[id]?.label ?? id} ×</button>)}
          {!choices?.length ? <span className="text-xs text-mut">Aucune. Choisissez vos cartes dans la bibliothèque ; Bee proposera ensuite uniquement ces animations.</span> : null}
        </div>
        {choices === undefined ? <button type="button" className="btn-ghost min-h-[36px] text-xs" onClick={() => choose([])}>Continuer sans animations IA</button> : null}
        <p className="text-xs text-mut">Retirer un choix ne supprime pas une animation déjà posée. Enregistrez vos choix et le brouillon avant de demander les propositions.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost min-h-[44px]" disabled={!words.length || !availableChoices.length || !saved || Boolean(busy)} aria-busy={busy === "suggest"}
          onClick={() => run("suggest", async () => { const r = await montage.suggest(m.id, m.updatedAt); setSuggestions(r.suggestions); setRejected(r.rejected); })}>
          {busy === "suggest" ? "Bee prépare des propositions…" : "Proposer avec Bee"}
        </button>
        {!words.length ? <p className="self-center text-xs text-mut">La transcription est nécessaire uniquement pour les propositions de Bee et le placement sur un mot.</p> : null}
      </div>

      {suggestions.length || rejected.length ? (
        <div className="space-y-2 rounded-xl bg-black/[0.03] p-3">
          <p className="text-sm font-medium">Propositions de Bee (tirées du transcript)</p>
          {suggestions.map((s, i) => (
            <div key={`${s.name}-${s.fromMs}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="pill bg-white text-xs">{ANIMATIONS[s.name]?.label ?? s.name}</span>
              <span className="tabular-nums text-mut">{sec(s.fromMs)}</span>
              <span className="min-w-0 flex-1">{summary(s)}{s.reason ? <span className="text-mut"> — {s.reason}</span> : null}</span>
              <button type="button" className="btn-ghost min-h-[36px] text-xs" disabled={checkTimeline([...draft, s]).length > 0}
                onClick={() => { const { reason: _r, ...c } = s; void _r; if(c.name==="logo-fin"&&onAppendOutro)onAppendOutro();else onDraft(sorted([...draft, c])); setSuggestions(suggestions.filter((_, j) => j !== i)); }}>Ajouter</button>
              <button type="button" className="btn-ghost min-h-[36px] text-xs" onClick={() => setSuggestions(suggestions.filter((_, j) => j !== i))}>Ignorer</button>
            </div>
          ))}
          {rejected.length ? <p className="text-xs text-mut">Écartées par le contrôle : {rejected.map((r) => `${r.name} (${r.why})`).join(" ; ")}.</p> : null}
        </div>
      ) : null}

      <ol className="divide-y divide-line rounded-xl border border-line" aria-label="Animations du montage">
        {draft.length === 0 ? <li className="px-3 py-2 text-sm text-mut">Aucune animation pour l&apos;instant.</li> : null}
        {draft.map((c, i) => (
          <li key={`${c.name}-${c.fromMs}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="pill bg-black/[0.05] text-xs">{ANIMATIONS[c.name]?.label ?? c.name}</span>
            <span className="tabular-nums text-mut">{sec(c.fromMs)} → {sec(c.toMs)}</span>
            <span className="min-w-0 flex-1 truncate">{summary(c)}</span>
            <button type="button" className="btn-ghost min-h-[36px] text-xs" aria-label={`Tester ${ANIMATIONS[c.name]?.label ?? c.name}`} onClick={() => onTest(c.fromMs)}>▶ Tester</button>
            <button type="button" className="btn-ghost min-h-[36px] text-xs" aria-label={`Remplacer ${ANIMATIONS[c.name]?.label ?? c.name}`}
              onClick={() => editAnimation(i)}>Remplacer</button>
            <button type="button" className="btn-ghost min-h-[36px] text-xs" onClick={() => onDraft(draft.filter((_, j) => j !== i))}>Retirer</button>
            {ANIMATIONS[c.name] && !approved.has(c.name) ? (
              <button type="button" className="btn-ghost min-h-[36px] text-xs" disabled={Boolean(busy)}
                onClick={() => {
                  if (!window.confirm(`ON GARDE : ajouter « ${ANIMATIONS[c.name].label} » à BeeMotion comme motion validé ? Il pourra être proposé automatiquement dans les prochaines vidéos.`)) return;
                  void run("keep", async () => { const r = await montage.keepMotion(c.name, m.id); setKept(r.kept); });
                }}>On garde</button>
            ) : null}
          </li>
        ))}
      </ol>
      {timeline.length ? <p role="alert" className="whitespace-pre-line text-sm text-red-700">{timeline.join("\n")}</p> : null}

      <fieldset id="montage-anim-form" className="min-w-0 space-y-3 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-medium">Ajouter une animation</legend>
        <label className="block text-sm">
          Animation
          <select value={name} onChange={(e) => pick(e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
            {NAMES.filter(n=>!onAppendOutro||n!=="logo-fin").map((n) => <option key={n} value={n} disabled={!canBehind && isBehind(n, ANIMATIONS)}>{ANIMATIONS[n].label}{!canBehind && isBehind(n, ANIMATIONS) ? " — détourage requis" : ""}</option>)}
          </select>
        </label>
        <p className="text-xs text-mut">{ANIMATIONS[name].description}</p>
        {fieldsOf(ANIMATIONS[name]).map((f) => (
          <label key={f.key} className="block text-sm">
            {FIELD_LABELS[f.key] ?? f.key}{f.optional ? " (facultatif)" : ""}{f.kind === "list" ? " — un élément par ligne" : ""}
            {f.kind === "choice"
              ? <select value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
                  {f.optional ? <option value="">Par défaut</option> : null}
                  {(f.options ?? []).map((o) => <option key={o} value={o}>{CHOICE_LABELS[o] ?? o}</option>)}
                </select>
              : f.kind === "list"
              ? <textarea rows={3} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
              : <input type={f.kind === "number" ? "number" : "text"} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />}
          </label>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Début de l’animation (secondes)
            <input type="number" min={0} step={0.1} value={anchor === null ? "" : anchor / 1000} onChange={(e) => setAnchor(Number.isFinite(e.target.valueAsNumber) ? Math.round(e.target.valueAsNumber * 1000) : null)} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm">
            Durée (secondes)
            <input type="number" min={0.5} max={15} step={0.5} value={Number.isFinite(lengthMs) ? lengthMs / 1000 : ""} onChange={(e) => setLengthMs(Math.round(e.target.valueAsNumber * 1000))} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          </label>
        </div>
        <button type="button" className="btn-ghost min-h-[44px] text-sm" disabled={playheadMs === null} onClick={() => setAnchor(playheadMs)}>À la position de lecture</button>
        <p className="text-xs text-mut">Repères en secondes de la prise d’origine, avant les coupes. L’animation s’arrête au plus tard à la fin du montage.</p>
        {words.length ? <div>
          <p className="text-sm">Début : cliquez le mot sur lequel l&apos;animation apparaît {anchor !== null ? <strong>({sec(anchor)})</strong> : null}</p>
          <p className="mt-1 max-h-40 overflow-y-auto rounded-xl bg-black/[0.03] p-2 text-sm leading-relaxed">
            {words.map((w) => (
              <button key={w.startMs} type="button" onClick={() => setAnchor(w.startMs)} className={`rounded px-0.5 ${anchor === w.startMs ? "bg-brand text-white" : "hover:bg-black/[0.06]"}`}>{w.text.trim()}</button>
            ))}
          </p>
        </div> : null}
        {candidateError ? <p className="text-sm text-red-700">{candidateError}</p> : null}
        <button type="button" className="btn-ghost min-h-[44px]" disabled={!candidate || Boolean(candidateError) || checkTimeline([...draft, candidate]).length > 0}
          onClick={() => { if (candidate) { if(candidate.name==="logo-fin"&&onAppendOutro){onAppendOutro();return;} onDraft(sorted([...draft, candidate])); choose([...new Set([...(choices ?? []), candidate.name])]); setAnchor(null); } }}>
          Ajouter au brouillon
        </button>
        {candidate && !candidateError && checkTimeline([...draft, candidate]).length ? <p className="text-xs text-mut">{checkTimeline([...draft, candidate])[0]}</p> : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-red min-h-[44px]" disabled={saved || timeline.length > 0 || Boolean(busy)} aria-busy={busy === "save"}
          onClick={() => run("save", () => onSave(draft))}>
          {busy === "save" ? "Enregistrement…" : "Enregistrer les animations"}
        </button>
        {!saved ? <button type="button" className="btn-ghost min-h-[44px]" onClick={() => { onDraft(m.edit?.custom ?? []); choose(m.edit?.animationChoices); }}>Revenir à l&apos;enregistré</button> : null}
        {!saved ? <span className="text-xs text-mut">Brouillon visible dans l&apos;aperçu, pas encore enregistré.</span> : null}
      </div>
      {error ? <p role="alert" className="whitespace-pre-line text-sm text-red-700">{error}</p> : null}
      </> : <p className="text-xs text-mut">Choisissez une séquence dans la timeline, puis ajoutez une carte. Ses réglages s’ouvrent à droite.</p>}
      {studioMode && !advanced && error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </fieldset>
    </>
  );
});
export default MontageAnimations;
