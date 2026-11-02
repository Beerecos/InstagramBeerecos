"use client";
import { useState } from "react";
import { montage, type MontageDetail } from "@/lib/social/montage-api";
import { PILIERS, TRAITEMENTS, TRAITEMENT_LABELS, type Brief, type Storyboard } from "@/domain/social/montage/ideation";
import { reelNarrativeServer } from "@/lib/social/feature-flags";
import StudioNarrative, { NarrativeBlockTools } from "@/components/social/studio/StudioNarrative";

/**
 * IDÉATION DU STUDIO (lot S4, Video Agent Kit §7 : direction → storyboard → plan). 1. Brief en trois lignes
 * obligatoires (sujet, angle, mot-clé du CTA). 2. Storyboard séquence par séquence : Bee le propose (contrôlé par le
 * serveur : aucun chiffre hors du brief ou de la prise), la direction le corrige et le VALIDE. 3. Plan : le storyboard
 * validé guide les animations proposées (Animations, Tout auto). Rien n'est construit sans storyboard validé : la
 * planche contact et le rendu l'exigent.
 */

const EMPTY_SEQ = { idee: "", parole: "", titre: "", traitement: "onglet" as const, dureeS: 4 };
const field = "mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";

/**
 * `warnings` / `onWarnings` : les avertissements du dernier contrôle vivent dans le Studio, car ce panneau est recréé
 * après chaque enregistrement (clé = version du montage) et les perdrait sinon.
 */
export default function StudioIdeation({ m, disabled, onChange, warnings, onWarnings: setWarnings }: { m: MontageDetail; disabled?: boolean; onChange: () => void; warnings: string[]; onWarnings: (w: string[]) => void }) {
  const [brief, setBrief] = useState<Partial<Brief>>(m.brief ?? {});
  const [sb, setSb] = useState<Storyboard | null>(m.storyboard ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approved = m.storyboardStatus === "approved";
  const sbDirty = JSON.stringify(sb) !== JSON.stringify(m.storyboard ?? null);
  const briefDirty = JSON.stringify(brief) !== JSON.stringify(m.brief ?? {});
  const total = sb ? sb.sequences.reduce((n, s) => n + (Number(s.dureeS) || 0), 0) : 0;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(null); }
  };
  const setSeq = (i: number, patch: Partial<Storyboard["sequences"][number]>) => sb && setSb({ ...sb, sequences: sb.sequences.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const cleanBrief = (): Brief => ({
    sujet: brief.sujet ?? "", angle: brief.angle ?? "", motCle: (brief.motCle ?? "").toUpperCase(),
    ...(brief.pilier ? { pilier: brief.pilier } : {}), ...(brief.objectif?.trim() ? { objectif: brief.objectif } : {}),
  });

  return (
    <div className="space-y-4">
      <section aria-label="Brief" className="space-y-2">
        <h4 className="text-sm font-medium">1. Brief <span className="text-xs font-normal text-mut">(trois lignes obligatoires)</span></h4>
        <label className="block text-sm">Sujet<input className={field} value={brief.sujet ?? ""} maxLength={200} disabled={disabled} onChange={(e) => setBrief({ ...brief, sujet: e.target.value })} /></label>
        <label className="block text-sm">Angle (en quoi elle diffère de ce qui a déjà été fait)<input className={field} value={brief.angle ?? ""} maxLength={300} disabled={disabled} onChange={(e) => setBrief({ ...brief, angle: e.target.value })} /></label>
        <label className="block text-sm">Mot-clé du CTA (créé dans le moteur de DM avant publication)
          <input className={field} value={brief.motCle ?? ""} maxLength={20} placeholder="CLUB" disabled={disabled} onChange={(e) => setBrief({ ...brief, motCle: e.target.value.toUpperCase().replace(/\s/g, "") })} />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">Pilier
            <select className={field} value={brief.pilier ?? ""} disabled={disabled} onChange={(e) => setBrief({ ...brief, pilier: (e.target.value || undefined) as Brief["pilier"] })}>
              <option value="">—</option>{PILIERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block text-sm">Objectif (facultatif)<input className={field} value={brief.objectif ?? ""} maxLength={200} disabled={disabled} onChange={(e) => setBrief({ ...brief, objectif: e.target.value })} /></label>
        </div>
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={disabled || !briefDirty || Boolean(busy)}
          onClick={() => run("brief", async () => { await montage.saveBrief(m.id, cleanBrief()); onChange(); })}>{busy === "brief" ? "Enregistrement…" : "Enregistrer le brief"}</button>
        {approved && briefDirty ? <p className="text-xs text-amber-800">Changer le brief repasse le storyboard validé en brouillon.</p> : null}
      </section>

      <section aria-label="Storyboard" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium">2. Storyboard {m.storyboardStatus ? <span className={`pill ml-1 text-xs ${approved ? "bg-emerald-100 text-emerald-800" : "bg-black/[0.05] text-mut"}`}>{approved ? "Validé" : "Brouillon"}</span> : null}</h4>
          <button type="button" className="btn-ghost min-h-[36px] px-3 text-xs" disabled={disabled || !m.brief || briefDirty || Boolean(busy)}
            onClick={() => run("propose", async () => { const r = await montage.proposeStoryboard(m.id); setSb(r.storyboard); setWarnings(r.warnings); onChange(); })}>
            {busy === "propose" ? "Bee prépare le storyboard…" : sb ? "Demander une autre proposition à Bee" : "Bee propose un storyboard"}
          </button>
        </div>
        {!m.brief ? <p className="text-xs text-mut">Enregistrez d&apos;abord le brief.</p> : null}
        {reelNarrativeServer && m.brief ? <StudioNarrative m={m} sb={sb} setSb={setSb} disabled={disabled} dirty={sbDirty || briefDirty} onChange={onChange} onWarnings={setWarnings} onError={setError} /> : null}
        {sb ? (
          <>
            <ol className="space-y-2">
              {sb.sequences.map((s, i) => (
                <li key={i} id={`sequence-${i}`} tabIndex={-1} className="space-y-1 rounded-xl border border-line p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label={`Séquence ${i + 1}`}>
                  <div className="flex items-center justify-between text-xs text-mut"><span>Séquence {i + 1}</span>
                    <button type="button" className="underline" disabled={disabled || sb.sequences.length === 1} onClick={() => setSb({ ...sb, sequences: sb.sequences.filter((_, j) => j !== i) })}>Retirer</button>
                  </div>
                  {reelNarrativeServer ? <NarrativeBlockTools m={m} sb={sb} index={i} disabled={disabled} onSequence={(seq) => setSb({ ...sb, sequences: sb.sequences.map((x, j) => (j === i ? seq : x)) })} onWarnings={setWarnings} onError={setError} /> : null}
                  <input className={field} aria-label={`Idée de la séquence ${i + 1}`} value={s.idee} maxLength={200} disabled={disabled} onChange={(e) => setSeq(i, { idee: e.target.value })} placeholder="Idée" />
                  <textarea className={field} rows={2} aria-label={`Parole de la séquence ${i + 1}`} value={s.parole} maxLength={400} disabled={disabled} onChange={(e) => setSeq(i, { parole: e.target.value })} placeholder="Parole (reprise du transcript)" />
                  <div className="grid gap-1 sm:grid-cols-[1fr_auto_auto]">
                    <input className={field} aria-label={`Titre affiché de la séquence ${i + 1}`} value={s.titre} maxLength={60} disabled={disabled} onChange={(e) => setSeq(i, { titre: e.target.value })} placeholder="Titre affiché (quelques mots)" />
                    <select className={field} aria-label={`Traitement de la séquence ${i + 1}`} value={s.traitement} disabled={disabled} onChange={(e) => setSeq(i, { traitement: e.target.value as (typeof TRAITEMENTS)[number] })}>
                      {TRAITEMENTS.map((t) => <option key={t} value={t}>{TRAITEMENT_LABELS[t]}</option>)}
                    </select>
                    <input className={`${field} w-20`} type="number" min={1} max={60} aria-label={`Durée de la séquence ${i + 1} (s)`} value={s.dureeS} disabled={disabled} onChange={(e) => setSeq(i, { dureeS: Number(e.target.value) })} />
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className="btn-ghost min-h-[32px] px-2 text-xs" disabled={disabled || sb.sequences.length >= 12} onClick={() => setSb({ ...sb, sequences: [...sb.sequences, { ...EMPTY_SEQ }] })}>+ Séquence</button>
            <label className="block text-sm">Conclusion : CTA<input className={field} value={sb.cta} maxLength={120} disabled={disabled} onChange={(e) => setSb({ ...sb, cta: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sb.baseline} disabled={disabled} onChange={(e) => setSb({ ...sb, baseline: e.target.checked })} /> Baseline #MonReseauCestTonReseau à la fin</label>
            <p className="text-xs text-mut">Durée prévue : {total} s (3 min au plus).</p>
            {warnings.length ? <ul aria-label="Avertissements du storyboard" className="list-disc pl-5 text-xs text-amber-800">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={disabled || !sbDirty || Boolean(busy)}
                onClick={() => run("save", async () => { const r = await montage.saveStoryboard(m.id, sb, m.updatedAt); setWarnings(r.warnings); onChange(); })}>{busy === "save" ? "Enregistrement…" : "Enregistrer le storyboard"}</button>
              <button type="button" className="btn-red min-h-[40px] px-3 text-sm" disabled={disabled || sbDirty || approved || !m.storyboard || Boolean(busy)}
                onClick={() => run("approve", async () => { const r = await montage.approveStoryboard(m.id, m.updatedAt); setWarnings(r.warnings); onChange(); })}>{busy === "approve" ? "Validation…" : "Valider le storyboard"}</button>
            </div>
            {approved ? <p role="status" className="text-sm">✅ Storyboard validé : il guide désormais les animations proposées par Bee (3. Plan : onglet Animations ou ⚡ Tout auto).</p> : null}
          </>
        ) : null}
      </section>
      {error ? <p role="alert" className="whitespace-pre-line text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
