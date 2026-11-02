"use client";
import { useState } from "react";
import { montage } from "@/lib/social/montage-api";
import type { Edit } from "@/domain/social/montage/edit";
import type { FeedbackTurn } from "@/domain/social/montage/feedback";

/**
 * PANNEAU RETOURS DU STUDIO (studio du Video Agent Kit, §7) : la direction écrit à Bee (« coupe la phrase ratée du
 * début », « ajoute un titre sur la promesse ») ; Bee répond et PROPOSE un montage, contrôlé par le serveur (rien
 * d'inventé, schéma strict). La proposition s'affiche dans l'aperçu ; elle n'est enregistrée que sur « Appliquer »
 * (et reste annulable). Les échanges ne sont gardés que dans l'onglet ouvert.
 */

type Message = FeedbackTurn & { applied?: string[]; rejected?: { op: string; why: string }[] };
export type Proposal = { edit: Edit; baseUpdatedAt: string; source?: "sequence" | "framing" | "captions" | "outro" };

type Props = {
  montageId: string;
  disabled?: boolean;
  proposal: Proposal | null;
  onProposal: (p: Proposal | null) => void;
  onApply: (p: Proposal) => Promise<void>;
};

export default function StudioFeedback({ montageId, disabled, proposal, onProposal, onApply }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"send" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy("send"); setError(null);
    const history = messages.map(({ role, text: t }) => ({ role, text: t }));
    setMessages((m) => [...m, { role: "user", text: message }]);
    setText("");
    try {
      const r = await montage.feedback(montageId, message, history);
      setMessages((m) => [...m, { role: "bee", text: r.reply, applied: r.applied, rejected: r.rejected }]);
      onProposal(r.proposal && r.baseUpdatedAt ? { edit: r.proposal, baseUpdatedAt: r.baseUpdatedAt } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retour impossible.");
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!proposal) return;
    setBusy("apply"); setError(null);
    try { await onApply(proposal); onProposal(null); } catch (err) { setError(err instanceof Error ? err.message : "Enregistrement impossible."); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-mut">Dites à Bee ce qu&apos;il faut changer. Il propose un montage contrôlé (rien d&apos;inventé) que vous voyez dans l&apos;aperçu avant de l&apos;appliquer.</p>
      <ol aria-label="Échanges avec Bee" className="max-h-[40vh] space-y-2 overflow-y-auto">
        {messages.length === 0 ? <li className="text-xs text-mut">Ex. « Coupe la phrase ratée du début », « Mets un titre quand je parle du club », « Sous-titres un peu plus gros ».</li> : null}
        {messages.map((m, i) => (
          <li key={i} className={`rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-6 bg-brand/10" : "mr-6 bg-black/[0.04]"}`}>
            <p className="text-xs font-medium text-mut">{m.role === "user" ? "Vous" : "Bee"}</p>
            <p className="whitespace-pre-line">{m.text}</p>
            {m.applied?.length ? <ul className="mt-1 list-disc pl-5 text-xs">{m.applied.map((a, j) => <li key={j}>{a}</li>)}</ul> : null}
            {m.rejected?.length ? (
              <ul className="mt-1 list-disc pl-5 text-xs text-mut" aria-label="Écarté">{m.rejected.map((r, j) => <li key={j}>Écarté ({r.op}) : {r.why}</li>)}</ul>
            ) : null}
          </li>
        ))}
      </ol>
      {proposal ? (
        <div role="status" className="space-y-2 rounded-xl border border-brand/40 bg-brand/5 p-3 text-sm">
          <p>La proposition de Bee est affichée dans l&apos;aperçu. Rien n&apos;est enregistré pour l&apos;instant.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-red min-h-[40px] px-3 text-sm" disabled={disabled || Boolean(busy)} onClick={apply}>{busy === "apply" ? "Enregistrement…" : "Appliquer"}</button>
            <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={Boolean(busy)} onClick={() => onProposal(null)}>Écarter</button>
          </div>
        </div>
      ) : null}
      <form onSubmit={send} className="space-y-2">
        <label className="block text-sm font-medium">
          Votre retour
          <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled}
            className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="btn-red min-h-[40px] px-3 text-sm" disabled={disabled || !text.trim() || Boolean(busy)} aria-busy={busy === "send"}>
          {busy === "send" ? "Bee réfléchit…" : "Envoyer à Bee"}
        </button>
      </form>
      {error ? <p role="alert" className="whitespace-pre-line text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
