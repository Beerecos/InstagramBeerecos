"use client";
import { useMemo, useState } from "react";
import type { MontageDetail } from "@/lib/social/montage-api";
import { applyAutoCut, planAutoCut } from "@/domain/social/montage/pipeline";
import { takeBreaks } from "@/domain/social/montage/edit";
import { keptMs } from "@/domain/social/montage/montage";
import { keptWords } from "@/domain/social/montage/suggest";
import type { Proposal } from "@/components/social/studio/StudioFeedback";

const sec = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

export default function StudioCutPlan({ m, disabled, proposal, onPreview, onClear, onApply }: {
  m: MontageDetail; disabled: boolean; proposal: Proposal | null;
  onPreview: (proposal: Proposal) => void; onClear: () => void; onApply: (proposal: Proposal) => Promise<void>;
}) {
  const words = useMemo(() => keptWords(m.captions, m.edit?.ranges ?? []), [m.captions, m.edit]);
  const clauses = useMemo(() => planAutoCut(words, { takeBreaks: m.edit ? takeBreaks(m.edit) : [] }), [words, m.edit]);
  const [drop, setDrop] = useState(() => new Set(clauses.filter(c => c.suggestDrop).map(c => c.n)));
  const [breaths, setBreaths] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Intersect with the saved edit: cleaning must never restore an earlier manual cut.
  const ranges = useMemo(() => applyAutoCut(words, clauses, drop, m.durationMs ?? undefined, { preserveBreaths: breaths })
    .flatMap(range => (m.edit?.ranges ?? []).map(saved => ({ fromMs: Math.max(range.fromMs, saved.fromMs), toMs: Math.min(range.toMs, saved.toMs) })))
    .filter(range => range.toMs > range.fromMs), [words, clauses, drop, m.durationMs, m.edit, breaths]);
  const previewed = proposal?.baseUpdatedAt === m.updatedAt && JSON.stringify(proposal.edit.ranges) === JSON.stringify(ranges);
  const toggle = (n: number) => { onClear(); setDrop(previous => { const next = new Set(previous); if (next.has(n)) next.delete(n); else next.add(n); return next; }); };
  const apply = async () => {
    if (!proposal || !previewed) return;
    setBusy(true); setError(null);
    try { await onApply(proposal); } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); }
  };

  return <fieldset disabled={disabled || busy} className="min-w-0 space-y-3">
    <legend className="mb-2 font-semibold">Doublons, faux départs et fluidité</legend>
    <p className="text-sm text-mut">Les reprises probables sont cochées ; la dernière version est conservée. Décoche ce que tu souhaites garder. En cas de doute, conserve la phrase et écoute le raccord.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={breaths} onChange={e => { onClear(); setBreaths(e.target.checked); }} />Conserver les respirations courtes</label>
    <p className="text-xs text-mut">{breaths ? "Pauses jusqu’à 0,7 s conservées, avec une marge autour de la parole." : "Coupe plus serrée des silences au-delà de 0,35 s."} Les hésitations « euh » et « ben » sont retirées. Les coupes déjà enregistrées sont conservées.</p>
    <p className="text-sm">Durée : {sec(m.keptMs ?? 0)} → {sec(keptMs(ranges))}</p>
    <ol className="max-h-[30rem] divide-y divide-line overflow-y-auto rounded-xl border border-line" aria-label="Phrases du plan de coupe">
      {clauses.map(c => <li key={c.n}>
        <label className={`flex cursor-pointer items-start gap-3 px-3 py-2 text-sm ${drop.has(c.n) ? "bg-black/[0.03] text-mut" : ""}`}>
          <input type="checkbox" className="mt-1" checked={drop.has(c.n)} onChange={() => toggle(c.n)} aria-label={`Retirer la phrase ${c.n}`} />
          <span className="shrink-0 tabular-nums text-mut">{c.n} · {sec(c.fromMs)}</span>
          <span className="min-w-0"><span className={drop.has(c.n) ? "line-through" : ""}>{c.text}</span>{c.suggestDrop ? <span className="mt-1 block text-xs">{c.suggestDrop}</span> : null}</span>
        </label>
      </li>)}
    </ol>
    {!clauses.length ? <p className="text-sm text-mut">Aucune phrase conservée à analyser.</p> : null}
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-ghost min-h-[44px]" disabled={!ranges.length || !m.edit} onClick={() => {
        if (m.edit) onPreview({ edit: { ...m.edit, ranges }, baseUpdatedAt: m.updatedAt });
      }}>Prévisualiser la coupe</button>
      <button type="button" className="btn-red min-h-[44px]" disabled={!previewed || !ranges.length} onClick={apply}>{busy ? "Enregistrement…" : "Appliquer la coupe"}</button>
      {proposal ? <button type="button" className="btn-ghost min-h-[44px]" onClick={onClear}>Écarter la coupe</button> : null}
    </div>
    {previewed ? <p role="status" className="text-sm text-brand">La coupe est dans l’aperçu. Écoute les raccords avant de l’appliquer ; rien n’est encore enregistré.</p> : null}
    {disabled ? <p className="text-xs text-mut">Enregistre d’abord les animations en cours et attends la fin des traitements avant de préparer une coupe.</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </fieldset>;
}
