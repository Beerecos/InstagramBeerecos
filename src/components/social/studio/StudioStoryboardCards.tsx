"use client";
/**
 * Étape « Storyboard » du Studio (refonte 2026-11-10) : le montage entier en cartes, une par séquence, sans timeline.
 * Garder · Modifier (langage naturel, limité à la séquence) · Supprimer (restaurable) · Régénérer (cette séquence
 * seulement). Toute modification passe par l'enregistrement habituel du montage (annuler / rétablir conservés).
 */
import { useMemo, useState } from "react";
import { montage, type MontageDetail } from "@/lib/social/montage-api";
import type { Edit } from "@/domain/social/montage/edit";
import { matteAt } from "@/domain/social/montage/matte";
import {
  deleteCard, keepCard, markModified, modifyInstruction, regenerateCard, restoreCard, STATUS_LABEL, storyboardCards, type StoryboardCard,
} from "@/domain/social/montage/storyboard-cards";
import type { Proposal } from "@/components/social/studio/StudioFeedback";

const time = (ms: number | null) => (ms === null ? "—" : `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`);

export default function StudioStoryboardCards({ m, disabled, onSave, onSeek, onApplyProposal }: {
  m: MontageDetail; disabled: boolean; onSave: (edit: Edit) => Promise<unknown>; onSeek: (outputMs: number) => void; onApplyProposal: (p: Proposal) => Promise<void>;
}) {
  const edit = m.edit;
  const keyword = m.reel?.keyword ?? m.brief?.motCle ?? null;
  const cards = useMemo(() => (edit && m.captions.length ? storyboardCards(edit, m.captions, m.durationMs ?? 0, keyword) : []), [edit, m.captions, m.durationMs, keyword]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ key: string; text: string; tone: "ok" | "warn" } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState<{ key: string; reply: string; proposal: Proposal | null } | null>(null);

  if (!edit) return null;
  if (!m.captions.length) return <p className="card p-4 text-sm text-mut">Le storyboard apparaît après la transcription de la vidéo.</p>;

  const act = async (card: StoryboardCard, label: string, fn: () => Promise<string | null>) => {
    setBusy(`${card.key}:${label}`); setNotice(null);
    try { const text = await fn(); if (text) setNotice({ key: card.key, text, tone: "ok" }); }
    catch (e) { setNotice({ key: card.key, text: e instanceof Error ? e.message : "Action impossible.", tone: "warn" }); }
    finally { setBusy(null); }
  };
  const keep = (c: StoryboardCard) => act(c, "garder", async () => { await onSave(keepCard(edit, c)); return "Séquence validée."; });
  const remove = (c: StoryboardCard) => act(c, "supprimer", async () => { await onSave(deleteCard(edit, c)); return "Séquence retirée du montage (restaurable)."; });
  const restore = (c: StoryboardCard) => act(c, "restaurer", async () => { await onSave(restoreCard(edit, c, m.durationMs ?? undefined)); return "Séquence restaurée."; });
  const regenerate = (c: StoryboardCard) => act(c, "regenerer", async () => {
    const r = regenerateCard(edit, c, { canBehind: Boolean(matteAt(edit, c.scene.startMs)), keyword });
    if (!r) { setNotice({ key: c.key, text: "Aucune autre mise en scène adaptée à cette séquence : garde-la ou modifie-la avec tes mots.", tone: "warn" }); return null; }
    await onSave(r.edit);
    return `Nouvelle mise en scène : ${r.name}.`;
  });
  const modify = (c: StoryboardCard) => act(c, "modifier", async () => {
    const r = await montage.feedback(m.id, modifyInstruction(c, instruction), []);
    setPending({ key: c.key, reply: r.reply, proposal: r.proposal && r.baseUpdatedAt ? { edit: markModified(r.proposal, c), baseUpdatedAt: r.baseUpdatedAt } : null });
    setInstruction(""); setEditing(null);
    return null;
  });

  return (
    <section aria-label="Storyboard" className="space-y-2">
      <p className="px-1 text-xs text-mut">Ton Reel, séquence par séquence. Garde ce qui te va, modifie avec tes mots, supprime le reste.</p>
      <ol className="space-y-2">
        {cards.map((c) => {
          const off = disabled || Boolean(busy);
          const deleted = c.status === "deleted";
          return (
            <li key={c.key} aria-label={`Séquence ${c.role}`} className={`card space-y-2 p-3 transition ${deleted ? "opacity-60" : ""} ${c.status === "validated" ? "border-brand/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" className="font-semibold tabular-nums text-brand underline-offset-2 hover:underline disabled:no-underline" disabled={c.outStartMs === null} onClick={() => c.outStartMs !== null && onSeek(c.outStartMs)} aria-label={`Lire la séquence ${c.role} à ${time(c.outStartMs)}`}>
                  {time(c.outStartMs)} → {time(c.outEndMs)}
                </button>
                <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-semibold uppercase tracking-wide">{c.role}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 ${c.status === "validated" ? "bg-brand text-white" : c.status === "modified" ? "bg-brand/10 text-brand" : "bg-black/[0.05] text-mut"}`}>{STATUS_LABEL[c.status]}</span>
              </div>
              <p className={`text-sm ${deleted ? "line-through" : ""}`}>« {c.scene.text || "…"} »</p>
              {!deleted ? (
                <p className="text-xs text-mut">{c.effects.length ? `Effets : ${c.effects.map((e) => (e.text ? `${e.label} « ${e.text} »` : e.label)).join(" · ")}` : "Sans effet : sous-titres seuls."}</p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {deleted ? (
                  <button type="button" className="btn-ghost min-h-11 px-3 text-sm" disabled={off} onClick={() => void restore(c)}>Restaurer</button>
                ) : <>
                  <button type="button" className="btn-ghost min-h-11 px-3 text-sm" aria-pressed={c.status === "validated"} disabled={off || c.status === "validated"} onClick={() => void keep(c)}>Garder</button>
                  <button type="button" className="btn-ghost min-h-11 px-3 text-sm" aria-expanded={editing === c.key} disabled={off} onClick={() => { setEditing(editing === c.key ? null : c.key); setPending(null); }}>Modifier</button>
                  <button type="button" className="btn-ghost min-h-11 px-3 text-sm" disabled={off} onClick={() => void regenerate(c)}>Régénérer</button>
                  <button type="button" className="btn-ghost min-h-11 px-3 text-sm text-red-700" disabled={off} onClick={() => void remove(c)}>Supprimer</button>
                </>}
              </div>
              {editing === c.key ? (
                <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (instruction.trim()) void modify(c); }}>
                  <label className="sr-only" htmlFor={`modif-${c.key}`}>Ce que tu veux changer dans cette séquence</label>
                  <input id={`modif-${c.key}`} value={instruction} maxLength={600} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex. zoom moins fort, mets BUSINESS derrière moi…"
                    className="min-h-11 flex-1 rounded-xl border border-line bg-white px-3 text-sm" />
                  <button type="submit" className="btn-red min-h-11 px-4 text-sm" disabled={off || !instruction.trim()}>Demander à Bee</button>
                </form>
              ) : null}
              {pending?.key === c.key ? (
                <div className="space-y-2 rounded-xl bg-brand/5 p-3 text-sm" role="status">
                  <p>{pending.reply}</p>
                  {pending.proposal ? (
                    <div className="flex gap-2">
                      <button type="button" className="btn-red min-h-11 px-4 text-sm" disabled={off} onClick={() => void act(c, "appliquer", async () => { await onApplyProposal(pending.proposal!); setPending(null); return "Modification appliquée."; })}>Appliquer</button>
                      <button type="button" className="btn-ghost min-h-11 px-3 text-sm" onClick={() => setPending(null)}>Écarter</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {busy?.startsWith(`${c.key}:`) ? <p role="status" className="text-xs text-mut">En cours…</p> : null}
              {notice?.key === c.key ? <p role={notice.tone === "warn" ? "alert" : "status"} className={`text-xs ${notice.tone === "warn" ? "text-amber-800" : "text-emerald-800"}`}>{notice.text}</p> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
