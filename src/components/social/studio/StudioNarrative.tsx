"use client";
import { useState } from "react";
import { montage, type MontageDetail } from "@/lib/social/montage-api";
import { CTA_OBJECTIVES, NARRATIVE_ROLES, type CtaObjective, type NarrativeRole, type Storyboard } from "@/domain/social/montage/ideation";
import {
  BLOCK_INTENTS, BLOCK_INTENT_LABEL, CTA_OBJECTIVE_LABEL, estimateSeconds, HOOK_TYPE_LABEL, NARRATIVE_GUIDE, NARRATIVE_LABEL,
  NARRATIVE_MAX_S, NARRATIVE_MIN_S, narrativeCoverage, scoreNarrative, speechSeconds, type BlockIntent, type Hook,
} from "@/domain/social/montage/narrative";

/**
 * MOTEUR NARRATIF dans le storyboard existant (2026-10-24). Aucun nouvel écran : une bande Hook → CTA, les trois hooks à
 * choisir, la durée estimée et un potentiel indicatif au-dessus des séquences ; sur chaque séquence, son rôle et ses
 * retouches IA. Bee propose (contrôlé par le serveur), la direction choisit, enregistre et valide comme avant.
 */

/**
 * Hooks proposés, gardés par montage pour la session : le panneau Idéation est recréé après chaque enregistrement
 * (clé = version du montage) et les perdrait sinon. Ce sont des propositions : rien n'est écrit en base tant que la
 * direction n'en choisit pas un puis n'enregistre le storyboard.
 */
const HOOKS_KEY = (id: string) => `bee.montage.hooks.${id}`;
const readHooksCache = (id: string): Hook[] => { try { return JSON.parse(sessionStorage.getItem(HOOKS_KEY(id)) ?? "[]") as Hook[]; } catch { return []; } };
const writeHooksCache = (id: string, hooks: Hook[]) => { try { sessionStorage.setItem(HOOKS_KEY(id), JSON.stringify(hooks)); } catch { /* facultatif */ } };

type Props = {
  m: MontageDetail; sb: Storyboard | null; setSb: (sb: Storyboard) => void; disabled?: boolean;
  dirty: boolean; onChange: () => void; onWarnings: (w: string[]) => void; onError: (e: string | null) => void;
};

export default function StudioNarrative({ m, sb, setSb, disabled, dirty, onChange, onWarnings, onError }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [hooks, keepHooks] = useState<Hook[]>(() => readHooksCache(m.id));
  const setHooks = (h: Hook[]) => { keepHooks(h); writeHooksCache(m.id, h); };
  const [chosen, setChosen] = useState<CtaObjective>(sb?.ctaObjectif ?? "commentaire");
  const objectif: CtaObjective = sb?.ctaObjectif ?? chosen;
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); onError(null);
    try { await fn(); } catch (e) { onError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(null); }
  };
  const structured = Boolean(sb?.sequences.some((s) => s.role));
  const total = sb ? estimateSeconds(sb) : 0;
  const score = sb && structured && m.brief ? scoreNarrative(sb, m.brief) : null;
  const coverage = sb ? narrativeCoverage(sb) : NARRATIVE_ROLES.map((role) => ({ role, index: -1 }));
  const focusSeq = (i: number) => document.getElementById(`sequence-${i}`)?.focus();

  const chooseHook = (h: Hook) => {
    if (!sb) return;
    const i = sb.sequences.findIndex((s) => s.role === "HOOK");
    const hookSeq = { idee: "Hook", parole: h.parole, titre: h.titre, traitement: "onglet" as const, dureeS: Math.max(2, Math.round(speechSeconds(h.parole))), role: "HOOK" as const };
    setSb({ ...sb, sequences: i >= 0 ? sb.sequences.map((s, k) => (k === i ? { ...s, parole: h.parole, titre: h.titre } : s)) : [hookSeq, ...sb.sequences] });
  };
  /** Retouche de plusieurs blocs (Optimiser, Raccourcir) : un appel par bloc, chacun contrôlé par le serveur. */
  const rework = async (roles: NarrativeRole[], intent: BlockIntent) => {
    if (!sb) return;
    let next = sb;
    for (const role of roles) {
      const i = next.sequences.findIndex((s) => s.role === role);
      if (i < 0) continue;
      const r = await montage.reworkBlock(m.id, next, i, intent, objectif);
      next = { ...next, sequences: next.sequences.map((s, k) => (k === i ? r.sequence : s)) };
      onWarnings(r.warnings);
    }
    setSb(next);
  };
  const longest = (n: number) => sb ? [...sb.sequences].filter((s) => s.role && s.role !== "CTA").sort((a, b) => speechSeconds(b.parole) - speechSeconds(a.parole)).slice(0, n).map((s) => s.role!) : [];

  return (
    <section aria-label="Moteur narratif" className="space-y-3 rounded-2xl border border-line bg-white/70 p-4 shadow-[0_8px_30px_rgba(40,81,255,0.06)] backdrop-blur">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Structure narrative <span className="font-normal text-mut">· Hook → Lead → Body → Open loop → Payoff → CTA</span></p>
          <p className="text-xs text-mut">L'IA écrit les huit blocs ; tu choisis le hook, corriges, puis enregistres et valides le storyboard comme d'habitude.</p>
        </div>
        <label className="text-xs text-mut">Objectif du CTA
          <select className="mt-1 block min-h-[36px] rounded-xl border border-line bg-white px-2 text-sm text-fg" value={objectif} disabled={disabled}
            onChange={(e) => { const v = e.target.value as CtaObjective; setChosen(v); if (sb) setSb({ ...sb, ctaObjectif: v }); }}>
            {CTA_OBJECTIVES.map((o) => <option key={o} value={o}>{CTA_OBJECTIVE_LABEL[o]}</option>)}
          </select>
        </label>
        <button type="button" className="btn-red min-h-[36px] px-3 text-xs" disabled={disabled || !m.brief || Boolean(busy)}
          onClick={() => run("full", async () => {
            if (sb?.sequences.length && !window.confirm(`Remplacer le storyboard actuel par une proposition en huit blocs ?${dirty ? " Tes modifications non enregistrées seront remplacées." : ""} Il repasse en brouillon ; rien n'est publié.`)) return;
            const r = await montage.proposeNarrative(m.id, objectif); setSb(r.storyboard); setHooks(r.hooks); onWarnings(r.warnings); onChange(); })}>
          {busy === "full" ? "L'IA structure le Reel…" : structured ? "Restructurer avec l'IA" : "Structurer avec l'IA"}
        </button>
      </div>

      {sb ? <ol className="grid grid-cols-4 gap-1 sm:grid-cols-8" aria-label="Bande narrative">
        {coverage.map(({ role, index }) => <li key={role} className="min-w-0">
          <button type="button" disabled={index < 0} onClick={() => focusSeq(index)} title={NARRATIVE_GUIDE[role]}
            className={`h-9 w-full truncate rounded-lg px-1 text-[11px] font-semibold transition ${index >= 0 ? "bg-brand text-white hover:brightness-110" : "border border-dashed border-line text-mut"}`}>{NARRATIVE_LABEL[role]}</button>
        </li>)}
      </ol> : null}

      {hooks.length ? <div className="space-y-2" aria-label="Trois hooks">
        <div className="flex items-center justify-between"><p className="text-xs font-medium text-mut">Choisis ton hook</p>
          <button type="button" className="text-xs text-brand underline-offset-2 hover:underline" disabled={disabled || Boolean(busy)}
            onClick={() => run("hooks", async () => { const r = await montage.proposeHooks(m.id, objectif); setHooks(r.hooks); })}>{busy === "hooks" ? "…" : "Trois autres hooks"}</button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-3">
          {hooks.map((h) => {
            const current = sb?.sequences.find((s) => s.role === "HOOK")?.parole === h.parole;
            return <li key={h.type}>
              <button type="button" disabled={disabled} onClick={() => chooseHook(h)} aria-pressed={current}
                className={`h-full w-full rounded-xl border p-3 text-left text-sm transition ${current ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand"}`}>
                <span className="flex items-center gap-2 text-xs font-semibold text-brand">{HOOK_TYPE_LABEL[h.type]}{h.recommended ? <span className="pill bg-brand text-[10px] text-white">Recommandé</span> : null}</span>
                <span className="mt-1 block text-fg">{h.parole}</span>
              </button>
            </li>;
          })}
        </ul>
      </div> : null}

      {sb ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className={total > NARRATIVE_MAX_S || (structured && total < NARRATIVE_MIN_S) ? "font-medium text-amber-800" : "text-mut"}>Durée estimée : {total} s <span className="text-mut">(cible {NARRATIVE_MIN_S}-{NARRATIVE_MAX_S} s)</span></span>
        {structured && total > NARRATIVE_MAX_S ? <button type="button" className="btn-ghost min-h-[32px] px-2 text-xs" disabled={disabled || Boolean(busy)}
          onClick={() => run("shorten", () => rework(longest(2), "raccourcir"))}>{busy === "shorten" ? "Raccourcissement…" : "Raccourcir avec l'IA"}</button> : null}
        {score ? <>
          <span className="text-mut" title={score.notes.join(" ") || "Aucun point faible repéré."}>Potentiel : <strong className="text-fg">{score.overall}/100</strong> · Hook {score.hook} · Rétention {score.retention} · Clarté {score.clarity} · CTA {score.cta}</span>
          {score.weak.length ? <button type="button" className="btn-ghost min-h-[32px] px-2 text-xs" disabled={disabled || Boolean(busy)}
            onClick={() => run("optimize", () => rework(score.weak.slice(0, 3), "optimiser"))}>{busy === "optimize" ? "Optimisation…" : `Optimiser (${score.weak.slice(0, 3).map((r) => NARRATIVE_LABEL[r]).join(", ")})`}</button> : null}
        </> : null}
      </div> : null}
      {score ? <p className="text-[11px] text-mut">Potentiel indicatif calculé sur le texte (structure, longueur, relances, CTA) : ce n'est pas une prévision de vues.</p> : null}
    </section>
  );
}

/** Rôle et retouches IA d'une séquence, dans la carte existante de la séquence. */
export function NarrativeBlockTools({ m, sb, index, disabled, onSequence, onWarnings, onError }: {
  m: MontageDetail; sb: Storyboard; index: number; disabled?: boolean;
  onSequence: (seq: Storyboard["sequences"][number]) => void; onWarnings: (w: string[]) => void; onError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState<BlockIntent | null>(null);
  const seq = sb.sequences[index];
  const intents = BLOCK_INTENTS.filter((i) => i !== "optimiser");
  return (
    <div className="flex flex-wrap items-center gap-1">
      <label className="text-xs text-mut"><span className="sr-only">Rôle narratif de la séquence {index + 1}</span>
        <select className="min-h-[32px] rounded-lg border border-line bg-white px-2 text-xs text-fg" value={seq.role ?? ""} disabled={disabled}
          onChange={(e) => { const role = e.target.value as NarrativeRole | ""; const { role: _r, ...rest } = seq; void _r; onSequence(role ? { ...rest, role } : rest); }}>
          <option value="">Rôle —</option>
          {NARRATIVE_ROLES.map((r) => <option key={r} value={r}>{NARRATIVE_LABEL[r]}</option>)}
        </select>
      </label>
      {seq.role ? intents.map((intent) => <button key={intent} type="button" className="rounded-full border border-line bg-white px-2 py-1 text-[11px] text-mut transition hover:border-brand hover:text-brand disabled:opacity-50"
        disabled={disabled || Boolean(busy) || !m.brief}
        onClick={async () => {
          setBusy(intent); onError(null);
          try { const r = await montage.reworkBlock(m.id, sb, index, intent, sb.ctaObjectif); onSequence(r.sequence); onWarnings(r.warnings); }
          catch (e) { onError(e instanceof Error ? e.message : "Retouche impossible."); }
          finally { setBusy(null); }
        }}>{busy === intent ? "…" : BLOCK_INTENT_LABEL[intent]}</button>) : null}
      {seq.role ? <span className="text-[11px] text-mut">≈ {speechSeconds(seq.parole)} s</span> : null}
    </div>
  );
}
